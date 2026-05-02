# NOVA — SESSION 3.5 BRIEF (Claude Code edition)

You are continuing the NOVA app at `C:\Projects\nova-v2\`. Sessions 1–2.5 are complete and committed. Session 3's store layer was built but the UI was never completed. This session finishes Session 3 and adds Session 3.5 changes in one pass.

You are Claude Code. Edit files in place. Do not regenerate files wholesale unless the file is brand new.

---

## WHAT IS ALREADY BUILT — DO NOT TOUCH

- All store actions: `recomputeVariance` (stub), `checkCycleReset`, `updateVarianceConfig`, `editBill`, `deleteBill`, `editTransaction`, `deleteTransaction` — all exist in useStore.js
- `recomputeVariance()` is wired to all financial actions except `updateGroceryBudget`
- AppState useEffects exist in App.js
- `theme.radiusLG: 16` alias exists in theme.config.js
- Bill V1.2 schema, decimal money input, Mark Paid form — all working

## WHAT IS MISSING — YOUR JOB THIS SESSION

1. `src/utils/forecasting.js` — does not exist
2. `recomputeVariance` in useStore.js is a stub — needs real logic once forecasting.js exists
3. `DashboardScreen.js` — still a centered stub
4. `CalendarScreen.js` — does not exist
5. Stack navigator in App.js — only tab navigator exists
6. Recent Activity section — not in HouseholdScreen or PersonalScreen
7. `updateGroceryBudget` missing `recomputeVariance()` call
8. DELETE button on bill rows needs to move into EditBillModal
9. Pay Schedule editor missing from Settings
10. Partner Deposit editor missing from Settings

---

## STEP 0 — SURVEY BEFORE EDITING

Read these files before touching anything:
- `useStore.js` — find `recomputeVariance` stub, `updateGroceryBudget`, `incomeEvents` shape
- `src/config/theme.config.js` — confirm all tokens used in this brief exist
- `src/utils/currency.js` — confirm `formatCentsShort`, `parseBillInput`
- `src/utils/dates.js` — confirm `getPartnerDepositDate`, `formatDate`, `timeAgo`
- `App.js` — confirm current navigation structure
- `src/screens/HouseholdScreen.js` — find where bill rows render, where DELETE button is
- `src/screens/PersonalScreen.js` — same
- `src/screens/SettingsScreen.js` — note what sections already exist
- Wherever `EditBillModal` lives — find it

Report: confirm the above files and functions exist, note the exact shape of `incomeEvents` in the store initial state, note where `EditBillModal` is defined. Wait for my confirmation before editing.

---

## EXECUTION ORDER

Do parts in this sequence. Smoke-test after each. Tell me what changed before moving on.

**After Part 2 completes and app still launches: `git commit -m "Session 3.5 checkpoint - forecasting engine"`**

---

## PART 1 — Wire updateGroceryBudget

In `useStore.js`, find `updateGroceryBudget`. Add `get().recomputeVariance()` at the end, after the existing persist call. One line. Nothing else.

---

## PART 2 — Create src/utils/forecasting.js

New file. Pure functions only — no store imports, no React. Inputs are explicit arguments.

### Functions to implement:

```javascript
// Returns last calendar day of a month (1-31)
// monthZeroIndexed: 0=Jan, 11=Dec
export const getLastDayOfMonth = (year, monthZeroIndexed)

// Returns 'YYYY-MM' for the current cycle
export const getCurrentCycleId = (now = Date.now())

// Returns { startMs, endMs } for a cycleId like '2026-05'
export const getCycleBounds = (cycleId)

// Weeks remaining in current cycle, rounded up. Sunday = week start.
export const weeksRemainingInCycle = (now = Date.now())

// Bill events between two timestamps
// Returns: [{ dateMs, billId, billName, amountCents, accountKey }]
// Skips bill if bill.lastPaidMonth === YYYY-MM of that event
// Uses bill.lastPaidAmountCents if set, else bill.amountCents
// Skips bills where isActive === false
export const getBillEventsBetween = (bills, startMs, endMs)

