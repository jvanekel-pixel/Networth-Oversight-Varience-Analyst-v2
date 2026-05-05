# NOVA Session 10 Onboarding + Transaction Cohesion Archive

Date: 2026-05-04

## Purpose

This archive captures the long UI/behavior polish thread after the V1 trust audit. The main goal was to make NOVA feel coherent as a product instead of a pile of useful cards: transaction logging needed profile-aware account selection, recurring bills/subscriptions needed to connect to categories/calendar/charts, onboarding needed to become a real NOVA terminal-style introduction, and small trust-breaking display/runtime bugs needed to be removed quickly.

The user direction for this session was very specific: keep the app exact in the engine, clearer in the UI, profile-separated across Household / Personal / Business, and more flavorful without trapping users in wizard friction.

## Major Work Covered

### 1. Transaction Account Routing

The Log Income and Log Expense flows were aligned with Transfer Between Accounts so users can choose the account affected by a transaction.

Completed behavior:

- Log Income can choose which account receives the income.
- Log Expense can choose which account pays the expense.
- Household, Personal, and Business stay scoped to their own account/profile options.
- Split transactions include account assignment on split lines.
- Split math must reconcile before submit.
- Transaction submission preserves the exact signed cents math.

Primary files:

- `src/components/TransactionModal.js`
- `src/screens/HouseholdScreen.js`
- `src/screens/PersonalScreen.js`
- `src/screens/BusinessDetailScreen.js`
- `src/utils/splitTransactions.js`
- `src/store/useStore.js`

### 2. Bills, Subscriptions, Recurring Items, and Spending Categories

Bills and Subscription were treated as durable system categories and connected into the broader spending/category/calendar/charts behavior.

Completed behavior:

- Bill and Subscription categories are hard-coded system categories.
- The app standardizes on singular `Subscription` language where appropriate.
- Bill and Subscription appear in spending category availability without requiring a user to create them manually.
- Logging an expense as Bill or Subscription can prompt the user to add it to recurring/calendar tracking.
- Users can still log one-off subscriptions without creating a recurring item.
- Grocery was moved away from forced hard-coding and into available account/category selection so users decide what account(s) track groceries.
- Spending charts and category systems now use the same category concepts instead of drifting apart.

Primary files:

- `src/utils/spendingCategories.js`
- `src/components/SpendingCategoryManagerCard.js`
- `src/components/TransactionModal.js`
- `src/components/RecurringTransactionsCard.js`
- `src/utils/chartUtils.js`
- `src/store/useStore.js`

### 3. Auto-Post Model

Bill/subscription autopay language was replaced with `Auto-Post` and the behavior was aligned across setup, bill cards, manual payment, and automated posting.

Completed behavior:

- Static scheduled bills/subscriptions can be marked `Auto-Post`.
- Auto-Post off means the user must manually confirm/mark paid.
- Auto-Post on means the app posts the bill on schedule regardless of whether the user taps Mark Paid.
- Mark Paid remains visible and interactable even for Auto-Post items.
- Duplicate Mark Paid actions for an already auto-posted/paid item trigger a NOVA response without double-deducting.
- Start-up wizard includes the Auto-Post option.

Primary files:

- `src/store/useStore.js`
- `src/components/TransactionModal.js`
- `src/screens/HouseholdScreen.js`
- `src/screens/PersonalScreen.js`
- `src/screens/onboarding/WelcomeScreen.js`
- `src/screens/onboarding/OnboardingBillsScreen.js`

### 4. Color and Dashboard Visual Audit

The user flagged Grocery and Income as visually too similar on the calendar/dashboard. The color system was audited and expanded so calendar dots, chart slices, and dashboard views are easier to scan.

Completed behavior:

- Calendar/category colors were made more distinct.
- Income, grocery, bill, subscription, recurring, transfer, business, and profile colors were separated.
- Color categories are intended to stay readable even in dashboard-wide views.
- A color-map toggle concept was added so tracking dots/categories can be turned off for visual filtering.

Primary files:

