# NOVA — SESSION 3 BRIEF (Claude Code edition)

You are extending the NOVA app from Session 2.5. The project at `C:\Projects\nova-v2\` now has functional Household and Personal zones with proper decimal money input, editable bills with rich schemas, edit/delete on transactions, and a Mark Paid form. Session 2.5 was committed to Git. Do not modify Session 2.5's structure — extend it.

You are Claude Code. You have filesystem access, can run shell commands, and can commit to Git directly. Edit files in place via your standard tooling — do not regenerate files wholesale unless a file is brand new.

== YOUR JOB IN SESSION 3 ==

Build the headline V1 feature: the variance engine. This is what the app's name promises and what the operator actually wants from this build.

Three deliverables:

1. **Variance forecasting engine** — pure functions that compute per-profile variance, balance projections, color states
2. **Dashboard variance overview** — replaces the current Dashboard stub with three live profile cards
3. **Calendar view** — new screen, monthly view, bill/income/transaction events with tap-to-expand details

Do NOT touch the Business tab beyond what variance needs (it can show a placeholder card on Dashboard with $0 balance and neutral state). Do NOT build notifications. Do NOT build exports. Those are Sessions 4 and 5.

== ENVIRONMENT — DO NOT REGRESS ==

- AsyncStorage stays ^2.0.0
- All storage keys keep `nova_v2_` prefix
- All money stays integer cents in storage
- Math.floor for display, formatCentsShort for display
- All colors / fonts / copy come from theme.config.js or personality.config.js
- Run `npx expo start --tunnel` for testing (LAN blocked)

== CORE PURPOSE — RESTATED ==

The variance engine answers one question continuously:

> "Will I have the money I need on the days I need it, without making a mid-cycle adjustment?"

Per profile (Household / Personal / Business), at all times.

== STEP 0 — SURVEY BEFORE YOU EDIT ==

Before changing a single line, read the existing project to confirm the brief's assumptions match reality:

- `useStore.js` — note every action that modifies financial state (logTransaction, distributePaycheck, recordPartnerDeposit, addHouseholdBill, addPersonalBill, markBillPaid, editBill, deleteBill, editTransaction, deleteTransaction, logGrocerySpend, updateAccountBalance, updateConfig). You will need to append `get().recomputeVariance()` to every one of these. List them in your survey report.
- `src/utils/currency.js` — confirm `formatCentsShort` still exists and `getCurrentWeekStart` or equivalent week utility is present
- `src/screens/DashboardScreen.js` — confirm it is still a stub
- `App.js` — note where `initStore()` is called, and where to add the two useEffects
- `theme.config.js` — confirm these tokens exist: `statusPositive`, `statusPositiveBg`, `statusWarning`, `statusWarningBg`, `statusDanger`, `statusDangerBg`, `borderColorDim`, `backgroundCard`, `accent`, `fontSizeXXL`, `fontSizeXL`, `fontSizeLG`, `fontSizeMD`, `fontSizeSM`, `spacingLG`, `spacingMD`, `radiusLG`. If any are missing, STOP and report.
- `src/navigation` or `App.js` navigation setup — confirm how screens are registered so you know how to add CalendarScreen as a stack screen

After the survey, give me a short report: what you found, any missing tokens or functions, the full list of store actions that need `recomputeVariance()` appended. **Do not start editing until I confirm the survey is clean.**

== EXECUTION ORDER — DO PARTS IN THIS SEQUENCE ==

Execute in this order, smoke-testing after each. Do not advance until the prior part launches without errors on the Pixel.

1. **Part 2 — State additions** — add `varianceConfig`, `varianceCache`, `lastCycleResetMonth` to store, add `recomputeVariance`, `updateVarianceConfig`, `checkCycleReset` actions, append `recomputeVariance()` to all financial actions. App must still launch after this step.
2. **Part 1 — forecasting.js** — create the pure functions file. No UI yet. After this step, `recomputeVariance()` in the store can actually call real logic instead of a stub.
3. **Part 3 — Dashboard** — replace the stub. Variance cards should show live data.
4. **Part 4 — Calendar screen** — new file, register in navigation, hook up from Dashboard.
5. **Part 5 — Variance Thresholds in Settings** — add the one new section to Settings.

After each part, briefly tell me what you changed and what you smoke-tested. I may pause you at any checkpoint.

**After Part 2 completes and the app still launches cleanly, do a `git commit` with message "Session 3 checkpoint - variance state scaffold" before continuing.** This gives a clean rollback point before the forecasting math goes in.

== PART 1 — VARIANCE ENGINE (PURE FUNCTIONS) ==

Create a new file: `src/utils/forecasting.js`

This file contains zero state. Pure functions only. Inputs are explicit, outputs are deterministic. Every consumer (Dashboard, Calendar, future notification engine) imports from here.

=== Functions to implement ===

```javascript
// Returns the last calendar day of a given month (1-31)
export const getLastDayOfMonth = (year, monthZeroIndexed) => { ... }