// Income events between two timestamps
// incomeEvents shape from store: { nextPaycheckDate, paycheckAmountCents, payFrequency,
//   partnerDepositAmountCents, partnerDepositSchedule, partnerDepositLastReceivedMonth }
// Operator paycheck: bi-weekly from nextPaycheckDate, every 14 days.
//   Skip if nextPaycheckDate is null (Unscheduled).
// Partner deposit: one per month using getPartnerDepositDate(year, month) from dates.js
//   Skip if partnerDepositLastReceivedMonth matches that month's YYYY-MM
// Returns: [{ dateMs, source, amountCents, accountKey }]
//   source: 'operator_paycheck' | 'partner_deposit'
//   operator paycheck accountKey: 'entChecking'
//   partner deposit accountKey: 'jointChecking'
export const getIncomeEventsBetween = (incomeEvents, startMs, endMs)

// Project balance of one account on a target date
// Walks forward from now, applies income (+) and bill (-) events up to targetDateMs
// Grocery: deducts (groceryWeeklyLimit) per week if accountKey === groceryAccountKey
// Returns: { projectedBalance, eventLog }
export const projectBalance = ({
  currentBalance, accountKey, targetDateMs,
  bills, incomeEvents, groceryWeeklyLimit, groceryAccountKey
})

// Find minimum projected balance for an account over next N days
// Returns: { minimumBalance, minimumDate, dipsBelowFloor }
export const findMinimumProjectedBalance = ({
  currentBalance, accountKey, bills, incomeEvents,
  daysAhead = 14, floorCents = 0
})