- `src/config/theme.config.js`
- `src/screens/CalendarScreen.js`
- `src/components/SpendingChartsSection.js`
- `src/components/charts/DonutChart.js`
- `src/utils/chartUtils.js`

### 5. Cash-Flow Forecast Trust Pass

The user asked what the red `-$75.55` on the forecast card meant because the calendar did not show a matching negative day. The forecast card was reviewed as a trust/communication issue, not just a math issue.

Clarified behavior:

- The red number is a net delta over the selected forecast horizon, not a literal negative account balance.
- The low metric is the lowest projected account balance.
- Red styling on the delta can feel alarming when the account never goes negative, so this remains a UX clarity area if the wording/tone needs more polish.

Primary files:

- `src/components/CashFlowForecastCard.js`
- `src/utils/forecasting.js`

### 6. Terminal-Style Start-Up Wizard

The start-up wizard was rebuilt around NOVA as a terminal/chat personality instead of a standard form wizard.

Completed behavior:

- Opening experience starts on a black terminal-style screen.
- NOVA types an introduction with a blinking cursor and delayed pacing.
- NOVA uses the N.O.V.A. identity: Net-Worth Oversight Variance Analyst.
- The script avoids directly framing itself around money when possible and leans into numbers, math, signal, discipline, and convergence.
- User language was made more inclusive: Household is about shared/joint accounts, not relationship status.
- Users can escape setup and handle configuration manually in Settings.
- Answers remain editable rather than forcing delete/re-enter.
- Setup can branch for Personal, Household/shared, and Business/entrepreneur mode.
- After data collection, the wizard shows preview/tool surfaces using the numbers just entered.
- Preview order was adjusted so dashboard/chart/calendar views do not appear before the app has enough user-provided data to make them meaningful.
- Wizard panels were made more contained so setup happens on a single non-scrolling screen with scrollable inner boxes where needed.
- Terminal flavor text stays visually stable while input panels scroll.
- Processing copy was added to make NOVA feel like she is building the user's system from the collected data.

Notable NOVA tone targets:

- Glitchy but helpful.
- Slightly catty, not mean.
- Resistant to saying "money"; obsessed with "numbers."
- Funny during long full setup, especially when users enable business mode.
- Clear escape hatch for users who hate onboarding.

Primary files:

- `src/screens/onboarding/WelcomeScreen.js`
- `src/screens/onboarding/OnboardingAccountsScreen.js`
- `src/screens/onboarding/OnboardingIncomeScreen.js`
- `src/screens/onboarding/OnboardingBillsScreen.js`
- `src/screens/onboarding/OnboardingReviewScreen.js`
- `src/screens/OnboardingScreen.js`

### 7. Wizard Data Integrity

Several setup data issues were fixed so onboarding produces useful live state instead of demo-looking or red-only results.

Completed behavior:

- Household/shared setup prompts for scheduled non-personal income when Household is enabled.
- Household scheduled income can be added during onboarding.
- Recurring income Next Date uses a calendar picker instead of a typed date box.
- Paycheck split setup requires assigning the full paycheck amount.
- Split destinations must be accounts so the backend knows where projected income goes.
- Preview/demo panels use entered values instead of premature generic placeholders.
- If the user enters bills without income, the wizard surfaces the imbalance instead of pretending setup is complete.

Primary files:

- `src/screens/onboarding/WelcomeScreen.js`
- `src/components/DatePickerField.js`
- `src/store/useStore.js`

### 8. Household Scheduled Income and Recurring Card Cleanup

The Household screen needed scheduled income to be visible and editable because shared income is fundamental to Household forecasting.

Completed behavior:

- Household Scheduled Income card has an Add/Edit action.
- Existing scheduled income can be edited, confirmed, or removed.
- Household forecasting can include shared-account inflow.
- The ambiguous `Household Recurring Items` card was removed from active Household UI/card order because bills/subscriptions already cover the recurring scheduled-item purpose there.

Primary files:

- `src/screens/HouseholdScreen.js`
- `src/store/useStore.js`

### 9. NOVA Response Library Repair

The header response system briefly fell back to three dots because the runtime response path was unplugged or blocked by data shape mismatch.

Completed behavior:

