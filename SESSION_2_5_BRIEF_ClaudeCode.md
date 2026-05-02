# NOVA — SESSION 2.5 BRIEF (Claude Code edition)

You are extending the NOVA app from Session 2. The project at `C:\Projects\nova-v2\` is functional — both Household and Personal zones work, paycheck distribution + rollover sweep are correct, NOVA flavor text rotates on events. Session 2 was committed to Git. Do not modify Session 2's structure — extend and refine it.

You are Claude Code. You have filesystem access, can run shell commands, and can commit to Git directly. Use those capabilities. Edit files in place via your standard tooling — do not regenerate files wholesale unless a file is brand new.

== YOUR JOB IN SESSION 2.5 ==

This is a small surgical session. Six focused fixes:

1. Switch all monetary input from digit-only-cents-implied to standard decimal entry
2. Switch all monetary display from formatCents to formatCentsShort (hide cents by default)
3. Upgrade the bill schema with new fields, add a non-destructive migration shim
4. Add EDIT and DELETE on bills (long-press → action menu)
5. Add a "Mark Paid" form with editable date and editable amount per occurrence
6. Add EDIT and DELETE on recent transactions, surfaced via a "Recent Activity" section on Household and Personal tabs

Do NOT touch the variance engine, the Dashboard, the Calendar, the Business tab, or notifications. Those are Session 3 / 4 / 5.

== ENVIRONMENT — DO NOT REGRESS ==

- AsyncStorage stays ^2.0.0
- All storage keys keep `nova_v2_` prefix
- newArchEnabled stays false in app.json
- All money stays integer cents in storage
- Math.floor for display, never Math.round
- All colors / fonts / copy come from theme.config.js or personality.config.js. Never hardcode.
- Run `npx expo start --tunnel` for testing (LAN mode is blocked on this network)

== STEP 0 — SURVEY BEFORE YOU EDIT ==

Before changing a single line, read the existing project to confirm the brief's assumptions match reality:

- `package.json` — confirm dependency versions, especially AsyncStorage and Expo SDK
- `useStore.js` (or wherever the Zustand/state store lives) — note the existing actions, the bill array shapes, where AsyncStorage hydrate happens, and what `markBillPaid` currently does
- `currency.js` — confirm `parseBillInput` exists and parses "47.50" → 4750 cents and "47" → 4700 cents. Confirm `formatCentsShort` exists and hides `.00` on round numbers. If either is missing or behaves differently, STOP and report
- The Household screen component, the Personal screen component, and every modal listed in Part 1
- `theme.config.js` — confirm the token names referenced in this brief (`textDim`, `textPrimary`, `textSecondary`, `backgroundPanel`, `fontSizeMD`, `fontSizeSM`, `spacingXS`) actually exist. If any are missing, STOP and report

After the survey, give me a short report: what you found, anything that contradicts the brief, anything missing. **Do not start editing until I confirm the survey is clean.**

== EXECUTION ORDER — DO PARTS IN THIS SEQUENCE ==

Execute the six parts in this order, smoke-testing after each. Do not advance until the prior part launches without errors on the Pixel and the relevant test items pass.

1. **Bill schema migration shim (Part 3)** — runs first while existing data is still verifiable. Verify the existing $235,000 rent bill survives the upgrade with all original fields intact.
2. **Display formatting swap to formatCentsShort (Part 2)** — pure read-side change. Low blast radius.
3. **Decimal money input + live preview on all modals (Part 1)** — most modals share patterns; do one well, replicate.
4. **EDIT / DELETE on bills (Part 4)** — depends on the new schema being live.
5. **MARK PAID form (Part 5)** — depends on the new schema and the decimal input.
6. **Recent Activity + EDIT / DELETE on transactions (Part 6)** — largest new UI surface, goes last where a regression is cheapest.

After each part, briefly tell me what you changed and what you smoke-tested before moving to the next. I may pause you at any checkpoint.

== PART 1 — DECIMAL MONEY INPUT ==

Currently every money input modal uses `keyboardType="numeric"` and parses with `parseCentsInput("4750") → 4750 cents`. The operator hates this — typed "235000" expecting $2,350.00, got $235,000.00.

Switch every money input modal in the app to:

- `keyboardType="decimal-pad"` (this is React Native's standard decimal input — shows decimal point on the keypad)
- Parse with `parseBillInput` from currency.js (already exists — it does the right thing: "47.50" → 4750 cents, "47" → 4700 cents)
- Below the input, render a live formatted preview using formatCentsShort. As the user types, they see the formatted value update.
  - Style: theme.textDim, theme.fontSizeSM, marginTop theme.spacingXS
  - Example: user types "2350.5" → preview reads "$2,350.50". User types "2350" → preview reads "$2,350".
- Placeholder text in the input: "0.00" (theme.textDim)
- Reject invalid input gracefully — if parseBillInput returns 0 or NaN, show preview as "$0" and disable the submit button

Affected modals (audit and update all of them):
- LOG INCOME modal (Household + Personal — both use the same component if abstracted, or two if duplicated)
- LOG EXPENSE modal (Household + Personal)
- EDIT BALANCE modal (Household + Personal)
- ADD BILL modal (Household + Personal)
- LOG GROCERY SPEND modal (Household)
- RECORD DEPOSIT modal (Household — the partner deposit confirm modal)
- RECORD PAYCHECK modal (Personal)

Also update Settings (if any monetary inputs exist there yet — paycheck amount, partner deposit amount, distribution amounts, account floors, weekly grocery limit). Apply the same pattern.

== PART 2 — DISPLAY FORMATTING ==

Audit every place a money value renders to the screen. Switch from formatCents (always shows cents: "$47.50") to formatCentsShort (hides cents when zero: "$1,000" but "$1,000.50" if non-zero cents).

Affected display points:
- Account balance numbers on Household and Personal screens
- Bill amounts in bill list
- Grocery card (weekly limit, current week spend)
- Pay cycle preview ("Next paycheck: $X → ENT Savings, $Y → Venmo, ...")
- Transaction list items (when those get added)
- Anywhere else money is rendered

The store still uses integer cents. Only display layer changes.

Exception: in modals, the live preview uses formatCentsShort too — same rule.

== PART 3 — BILL SCHEMA UPGRADE ==

Current bill shape (from Session 2):
```javascript
{ id, name, amountCents, dueDay }
```

New bill shape (V1.2):
```javascript
{
  id: 'bill_001',
  name: 'Rent',
  amountCents: 235000,
  expectedDay: 1,
  isAutoDraft: true,
  isActive: true,
  lastPaidDate: null,         // ms timestamp, null until first payment
  lastPaidAmountCents: null,  // null until first payment
  lastPaidMonth: null,        // 'YYYY-MM' format, null until first payment
  defaultAccountKey: 'jointChecking',
  createdAt: Date.now(),
}
```

=== Migration shim ===

In useStore's `initStore()` action (after AsyncStorage hydrate, before set), check both `householdBills` and `personalBills` arrays. For each bill that has the OLD shape (presence of `dueDay` field, absence of `expectedDay` field), upgrade it in place:

```javascript
const upgradeBillIfNeeded = (bill, defaultAccountKey) => {
  if (bill.expectedDay !== undefined) return bill; // already upgraded
  return {
    ...bill,
    expectedDay: bill.dueDay,
    isAutoDraft: true,
    isActive: bill.isActive !== undefined ? bill.isActive : true,
    lastPaidDate: bill.lastPaidDate || null,
    lastPaidAmountCents: bill.lastPaidAmountCents || null,
    lastPaidMonth: bill.lastPaidMonth || null,
    defaultAccountKey: bill.defaultAccountKey || defaultAccountKey,
    createdAt: bill.createdAt || Date.now(),
    // Note: dueDay field is left in place. Don't delete it — non-destructive.
  };
};