// Returns 'YYYY-MM' for the current cycle (current calendar month)
export const getCurrentCycleId = (now = Date.now()) => { ... }

// Returns the start (1st of month) and end (last day, 23:59:59.999) ms timestamps for a cycle
export const getCycleBounds = (cycleId) => {
  // returns { startMs, endMs }
}

// Number of weeks remaining in current cycle (for grocery projection), rounded up
export const weeksRemainingInCycle = (now = Date.now()) => { ... }

// Project all bill events between two timestamps for a list of bills
// Each bill produces one event per month its expectedDay falls within the range
// Skips a bill's event if lastPaidMonth matches the YYYY-MM of that event
// Uses lastPaidAmountCents if available, else amountCents
export const getBillEventsBetween = (bills, startMs, endMs) => {
  // Returns array of { dateMs, billId, billName, amountCents, accountKey }
}

// Project all income events between two timestamps
// Inputs: incomeEvents (paycheckAmount, nextPaycheckDate, partnerDepositAmount, partnerDepositLastReceivedMonth)
// Operator paycheck: bi-weekly from nextPaycheckDate, every 14 days
// Partner deposit: getPartnerDepositDate(year, month) for each month in range, skip if already received this month
export const getIncomeEventsBetween = (incomeEvents, startMs, endMs) => {
  // Returns array of { dateMs, source, amountCents, accountKey }
  // source: 'operator_paycheck' | 'partner_deposit'
}

// Project the balance of an account on a target date
// Walks forward from now: applies all known bill events (-) and income events (+) up to target date
// Returns { projectedBalance, eventLog: [...all events that fired] }
export const projectBalance = ({
  currentBalance,
  accountKey,
  targetDateMs,
  bills,
  incomeEvents,
  groceryWeeklyLimit,
  groceryAccountKey,
}) => { ... }

// Find the minimum projected balance for an account over the next N days
export const findMinimumProjectedBalance = ({
  currentBalance,
  accountKey,
  bills,
  incomeEvents,
  daysAhead,             // default 14
  floorCents,
}) => {
  // Returns { minimumBalance, minimumDate, dipsBelowFloor }
}