- `NovaHeader` now falls back into the NOVA response picker instead of displaying only `...`.
- Onboarding completion can rotate into an onboarding-complete response.
- `novaResponseLibrary` now accepts both legacy badge arrays and object/map-shaped badge state.
- This fixed the Expo runtime crash: `(snapshot.badges || []).filter is not a function`.

Primary files:

- `src/components/NovaHeader.js`
- `src/utils/novaResponseLibrary.js`
- `src/utils/novaStateEngine.js`
- `src/store/useStore.js`

### 10. Expo Go Runtime Cleanup

The user reported Expo Go output with SDK 53/54 notification warnings and a runtime TypeError.

Completed behavior:

- Fixed the actual crash by hardening badge parsing in `novaResponseLibrary`.
- Removed stale `"newArchEnabled": false` from `app.json` so the New Architecture warning should clear.
- Noted that Android remote push notifications are limited in Expo Go and require a development build for full behavior.

Primary files:

- `src/utils/novaResponseLibrary.js`
- `app.json`

### 11. Balance Display Floor Formatting

The user noticed Chase_joint displayed `$666` after entering `665.55`. The engine was tracking exact cents correctly, but the large visual display needed to floor instead of round.

Completed behavior:

- Big account balance displays now use a whole-dollar floor formatter.
- `665.55` displays visually as `$665`, not `$666`.
- Exact cents remain preserved in state.
- `EDIT BAL` now opens pre-populated with the exact stored value, such as `665.55`, so the user knows what they are editing from.
- Settings account list also uses the non-decimal floor display for consistency.

Primary files:

- `src/utils/currency.js`
- `src/components/TransactionModal.js`
- `src/screens/HouseholdScreen.js`
- `src/screens/PersonalScreen.js`
- `src/components/settings/AccountsSection.js`

## Important Behavior Contracts

- Stored amounts are cents and must remain exact.
- Large account balance visuals should floor whole dollars when cents are hidden.
- Edit forms should show exact cents if they are editing an exact cents value.
- Household, Personal, and Business must not bleed account options into each other.
- Bill and Subscription are system spending categories.
- Grocery is user-selectable/available, not globally forced.
- Auto-Post is a scheduled posting behavior, not a reason to hide Mark Paid.
- Mark Paid should never double-deduct an already posted scheduled item.
- Wizard previews should use live setup values, not generic dashboard demos.
- NOVA response selection must tolerate old and new persisted state shapes.

## Verification Performed During Thread

Focused checks included:

- Babel transform checks for edited React Native files.
- `app.json` JSON parse check after config cleanup.
- `git diff --check` on the touched files, with only Windows LF-to-CRLF warnings.
- Formatter smoke confirming:
  - `formatCentsWholeFloor(66555)` returns `$665`.
  - `formatCentsInputValue(66555)` returns `665.55`.
  - `formatCentsShort(66555)` still returns `$665.55`.

## Current Operational Notes

- The worktree remains intentionally dirty from the larger feature and polish batch. Do not run destructive git cleanup commands.
- Expo Go can run most UI/debug flows, but Android remote push notification behavior requires a dev build.
- A real-device/manual QA pass is still important for onboarding pacing, Android date picker feel, nested scroll behavior, and Auto-Post timing.
- The next task should assume this session was about product cohesion and trust: numbers exact underneath, UI clearer on top, NOVA more present without blocking manual setup.

## Suggested Manual QA

- Run the full new-user onboarding flow for:
  - Personal only.
  - Household/shared with scheduled income.
  - Personal + Household.
  - Full Personal + Household + Business.
- Confirm setup can be exited and finished manually in Settings.
- Add multiple Household accounts and verify Log Income/Expense only shows Household accounts.
- Add multiple Personal accounts and verify Log Income/Expense only shows Personal accounts.
- Log a split expense across two accounts and confirm totals and balances.
- Add Bill and Subscription expenses and verify chart/category/calendar behavior.
- Add Auto-Post and manual scheduled items, then test Mark Paid before/after posting.
- Confirm a balance of `665.55` displays as `$665` on account cards and opens as `665.55` in Edit Balance.
