You are extending the NOVA app from Session 1 into Session 2. The project at C:\Projects\nova-v2\ is a working Expo scaffold with onboarding, 5 stub tabs, persistent header, and theme/personality config files. Session 1 is committed to Git. Do not modify the scaffold structure — extend it.

== YOUR JOB IN SESSION 2 ==

Make the HOUSEHOLD and PERSONAL tabs functional. Wire transaction logging end-to-end. Implement the bi-weekly pay distribution and rollover sweep. Implement the partner deposit scheduled event. Implement the grocery budget weekly tracker. Wire NOVA flavor text reactions to financial events. Add spending floor alerts.

Do NOT touch the BUSINESS tab logic, the badge system beyond placeholders, the export/import system, or the notification system. Those are Session 3 and 4. Stub screens for those tabs remain stubs.

== ENVIRONMENT — DO NOT REGRESS ==

- AsyncStorage stays ^2.0.0
- All storage keys keep nova_v2_ prefix
- newArchEnabled stays false in app.json
- All money stays integer cents
- Math.floor for display, never Math.round
- All colors / fonts / copy come from theme.config.js or personality.config.js. Never hardcode.

== STATE ADDITIONS TO useStore.js ==

Extend the Zustand store with these actions (in addition to what already exists):

- logTransaction({ accountKey, amountCents, category, description, paymentMethod, timestamp }) — appends to transactions, updates accounts[accountKey] balance, sets lastActivityAt to Date.now(), persists, then triggers a NOVA flavor text rotation. amountCents is signed (negative for expenses, positive for income).
- distributePaycheck(grossAmountCents) — performs the rollover sweep first (move all remaining entChecking → entSavings as a logged transaction labeled "Rollover Sweep"), then distributes grossAmount per current distribution config (entSavings, venmo, entChecking). Each move logged as its own transaction. Award XP for rollover (+50) only if rollover amount > 0. Update lastActivityAt.
- recordPartnerDeposit(amountCents) — logs an income transaction to jointChecking, sets partnerDepositReceived true for the current month, awards XP (+10). 
- addHouseholdBill({ name, amountCents, dueDay }) — appends to householdBills, persists.
- addPersonalBill({ name, amountCents, dueDay }) — appends to personalBills, persists.
- markBillPaid(billId, accountKey) — logs a transaction debiting the specified account, awards XP (+5).
- updateGroceryBudget({ weeklyLimitCents }) — sets the weekly limit. On a fresh week (weekStartDate older than current week), reset currentWeekSpend to 0 and update weekStartDate via getCurrentWeekStart().
- logGrocerySpend(amountCents) — adds amount to currentWeekSpend, also triggers logTransaction against jointChecking with category 'grocery'. Check if currentWeekSpend stays under weeklyLimit at week-end (Sunday rollover — handle via lazy check on next interaction).
- checkSpendingFloors() — for each account in accountFloors, if balance < floor + 20% threshold, push a warning to a transient state.warnings array. Components read this and surface it.
- rotateFlavorTextForEvent(eventType) — for now, just calls rotateFlavorText(personality.starterPool). Architecture for event-specific pools comes in V2 of NOVA personality (not this build). Event types: 'transaction', 'rollover', 'partner_deposit', 'grocery_warning', 'floor_warning'.

All actions must persist relevant keys to AsyncStorage immediately. State writes must go through Zustand set/get — never direct mutation.

== HOUSEHOLD SCREEN — REPLACE STUB ==

Render in this order:

1. Header strip: "HOUSEHOLD" title (theme.accent, fontSizeXL), subtitle "Joint Accounts + Bills" (theme.textSecondary)

2. Joint Chase Checking card — show formatted balance via formatCentsShort(). Below balance, three buttons: LOG INCOME, LOG EXPENSE, EDIT BALANCE. Each opens a modal.
   - LOG INCOME / LOG EXPENSE modal: numeric pad input (digit-only via parseCentsInput), category dropdown (Income: Paycheck, Partner Deposit, Other / Expense: Rent, Utilities, Grocery, Other), description text input, submit button. Submit calls store.logTransaction with correct sign on amount.
   - EDIT BALANCE modal: decimal input via parseBillInput, submit calls store.updateAccountBalance.

3. Partner Deposit status card — shows the expected deposit date for the current month (call getPartnerDepositDate(year, month)) and partnerDepositReceived state. If not yet received and the expected date is past, show warning styling (theme.statusWarning). If received, show check + theme.statusPositive. Button "RECORD DEPOSIT" — opens a confirm dialog with the expected amount pre-filled, on confirm calls store.recordPartnerDeposit.