// Compute variance for a profile
export const computeProfileVariance = ({
  profile,               // 'household' | 'personal' | 'business'
  accounts,
  accountFloors,
  bills,
  incomeEvents,
  groceryBudget,
  varianceConfig,        // { redThresholdCents, yellowFloorBufferCents }
  now = Date.now(),
}) => {
  // Returns:
  // {
  //   balance: total balance across profile's accounts (cents),
  //   variance: (balance + projectedIncome) - (remainingBills + remainingGrocery),
  //   state: 'green' | 'yellow' | 'red' | 'neutral',
  //   annotation: human-readable string,
  //   dipPeriod: { startDate, endDate } | null,
  //   redDate: ms timestamp when balance would go negative | null,
  // }
}
```

=== Profile-to-accounts mapping ===

```javascript
const PROFILE_ACCOUNTS = {
  household: ['jointChecking'],
  personal: ['entChecking', 'entSavings', 'venmo', 'cash'],
  business: [],
};
```

For Session 3, business profile returns: `{ balance: 0, variance: 0, state: 'neutral', annotation: 'Business tracking activates in Session 4', dipPeriod: null, redDate: null }`.

=== State classification logic ===

```javascript
function classifyState({ variance, dipsBelowFloor, varianceConfig, redDate }) {
  // RED: variance below redThresholdCents OR redDate is not null
  if (variance <= varianceConfig.redThresholdCents) return 'red';
  if (redDate !== null) return 'red';

  // YELLOW: variance >= 0 BUT projected balance dips below floor in next 14 days
  if (dipsBelowFloor) return 'yellow';

  // GREEN: positive variance, no dip
  if (variance >= 0) return 'green';

  // Edge: variance negative but above red threshold and no negative balance projected
  return 'yellow';
}
```

=== Annotation copy ===

- Green: "On track for rollover" (if variance > $50000) or "On track" (otherwise)
- Yellow with dip: "Tight: [date range of dip]" — e.g., "Tight: May 8-12"
- Yellow without dip: "Margin thin"
- Red with redDate: "Deposit needed by [date]"
- Red without redDate: "Variance: -$X"
- Neutral: "—"

== PART 2 — STATE ADDITIONS ==

Add to useStore.js initial state:

```javascript
varianceConfig: {
  household: { redThresholdCents: -30000, yellowFloorBufferCents: 0 },
  personal: { redThresholdCents: -30000, yellowFloorBufferCents: 0 },
  business: { redThresholdCents: -30000, yellowFloorBufferCents: 0 },
},
varianceCache: {
  household: { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null },
  personal: { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null },
  business: { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null },
  lastComputedAt: null,
},
lastCycleResetMonth: null,  // 'YYYY-MM'
```

Add storage key: `KEYS.VARIANCE_CONFIG = 'nova_v2_variance_config'`. The varianceCache is NOT persisted — recomputed on app open.

=== New actions ===

```javascript
recomputeVariance() {
  // Reads current state, calls computeProfileVariance for each profile
  // Writes results to varianceCache
  // Sets varianceCache.lastComputedAt = Date.now()
  // Does NOT persist (cache is ephemeral)
}

updateVarianceConfig(profile, updates) {
  // Updates varianceConfig[profile] with the provided fields
  // Persists varianceConfig
  // Triggers recomputeVariance()
}

checkCycleReset() {
  // Compares getCurrentCycleId(now) to state.lastCycleResetMonth
  // If different:
  //   - Sets lastCycleResetMonth to current cycle id
  //   - Calls recomputeVariance()
  //   - Triggers NOVA flavor rotation tagged 'cycle_reset'
  //   - Persists state
}
```

=== Auto-recompute integration ===

After every existing action that modifies financial state, append `get().recomputeVariance()` after the existing logic. Actions to update (confirm exact names in survey):

- logTransaction
- distributePaycheck
- recordPartnerDeposit
- addHouseholdBill
- addPersonalBill
- markBillPaid
- editBill
- deleteBill
- editTransaction
- deleteTransaction
- logGrocerySpend
- updateAccountBalance
- updateConfig (if it touches financial values)

Performance: recompute is pure functions over in-memory state, sub-millisecond cost. No throttling needed.

=== App initialization ===

In App.js, after `initStore()` completes, add:

```javascript
// useEffect 1: runs once on mount
useEffect(() => {
  checkCycleReset();
  recomputeVariance();
}, []);