// Compute full variance result for one profile
// profile: 'household' | 'personal' | 'business'
// Returns: { balance, variance, state, annotation, dipPeriod, redDate }
export const computeProfileVariance = ({
  profile, accounts, accountFloors, bills, incomeEvents,
  groceryBudget, varianceConfig, now = Date.now()
})
```

### Profile → accounts mapping:
```javascript
const PROFILE_ACCOUNTS = {
  household: ['jointChecking'],
  personal: ['entChecking', 'entSavings', 'venmo', 'cash'],
  business: [],
};
```

Business returns immediately: `{ balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null }`

### Variance formula:
```
variance = (currentBalance + projectedIncomeRemaining) - (remainingBills + remainingGrocery)
```
- `remainingBills` = bills not yet paid this cycle with expectedDay >= today
- `remainingGrocery` = weeklyLimit × weeksRemainingInCycle (only for household)
- `projectedIncomeRemaining` = income events between now and end of cycle for this profile's accounts

### State classification:
- `red`: variance <= varianceConfig.redThresholdCents OR redDate is not null
- `yellow`: dipsBelowFloor is true (from findMinimumProjectedBalance over 14 days)
- `green`: variance >= 0 and no dip
- else: `yellow`

### Annotation strings:
- green, variance > 50000: `"On track for rollover"`
- green: `"On track"`
- yellow with dipPeriod: `"Tight: [startDate]–[endDate]"` (format dates as "May 8")
- yellow no dip: `"Margin thin"`
- red with redDate: `"Deposit needed by [date]"`
- red no redDate: `"Variance: -$X"` (use formatCentsShort from currency.js)
- neutral: `"—"`

### After forecasting.js is built:

Replace the `recomputeVariance` stub in `useStore.js` with real logic:
```javascript
recomputeVariance() {
  const state = get();
  const now = Date.now();
  const profiles = ['household', 'personal', 'business'];
  const newCache = { ...state.varianceCache, lastComputedAt: now };

  for (const profile of profiles) {
    newCache[profile] = computeProfileVariance({
      profile,
      accounts: state.accounts,
      accountFloors: state.config?.accountFloors || {},
      bills: [...(state.householdBills || []), ...(state.personalBills || [])],
      incomeEvents: state.incomeEvents,
      groceryBudget: state.groceryBudget,
      varianceConfig: state.varianceConfig[profile],
      now,
    });
  }

  set({ varianceCache: newCache });
  // Do NOT persist varianceCache — it is ephemeral
},
```

---

## PART 3 — Replace DashboardScreen.js

Replace the entire file. Layout top to bottom:

### Header strip
- "DASHBOARD" — `theme.accent`, `theme.fontSizeXL`
- "Three Zone Overview" — `theme.textSecondary`, `theme.fontSizeMD`
- Right-aligned: "Cycle: May 2026" (current month/year) — `theme.textDim`, `theme.fontSizeSM`

### Three profile cards (Household / Personal / Business)
Vertical stack, `theme.spacingMD` gap, each card:
- `padding: theme.spacingLG`, `borderRadius: theme.radiusLG`, `borderWidth: 2`, `marginHorizontal: theme.spacingMD`
- Border + background by state:
  - green → `theme.statusPositive` border, `theme.statusPositiveBg` bg
  - yellow → `theme.statusWarning` border, `theme.statusWarningBg` bg
  - red → `theme.statusDanger` border, `theme.statusDangerBg` bg
  - neutral → `theme.borderColorDim` border, `theme.backgroundCard` bg
- Profile name — `theme.fontSizeLG`, `theme.accent` (neutral: `theme.textDim`)
- Balance — `formatCentsShort`, `theme.fontSizeXXL`, `theme.textPrimary`
- Variance — explicit +/- sign, `formatCentsShort`, `theme.fontSizeLG`
  - positive: green (`theme.statusPositive`)
  - negative: red (`theme.statusDanger`)
  - zero: `theme.textSecondary`
- Annotation — `theme.fontSizeSM`, `theme.textSecondary`
- Tap card → navigate to that zone's tab (Household / Personal / Business)

Cards read from `varianceCache` via Zustand selector. Auto-rerenders on store updates.

### Quick actions row
Three equal buttons below cards:
- "VIEW CALENDAR" → navigate to CalendarScreen (stack push)
- "LOG TRANSACTION" → navigate to Household tab
- "CONFIRM BALANCE" → call `confirmBalance()` from store

### Recent Activity strip
- Header: "RECENT ACTIVITY" — `theme.textSecondary`, `theme.fontSizeMD`, uppercase
- Last 3 transactions, all accounts, non-deleted, sorted desc by timestamp
- Each row: signed amount (green=positive, `theme.textPrimary`=negative) + description (30 char truncate) + `timeAgo` from dates.js
- "VIEW ALL" link at bottom → `Alert("Full log coming in Session 5")`

---

## PART 4 — Stack navigator + CalendarScreen

### App.js
Wrap the existing `createBottomTabNavigator` in a `createNativeStackNavigator`.
Structure:
```
RootStack (NativeStack)
  ├── MainTabs (the existing tab navigator — make this the default screen)
  └── Calendar (CalendarScreen, no tab bar)