4. Grocery Budget card — shows weeklyLimit, currentWeekSpend, and percentage. Bar that fills as spend approaches limit. Color shifts: green under 60%, yellow 60-95%, red over 95%. Button "LOG GROCERY SPEND" — modal with amount input, on submit calls store.logGrocerySpend.

5. Bills section — list of householdBills sorted by dueDay. Each row: name, amount via formatCents, due day (e.g. "Due 15th"), MARK PAID button (if not yet marked for current month). ADD BILL button at bottom of section opens add-bill modal.

6. Spending floor warning section — only renders if state.warnings has any entries for jointChecking. Render in theme.statusWarning styling.

== PERSONAL SCREEN — REPLACE STUB ==

Render in this order:

1. Header strip: "PERSONAL" title, subtitle "Personal Accounts + Pay Cycle"

2. Four account cards in a vertical stack — ENT Checking, ENT Savings, Venmo, Cash. Each card: account name, balance via formatCentsShort, three buttons (LOG INCOME, LOG EXPENSE, EDIT BALANCE) with same modal pattern as Household. Floor indicator (small text "Floor: $X" in theme.textDim).

3. Pay Cycle card — shows: paycheckAmount (formatCents), nextPaycheckDate (formatDate), and a preview of the next distribution: "Next paycheck distribution: $X → ENT Savings, $Y → Venmo, $Z → ENT Checking, $W rollover sweep". Button "RECORD PAYCHECK" — opens a confirm dialog with the gross amount editable, on confirm calls store.distributePaycheck.

4. Spending floor warning section — renders if any personal account has triggered a warning.

5. Recurring subscriptions section — list of personalBills. Same pattern as Household bills section.

== NOVA HEADER UPDATE ==

In NovaHeader.js, the flavor text auto-rotates to a new starter pool line every time logTransaction, distributePaycheck, recordPartnerDeposit, or logGrocerySpend fires. This is already partially handled by store.rotateFlavorTextForEvent. Verify the header re-reads currentFlavorText from the store on every state change (Zustand subscriber pattern — should be automatic if useStore is set up correctly).

The Confirm Balance button on the header still works as in Session 1, no changes there.

== MODALS — IMPLEMENTATION NOTES ==

Use React Native's built-in Modal component. Style:
- Backdrop: rgba(0,0,0,0.7)
- Modal panel: theme.backgroundPanel, padding theme.spacingLG, border theme.borderColor, radius theme.radiusLG
- Title in theme.accent, fontSizeLG
- Inputs in theme.backgroundCard with theme.borderColorDim border, padding theme.spacingMD, color theme.textPrimary
- Submit button: theme.accent background, theme.background text
- Cancel button: transparent, theme.textSecondary

Use isSubmitting boolean guards on all submit handlers — disable the button while a write is in flight. This prevents double-fire.

Numeric input for cents: keyboardType="numeric", parse with parseCentsInput. Show formatted preview below the field (e.g. user types "4750", below shows "$47.50").

Decimal input for balance edits: keyboardType="decimal-pad", parse with parseBillInput.

== TESTING REQUIREMENTS ==

Before saying you're done, verify on the Pixel via Expo Go:

1. Onboarding still renders and advances correctly (no regression)
2. All 5 tabs still render without errors
3. Household tab: log a $25 income to Joint Checking, balance updates, transaction appears (we'll add the Log tab in a future session — for now just verify state via console.log if needed)
4. Personal tab: record a $1000 paycheck, verify rollover sweep happens, distribution lands correctly across ENT Savings/Venmo/ENT Checking
5. Grocery card: set a weekly limit of $200, log a $30 grocery spend, see the bar progress
6. Partner deposit: tap RECORD DEPOSIT, verify state updates and balance reflects
7. Add a household bill, mark it paid, see balance debit
8. NOVA flavor text in header changes after each major event
9. No red error screens. No yellow warning banners. Metro logs clean.

If anything fails, read the actual error and fix it. Do not ask me to interpret stack traces.

== STOPPING POINT ==

When all 9 testing items pass, STOP. Tell me to test, then await my confirmation. After I confirm, commit to Git with message "Session 2 complete - household + personal zones functional" and push.

If we hit any error you cannot resolve in 3 attempts, stop and report exactly what's failing and what you've tried. Don't loop.

Begin.