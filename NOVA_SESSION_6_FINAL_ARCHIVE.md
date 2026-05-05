# NOVA Session 6 Final Archive

Date: 2026-05-03

This archive summarizes the final V1 beta-prep work completed in this session so the next chat can continue without re-auditing from zero.

## Current State

NOVA is an Expo/React Native offline-first finance app focused on cash-flow survival math, manual tracking, gamification, and tax/bookkeeper-friendly exports.

The worktree is intentionally very active. Do not assume all modified files were changed in one step, and do not revert user or prior-session work. `rg` is blocked on this machine with an access-denied error, so PowerShell `Get-ChildItem | Select-String` was used for search.

Last verification command:

```powershell
npx expo export --platform android
```

Result: passed. Android bundle exported to `dist`.

## Major Completed Work

### Ledger Reconciliation

- Grocery edit/delete now reconciles the paired ledger transaction and account balance.
- Paid bills require a resolved account and create a real debit transaction.
- Generic business income and expenses now move cash through accounts and create/edit/delete paired transactions.
- Business transaction edit/delete paths sync back to generic business records.
- Generic business mileage remains P&L/tax tracking only and does not move cash.

### Business Identity Cleanup

- User-facing business workflows now use setup-created businesses instead of hardcoded massage/cleaning labels.
- Business detail screens use generic business income, expenses, mileage, account routing, edit/delete, and long-press correction flows.
- Calendar, search, charts, reports, and exports were moved away from hardcoded `cleaningChecking` and legacy massage/cleaning assumptions.
- Legacy massage/cleaning code may still exist for migration/history, but active V1 UX should be setup-driven.

### Business Tax-Prep UI

Business CSV exports already had tax-prep columns, and the UI was updated to collect the matching data:

- Income: vendor/client/source, category, amount, account, date, notes.
- Expense: vendor/payee, category, deductible yes/no, amount, account, date, notes/receipt.
- Mileage: client/purpose, category, deductible yes/no, miles, date, notes.
- Non-deductible mileage exports with `Deductible? = No` and zero mileage deduction.
- Business tracking remains customizable through Settings/Business Mode: income, expenses, mileage, and default money account.

### Export/Import

- Rebuilt exports around real V1 data instead of legacy-only business arrays.
- Added scope choices: all data, household backup, business backup, account CSV, business CSVs.
- Added import-ready JSON backups with schema/scope validation.
- Tightened import validation to NOVA storage keys.
- Added export manifests with export date, app version, scope, included files, column explanations, and offline/no-login/manual-records language.
- Added user-facing portability language: data stays on-device, JSON backups import into NOVA, CSVs open anywhere.
- Added manual backup reminder in Settings/Data.
- Business CSVs include clearer columns: Vendor/Client, Category, Deductible?, Notes, Business ID, Account, Transaction ID, Mileage Deduction, cents columns.

### Forecasts, Search, Calendar, NOVA State

- Transaction search account filters now come from the account registry.
- Calendar business projection no longer points at `cleaningChecking`.
- Forecast variance scans all profile accounts rather than only the first account.
- NOVA state dominance was made safer so red/yellow risk can override stale special states.
- Empty profiles should no longer read as healthy green.

### Gamification / Badge UI

- Earlier in this session, badge/gamification work from stages 1-4 was reviewed and wired into the app.
- Badge visuals/icons, NOVA face/state behavior, and badge progress surfaces were part of the broader final pass.
- Post-payday action completion now uses the reward path instead of bypassing XP/badge progress.

### Static vs Dynamic Bills

New bill logic added:

- Bills can be marked as static or dynamic.
- Static bills auto-post the expected amount once the due date has arrived, during app open/foreground checks.
- Dynamic bills keep reserving the expected amount in forecasts until the user confirms the actual paid amount.
- Dynamic bill payment modal title says `CONFIRM BILL AMOUNT PAID`.
- Forecast math now uses the expected amount for unpaid bills, not last month’s paid amount, so a weird utility bill does not distort the next cycle.
- Add/edit bill modals include a static amount toggle and helper text.
- Onboarding bill entry includes the static amount toggle.

Important behavior: switching or adding a bill as static will not immediately back-post an already-past due date in the current month; the static auto-post start month is advanced to the next cycle when needed.

### Grocery Weekly Variance

New grocery framing added:

- Grocery weekly limit remains a forecast reserve.
- Logged grocery transactions are the actuals.
- On weekly rollover, NOVA closes the previous grocery week and records:
  - week start/end
  - limit
  - actual spend
  - variance
  - under/over/even status
- Grocery card now shows a `LAST WEEK` under/over indicator.
- Grocery closeout history is persisted in `nova_v2_grocery_history`.
- Household backup/export/import includes grocery history.

## Important Files Touched Recently

- `src/store/useStore.js`
- `src/utils/forecasting.js`
- `src/components/TransactionModal.js`
- `src/components/GroceryBudgetCard.js`
- `src/hooks/useExport.js`
- `src/utils/exportUtils.js`
- `src/screens/HouseholdScreen.js`
- `src/screens/PersonalScreen.js`
- `src/screens/BusinessDetailScreen.js`
- `src/screens/CalendarScreen.js`
- `src/screens/TransactionSearchScreen.js`
- `src/screens/onboarding/OnboardingBillsScreen.js`
- `src/components/settings/AboutSection.js`
- `src/screens/ReportsScreen.js`
- `MONEY_MOVEMENT_REGRESSION_CHECKLIST.md`

## Known Human Test Checklist Before APK Beta

Run these manually in Expo Go:

1. Add a dynamic bill, mark it paid for a different actual amount, confirm account balance and variance update correctly.
2. Add a static bill due today or tomorrow, confirm auto-post behavior after due date/app foreground.
3. Edit a bill from dynamic to static and confirm it does not back-post an old due date unexpectedly.
4. Log grocery spend under weekly limit, simulate/observe week rollover, confirm last-week indicator.
5. Edit/delete grocery entries and confirm ledger/account balance follow.
6. Add business income/expense/mileage with category, notes, deductible toggle, then export business CSVs.
7. Export all JSON, import it, and verify bills, grocery history, business records, accounts, and transactions return.
8. Open Calendar and Transaction Search for household/personal/business profiles and verify account registry routing.
9. Confirm NOVA state turns yellow/red when risk is present and does not stay green due to stale special states.

## Notes For Next Chat

- Do not revert broad existing changes in the dirty worktree.
- Search with PowerShell-native `Select-String` unless `rg` is fixed.
- The app currently builds via Expo export, but the next pass should be hands-on Expo Go QA.
- The next likely milestone is Android Studio/APK preparation after the manual checklist passes.