// useEffect 2: re-check on app foreground
useEffect(() => {
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') checkCycleReset();
  });
  return () => sub.remove();
}, []);
```

== PART 3 — DASHBOARD SCREEN — REPLACE STUB ==

Replace the contents of `src/screens/DashboardScreen.js` entirely.

=== Layout (top to bottom) ===

ScrollView container with theme.background, flex: 1.

1. **Header strip** (theme.spacingLG padding):
   - Title "DASHBOARD" in theme.accent, theme.fontSizeXL
   - Subtitle "Three Zone Overview" in theme.textSecondary, theme.fontSizeMD
   - Right-aligned, small: "Cycle: [Month YYYY]" in theme.textDim

2. **Three profile cards** in a vertical stack, theme.spacingMD between. Each card:
   - Outer container: padding theme.spacingLG, borderRadius theme.radiusLG, borderWidth 2, marginHorizontal theme.spacingMD
   - Border color and background depend on variance state:
     - green: border `theme.statusPositive`, bg `theme.statusPositiveBg`
     - yellow: border `theme.statusWarning`, bg `theme.statusWarningBg`
     - red: border `theme.statusDanger`, bg `theme.statusDangerBg`
     - neutral: border `theme.borderColorDim`, bg `theme.backgroundCard`
   - Top row: profile name (theme.fontSizeLG, theme.accent for active, theme.textDim for neutral) + chevron right
   - Balance line: formatCentsShort, theme.fontSizeXXL, theme.textPrimary
   - Variance line: explicit +/- sign, formatCentsShort, theme.fontSizeLG — green for positive, red for negative, theme.textSecondary for 0
   - Annotation line: from variance.annotation, theme.fontSizeSM, theme.textSecondary
   - On tap: navigate to that zone's tab

3. **Quick actions row** (theme.spacingLG padding, horizontal layout, evenly spaced):
   - "VIEW CALENDAR" → navigate to CalendarScreen
   - "LOG TRANSACTION" → navigate to Household tab (quick-pick modal is V2)
   - "CONFIRM BALANCE" → calls store.confirmBalance(), rotates flavor text

4. **Recent Activity strip** (theme.spacingLG padding):
   - Header "RECENT ACTIVITY" — theme.textSecondary, theme.fontSizeMD, uppercase
   - Last 3 transactions across all accounts, sorted by timestamp desc, non-deleted only
   - Each row: amount (formatCentsShort, signed, colored) + description (truncated 30 chars) + timeAgo (theme.textDim)
   - "VIEW ALL" at bottom — for V1, shows an Alert "Full log coming in Session 5"

=== Variance card uses cached data ===

Components read `varianceCache` from the store via Zustand selector. Auto-rerenders on store updates.

== PART 4 — CALENDAR SCREEN (NEW) ==

Create new file: `src/screens/CalendarScreen.js`

Register as a stack screen accessible from Dashboard's "VIEW CALENDAR" button. Update navigation setup in App.js (or wherever nav is configured) to include this stack screen. Calendar is NOT a primary tab — it is pushed onto the stack from Dashboard.

=== Layout ===

1. **Header**: month name + year (theme.fontSizeXL, theme.accent), chevron left/right to navigate months, "TODAY" button on the right

2. **Day-of-week row**: SUN MON TUE WED THU FRI SAT (theme.textDim, theme.fontSizeSM)

3. **Calendar grid**: 7 columns, 5–6 rows. Each day cell:
   - Cell size: ~1/7 of screen width, square
   - Border: theme.borderColorDim, 1px
   - Today: borderColor theme.accent, borderWidth 2
   - Dot indicators at bottom of cell:
     - Small red dot: bill due this day
     - Small green dot: income event scheduled
     - Small blue dot: actual transaction logged
   - Date number: top-left, theme.textPrimary (theme.textDim for grid-fill cells outside current month)
   - Background tinted theme.statusDangerBg if projected jointChecking balance on this day is below floor (only compute for days with bill events — see performance note)

4. **Selected day detail panel** (below grid):
   - Initially shows today's events
   - Updates on day tap
   - Header: formatted date ("Tuesday, May 12, 2026")
   - Event list:
     - "🔴 [Bill Name] — $X (expected) — UNPAID" or "PAID $X on [date]"
     - "🟢 Operator Paycheck — $X (expected)"
     - "🟢 Partner Deposit — $X (expected)"
     - "🔵 [Description] — $X (logged)"
   - Each row tappable:
     - Bill row → opens existing EDIT BILL modal pre-loaded with that bill
     - Income event row → info-only Alert (editing is V2)
     - Transaction row → opens existing EDIT TRANSACTION modal pre-loaded with that transaction

=== Data sources ===

- `householdBills` and `personalBills` (active only)
- `transactions` (non-deleted only)
- `incomeEvents`
- `groceryBudget`

Use forecasting.js functions:
- `getBillEventsBetween(bills, monthStart, monthEnd)` for red dots
- `getIncomeEventsBetween(incomeEvents, monthStart, monthEnd)` for green dots
- `transactions.filter(t => !t.deleted && timestamp in this month)` for blue dots
- `findMinimumProjectedBalance` per day for danger tinting — only compute for days that have bill events

=== Performance constraint ===

Only render the visible month. Recompute on chevron tap. Do not pre-compute adjacent months.

== PART 5 — VARIANCE THRESHOLDS IN SETTINGS ==

Settings is still mostly stubbed. Add ONE new section only.

=== Variance Thresholds section ===

For each profile (Household, Personal, Business):
- Header: profile name
- Red threshold field: "Red alert when variance falls below: $[X]" — decimal input, defaults to -300 (stored as -30000 cents, display as dollar value)
- Floor buffer field: "Yellow alert if any account dips below floor + $[X]" — decimal input, defaults to 0
- Auto-save on blur is fine for V1

== TESTING REQUIREMENTS ==

Before declaring done, verify on Pixel via tunnel mode:

1. App launches without errors (no Session 2.5 regression)
2. Dashboard loads and shows three profile cards
3. Without any data: Household $0, neutral. Personal $0, neutral. Business neutral.
4. Add a $1,200 paycheck on Personal, $500 partner deposit on Household, set rent to $2,350 due day 1, internet to $90 due day 12, grocery weekly limit $200. Variance numbers update live.
5. Verify Household variance math: jointChecking balance + (partner deposit if not yet received + projected operator deposits to joint) - (rent + internet + 4 weeks × $200 grocery)
6. Verify Personal variance math accounts for all four personal accounts and any personal bills
7. Tap a Dashboard card → navigates to correct zone tab
8. Tap VIEW CALENDAR → calendar opens, current month visible
9. Calendar shows red dot on rent's expected day (1st), red dot on internet's day (12th), green dots on projected paycheck/deposit days
10. Tap a day with events → detail panel shows events. Tap a bill event → EDIT BILL modal opens
11. Adjust a bill's expected day or amount → calendar updates, Dashboard variance updates
12. Mark a bill paid → red dot for that bill changes to paid indicator for that month, variance updates
13. Settings → Variance Thresholds → change Household red threshold to -$100 → state flips to red if variance is between -$100 and -$300
14. Force cycle reset check (call checkCycleReset() via a debug button or manually) → variance recomputes for new cycle
15. NOVA flavor text still rotates on transactions
16. No red error screens. Metro logs clean.

If grocery math feels off, check `weeksRemainingInCycle` — Sundays count as new weeks.

== STOPPING POINT ==

When all 16 testing items pass, STOP. Tell me to test, await confirmation. After I confirm, commit with message:

```
Session 3 complete - variance engine + dashboard + calendar
```

…and push.

If you hit a wall after 3 attempts on the same issue, stop and report exactly what's failing and what you've tried.

== ASSUMPTIONS BAKED IN (operator has reviewed and confirmed) ==

- Drift learning OFF for V1 — bill's expected day stays locked when paid on a different day
- Grocery in variance math: `weeklyLimit × weeksRemainingInCycle` (rounded up). If weeklyLimit is 0, no grocery impact.
- Yellow trigger: projected dip below (floor + yellowFloorBufferCents) in next 14 days
- Calendar: monthly view only — rolling 30-day view is V2
- Calendar editing: tap event → routes to existing edit modals. No drag-to-reschedule.
- Business profile: neutral state card in V1. Lights up in Session 4.

Begin with **Step 0 (Survey)**. Wait for my confirmation before editing.