// In initStore, after hydration:
state.householdBills = state.householdBills.map(b => upgradeBillIfNeeded(b, 'jointChecking'));
state.personalBills = state.personalBills.map(b => upgradeBillIfNeeded(b, 'entChecking'));
// Persist upgraded shapes
```

The migration is idempotent — runs every initStore but is a no-op for already-upgraded bills.

=== ADD BILL modal updates ===

The ADD BILL modal now collects these fields:
- Name (text)
- Expected amount (decimal money input — see Part 1)
- Expected day (numeric input, 1-31)
- Auto-draft? (toggle/switch — defaults to true)
- Default account (dropdown — Household: jointChecking only for now; Personal: entChecking, venmo, cash)

== PART 4 — EDIT AND DELETE BILLS ==

In the bill list on Household and Personal screens, each bill row gets a long-press handler. Long-press opens an action menu with three options:
- EDIT BILL
- MARK PAID (only if not paid this month)
- DELETE BILL

Use React Native's built-in long-press detection (`onLongPress` on TouchableOpacity / Pressable). The action menu is a Modal styled per existing modal conventions (backdrop rgba(0,0,0,0.7), panel theme.backgroundPanel, options as text buttons).

=== EDIT BILL modal ===
Pre-fills the existing bill values. Same fields as ADD BILL. On submit, calls a new store action `editBill(billId, updates)` which finds the bill in the appropriate array, merges updates, persists.

=== DELETE BILL ===
Soft delete via `isActive: false`. New action `deleteBill(billId)` sets `isActive: false`, persists. Render logic in bill lists filters out `!isActive` bills.

Confirmation dialog before delete: "Delete [bill name]? This can't be undone in V1." → Cancel / Delete.

=== Store actions to add ===
```javascript
editBill(billId, updates) {
  // Search householdBills and personalBills, find matching id, merge updates, persist
}
deleteBill(billId) {
  // Search both arrays, set isActive: false, persist
}
```

== PART 5 — MARK PAID FORM ==

Currently MARK PAID is a one-tap action that debits the default amount from the default account. Replace with a proper form modal.

=== MARK PAID modal ===
Opens when MARK PAID is tapped from the bill row OR from the long-press action menu.

Fields:
- Bill name (header, read-only)
- Date paid (date input, defaults to today — see date input note below)
- Amount paid (decimal money input, defaults to bill's expected amountCents)
- Account paid from (dropdown, defaults to bill's defaultAccountKey)
- Notes (optional text input, free-form)
- CONFIRM button + CANCEL button

=== Date input note ===
React Native doesn't have a great built-in date picker without a library. For Session 2.5, implement a SIMPLE date input:
- Three numeric inputs: Month (1-12), Day (1-31), Year (4-digit, defaults to current year)
- Below them, a live preview formatted via formatDate() showing the resulting date
- This is good enough for V1. A proper date picker (e.g. @react-native-community/datetimepicker) is a Session 5 polish item.

=== Behavior on confirm ===
- Validates: date is valid, amount > 0, account exists
- Calls a new store action `markBillPaid(billId, { paidDate, paidAmountCents, accountKey, notes })`:
  - Logs a transaction: account is debited by paidAmountCents, category 'bill_payment', description includes bill name and notes if any, timestamp is paidDate
  - Updates the bill's `lastPaidDate`, `lastPaidAmountCents`, `lastPaidMonth` (YYYY-MM derived from paidDate)
  - Awards XP (+5)
  - Triggers NOVA flavor rotation
  - Checks spending floors after debit

Replace any existing markBillPaid action with this richer version.

== PART 6 — RECENT ACTIVITY + EDIT/DELETE TRANSACTIONS ==

Add a "RECENT ACTIVITY" section near the bottom of both Household and Personal screens (above any spending floor warnings).

=== Recent Activity section ===
- Header: "RECENT ACTIVITY" (theme.textSecondary, theme.fontSizeMD, uppercase)
- List of the last 10 transactions for that zone, sorted descending by timestamp
- Filter: Household section shows transactions where accountKey === 'jointChecking'. Personal section shows transactions where accountKey is one of ['entChecking', 'entSavings', 'venmo', 'cash']
- Each row: amount (formatCentsShort, signed — green for positive/income, theme.textPrimary for negative/expense), description (truncated to 30 chars), account name (small, theme.textDim), timeAgo (small, theme.textDim)
- Soft-deleted transactions (deleted: true) are filtered out
- Long-press on any row opens an action menu: EDIT TRANSACTION / DELETE TRANSACTION

=== EDIT TRANSACTION modal ===
Pre-fills existing values:
- Amount (decimal money input — note: store the absolute value, sign is determined by transaction type / category)
- Type toggle (Income / Expense — determines sign)
- Category dropdown (use whatever exists for log income / log expense modals)
- Description text input
- Account dropdown
- CONFIRM / CANCEL

On confirm, calls new store action `editTransaction(transactionId, updates)`:
- Reverses the original transaction's effect on the account balance (subtract original amountCents)
- Applies the new values
- Adds the new amountCents to the (possibly different) account
- Persists

=== DELETE TRANSACTION ===
Soft delete. New store action `deleteTransaction(transactionId)`:
- Reverses the transaction's balance effect on the account
- Sets transaction.deleted = true
- Persists

Confirmation dialog: "Delete this transaction? Account balance will be adjusted." → Cancel / Delete.

== STATE / STORE ADDITIONS SUMMARY ==

New actions needed in useStore.js:
- `editBill(billId, updates)`
- `deleteBill(billId)` (replaces any soft-delete pattern not yet present)
- `markBillPaid(billId, { paidDate, paidAmountCents, accountKey, notes })` (rewrite of existing if present)
- `editTransaction(transactionId, updates)`
- `deleteTransaction(transactionId)`
- Migration helper `upgradeBillIfNeeded(bill, defaultAccountKey)` (private helper, called inside initStore)

No new storage keys. No new top-level state fields.

== TESTING REQUIREMENTS ==

Before declaring done, verify on the Pixel via tunnel mode:

1. App launches without errors (no Session 2 regression)
2. Onboarding flow still works (if accessible)
3. Open Household → existing bills are visible and have not lost their data (the $235,000 rent should still be there, ready to be edited)
4. Long-press the rent bill → EDIT BILL → change amount to "2350.00" → submit. Live preview shows "$2,350.00" while typing. After save, bill list shows "$2,350" (formatCentsShort hides .00).
5. Long-press a bill → DELETE BILL → confirm → bill disappears from list
6. Add a new bill via ADD BILL using decimal entry — works correctly
7. Mark a bill paid via the new MARK PAID form — date defaults to today, amount defaults to expected, can edit both — submit → balance debits by the actual amount paid
8. Account balance displays show formatCentsShort (no .00 on round numbers)
9. Recent Activity section visible on Household and Personal — last 10 transactions for that zone
10. Long-press a transaction → EDIT → change amount → balance reflects the change
11. Long-press a transaction → DELETE → confirm → transaction disappears, balance reverts
12. Settings still works (or doesn't crash if minimal — Settings full build is Session 5)
13. Metro logs clean. No red error screens.

== STOPPING POINT ==

When all 13 testing items pass, STOP. Tell me to test, await my confirmation. After I confirm, commit to Git with message:

```
Session 2.5 complete - schema upgrade, decimal input, edit/delete bills + transactions
```

…and push.

If anything fails — read the actual error and fix it. Don't loop. If 3 attempts fail on the same issue, stop and report exactly what's failing and what you've tried.

Begin with **Step 0 (Survey)**. Wait for confirmation before editing.