```

Import `@react-navigation/native-stack`. Register `CalendarScreen` in the stack.
The tab navigator and all existing tabs are unchanged — just wrapped.

### src/screens/CalendarScreen.js — new file

**Header row:**
- Left: chevron left button (previous month)
- Center: "May 2026" — `theme.fontSizeXL`, `theme.accent`
- Right: "TODAY" button + chevron right

**Day-of-week row:**
SUN MON TUE WED THU FRI SAT — `theme.textDim`, `theme.fontSizeSM`, evenly spaced

**Calendar grid:**
- 7 columns, 5–6 rows. Each cell: `Math.floor(screenWidth / 7)` wide, same height (square).
- Cell border: `theme.borderColorDim`, 1px
- Today cell: border `theme.accent`, borderWidth 2
- Out-of-month fill cells: date number in `theme.textDim`, no events
- Date number: top-left corner, `theme.textPrimary`
- Bottom of cell: up to 3 small dots (6px diameter, 2px margin):
  - Red dot: bill due this day (from `getBillEventsBetween`)
  - Green dot: income event this day (from `getIncomeEventsBetween`)
  - Blue dot: actual transaction logged this day (from store transactions)
- Cell background `theme.statusDangerBg` if: day has a bill event AND projected `jointChecking` balance on that day is below its floor. Only compute projection for days that have bill events.
- Tap cell → updates selected day panel

**Selected day panel (below grid):**
- Header: formatted date e.g. "Tuesday, May 12, 2026" — `theme.textPrimary`, `theme.fontSizeMD`
- List of events for selected day:
  - Bill: `"🔴 [Name] — $X — UNPAID"` or `"🔴 [Name] — PAID $X on [date]"` → tap → open EditBillModal with that bill pre-loaded
  - Income: `"🟢 [Source] — $X (expected)"` → tap → `Alert("Income event editing coming in V2")`
  - Transaction: `"🔵 [Description] — $X"` → tap → open EditTransactionModal with that transaction pre-loaded
- If no events: "Nothing scheduled" — `theme.textDim`

**Data sources:**
- `getBillEventsBetween` and `getIncomeEventsBetween` from forecasting.js (import them)
- Transactions: filter store transactions where `!deleted` and timestamp falls within selected month
- Only render current visible month — no pre-computation of other months
- Recompute on month navigation (chevron tap)

---

## PART 5 — Recent Activity on Household + Personal screens

Add a "RECENT ACTIVITY" section to the bottom of both `HouseholdScreen.js` and `PersonalScreen.js`, above any spending floor warnings. Edit only the relevant section of each file.

### Section spec:
- Header: "RECENT ACTIVITY" — `theme.textSecondary`, `theme.fontSizeMD`, uppercase, `theme.spacingMD` margin top
- Last 10 transactions for that zone, sorted descending by timestamp, `deleted !== true` only
  - Household filter: `t.accountKey === 'jointChecking'`
  - Personal filter: `['entChecking','entSavings','venmo','cash'].includes(t.accountKey)`
- Each row:
  - Amount: `formatCentsShort` with explicit sign. Positive (income) = `theme.statusPositive`. Negative (expense) = `theme.textPrimary`.
  - Description: truncated to 30 characters
  - Account name + `timeAgo(t.timestamp)` — `theme.textDim`, `theme.fontSizeSM`
- Long-press any row → action menu Modal (same backdrop/panel pattern used elsewhere):
  - "EDIT TRANSACTION" → open EditTransactionModal pre-loaded with that transaction
  - "DELETE TRANSACTION" → confirmation dialog "Delete this transaction? Account balance will be adjusted." → Cancel / Delete → calls `deleteTransaction(id)` from store

---

## PART 6 — Move DELETE out of bill rows

### In HouseholdScreen.js and PersonalScreen.js:
Find anywhere a standalone DELETE button exists on a bill row. Remove it.

### In EditBillModal (wherever it lives):
Add a "Delete Bill" button at the very bottom of the modal, below the Save/Cancel buttons.
- Style: text color `theme.statusDanger`, label "DELETE BILL"
- Tap → confirmation Alert: `"Delete [bill.name]? This can't be undone."` → Cancel / Delete
- On confirm: call `deleteBill(bill.id)` from store, close modal

Edit only the modal component. Do not touch any other file for this part.

---

## PART 7 — Pay Schedule section in Settings

Add a "PAY SCHEDULE" section to `SettingsScreen.js`. Edit only the Settings file.

### Fields:
1. **Pay frequency** — picker or segmented control with options: `Weekly` / `Bi-weekly` / `Monthly` / `Unscheduled`
2. **Next paycheck date** — three numeric inputs: Month / Day / Year (same simple pattern used in Mark Paid modal). Label: "Next paycheck date". Only show if frequency is not Unscheduled.
3. **Following paycheck preview** — read-only text below the date inputs showing the auto-calculated next date:
   - Weekly: +7 days
   - Bi-weekly: +14 days
   - Monthly: same day, next month
   - Unscheduled: hide this row entirely
   - Example: "Following paycheck: May 15, 2026"
4. **Paycheck amount** — decimal money input (keyboardType="decimal-pad", parseBillInput). Label: "Paycheck amount". Editable at any time.
5. **SAVE button** — on tap, updates store fields and calls `recomputeVariance()`

### Store fields to update (in `incomeEvents`):
- `payFrequency`: `'weekly'` | `'biweekly'` | `'monthly'` | `'unscheduled'`
- `nextPaycheckDate`: ms timestamp (null if Unscheduled)
- `paycheckAmountCents`: integer cents

Pre-fill fields from current store values on mount. Unscheduled → set `nextPaycheckDate: null` in store.

### forecasting.js impact:
`getIncomeEventsBetween` already skips operator paycheck when `nextPaycheckDate` is null. No additional change needed there.

---

## PART 8 — Partner Deposit section in Settings

Add a "PARTNER DEPOSIT" section to `SettingsScreen.js`, below Pay Schedule.

### Fields:
1. **Expected amount** — decimal money input
2. **Expected schedule** — two-option picker: `"Last day of month"` / `"Last Friday of month"`
3. **SAVE button** — updates store, calls `recomputeVariance()`
4. **CONFIRM RECEIVED button**
   - Label: "CONFIRM RECEIVED"
   - Only active (not grayed out) if `partnerDepositLastReceivedMonth` does not equal current `YYYY-MM`
   - On tap: calls `recordPartnerDeposit()` from store (already exists — credits jointChecking, logs transaction), awards XP +10, triggers NOVA flavor text with tag `'partner_deposit_received'`
   - Below button: "Last confirmed: [formatted date]" or "Not confirmed this month" — `theme.textDim`, `theme.fontSizeSM`

### Store fields to update:
- `incomeEvents.partnerDepositAmountCents`: integer cents
- `incomeEvents.partnerDepositSchedule`: `'last_day'` | `'last_friday'`

Pre-fill from current store values on mount.

---

## TESTING CHECKLIST

Verify all of these on the Pixel via tunnel before declaring done:

1. App launches, no regression from Sessions 1–2.5
2. Dashboard shows three profile cards — not the stub
3. Household and Personal cards show real balance and variance numbers
4. Change a bill amount → Dashboard variance updates
5. Household card turns red when variance drops below threshold
6. "VIEW CALENDAR" button opens Calendar screen
7. Calendar shows current month grid with correct day layout
8. Red dots appear on bill expected days, green dots on projected paycheck/deposit days
9. Tap a day with a bill → detail panel shows bill. Tap bill row → EditBillModal opens.
10. Recent Activity section visible on Household screen — last 10 transactions
11. Recent Activity section visible on Personal screen — last 10 transactions
12. Long-press a transaction in Recent Activity → EDIT / DELETE menu appears
13. DELETE transaction → balance adjusts, transaction disappears
14. Bill rows have no standalone DELETE button
15. Open EditBillModal → DELETE BILL button at bottom → confirmation → bill removed
16. Settings → PAY SCHEDULE section visible
17. Set frequency to Bi-weekly, enter May 1 → preview shows "Following paycheck: May 15, 2026"
18. Change paycheck amount → Dashboard Personal variance updates
19. Set frequency to Unscheduled → Personal card shows no projected income, date input hidden
20. Settings → PARTNER DEPOSIT section visible
21. Change partner deposit amount → Dashboard Household variance updates
22. CONFIRM RECEIVED → XP awarded, NOVA flavor rotates, button grays out
23. Metro logs clean. No red error screens.

---

## STOPPING POINT

When all 23 items pass: STOP. Tell me to test. After I confirm, commit:

```
Session 3.5 complete - variance engine live, dashboard, calendar, pay schedule editor
```

Push to Git.

If you hit the same error 3 times: stop, report exactly what is failing and what you tried. Do not loop.

Begin with **Step 0 (Survey)**. Wait for my confirmation before editing anything.
