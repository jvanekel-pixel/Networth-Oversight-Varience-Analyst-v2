Read SESSION_6_POSTBUILD_AUDIT.md at the project root for full project context.

The audit is complete. All findings have been reviewed and confirmed. Proceed directly to implementation. Do not re-audit. Do not report findings again.

Below are the confirmed findings and exact fix locations. Work through all seven phases in order. Commit after each phase. Do not combine phases.

---

## CONFIRMED FINDINGS — IMPLEMENT EXACTLY AS DESCRIBED

### PAYCHECK SPLIT BUG — TWO LOCATIONS
1. useStore.js line ~100–104: initialState.novaConfig.paycheckSplits is a hardcoded 3-split array. Change to [].
2. useStore.js line ~1438: completeOnboarding() does paycheckSplits.length > 0 ? paycheckSplits : get().novaConfig.paycheckSplits — this means a wizard-passed [] falls through to the hardcoded default. Change to always write the wizard-provided value unconditionally, regardless of length.

### HOUSEHOLD TAB — NOT GATED
App.js MainTabs: Household tab has no visibility guard. Business tab already has {entrepreneurMode && ...} pattern — apply same pattern to Household tab: {(userMode === 'partnered' && hasSharedAccount) && ...}
hasSharedAccount = accountRegistry.some(a => a.role === 'household' && a.isActive !== false)

### HOUSEHOLD SCREEN — HARDCODED ELEMENTS (all ungated)
Every item below must be either gated on userMode === 'partnered' OR refactored to read from registry:
- Line 240–254: Joint Checking balance card — hardcoded accounts.jointChecking + label "JOINT CHECKING"
- Line 361–395: Recent Activity — hardcoded filter t.accountKey === 'jointChecking'
- Line 397–406: Floor warnings — hardcoded w.accountKey === 'jointChecking'
- Line 221: handleTxSubmit — hardcoded log to 'jointChecking'
- Line 226: handleEditBalance — hardcoded update to 'jointChecking'
- Lines 466, 473, 484: AddBillModal, MarkPaidModal, EditBillModal — all pass accountOptions=[{key:'jointChecking', label:'JOINT CHECKING'}] hardcoded
- Lines 276–324: Grocery Budget card — always renders regardless of userMode
- Lines 326–358: Household Bills card — always renders regardless of userMode
- Lines 361–395: Recent Activity — always renders regardless of userMode
Correctly gated already: Partner Deposit card (line 257) — do not touch.

### PERSONAL SCREEN — HARDCODED ACCOUNTS
- Lines 10–17: ACCOUNT_LABELS const and PERSONAL_ACCOUNTS array drive all account card rendering. Both must be removed and replaced with a dynamic read from accountRegistry filtered to role === 'personal' and isActive !== false.
- Line 100: AccountCard label reads ACCOUNT_LABELS[accountKey] — replace with account.displayName from registry
- Line 178: personalWarnings filter uses PERSONAL_ACCOUNTS hardcoded array — replace with registry ids
- Lines 246–256: Loop over PERSONAL_ACCOUNTS.map() — replace with loop over active personal-role registry accounts
- Lines 286–288: duplicate hardcoded personal accounts array for activity filter — replace with registry
- Line 300: ACCOUNT_LABELS[tx.accountKey] — replace with registry lookup by id
- Line 380: ACCOUNT_LABELS[w.accountKey] — replace with registry lookup by id
- Line 199: reads incomeEvents.paycheckAmount (deprecated) — replace with paycheckAmountCents
- Lines 270–277: Distribution preview reads legacy distribution store object with hardcoded labels — replace entirely with novaConfig.paycheckSplits, resolve account names from registry by accountId in each split row
- Add "not configured" empty state when novaConfig.paycheckSplits === []
- Lines 442–478: AddBillModal, MarkPaidModal, EditBillModal — all pass hardcoded accountOptions — replace with dynamic registry read

### ACCOUNT CLASSIFICATION GAPS
- DashboardScreen.js line 57: showHousehold = accountRegistry.length === 0 || accountRegistry.some(...) — the length === 0 branch incorrectly shows Household card for all new users. Remove that branch. showHousehold must require BOTH userMode === 'partnered' AND at least one active household-role account exists.
- CalendarScreen.js line 40: getIncomeEventsBetween called missing accountRegistry (4th arg) and userMode (5th arg) — add both args
- CalendarScreen.js lines 45, 49, 50–56: three hardcoded 'jointChecking' references for red-day projection — replace with dynamic lookup of active household-role account from registry, or skip if none exists
- forecasting.js line 341: b.defaultAccountKey || 'jointChecking' — orphaned bill keys must not silently fall through to jointChecking. Replace fallback with null. If defaultAccountKey resolves to null or is not found in registry, skip that bill in variance calculation and do not treat it as household.

### FORMULA — REMAINING HARDCODED KEYS IN forecasting.js
- Line 45: || 'jointChecking' — remove fallback or replace with registry lookup
- Lines 90–91: PROFILE_ACCOUNTS_FALLBACK — audit whether these can be removed now that registry is authoritative
- Lines 121–122: fallbacks 'entChecking' and 'jointChecking' — replace with registry lookup by role
- Line 184: default param groceryAccountKey = 'jointChecking' — replace with dynamic lookup of household-role account from registry
- Line 341: || 'jointChecking' — confirmed above, replace with null + skip

### MODAL ACCOUNT PICKERS — ALL CALLERS PASS HARDCODED OPTIONS
All callers of AddBillModal, MarkPaidModal, EditBillModal in both HouseholdScreen and PersonalScreen pass hardcoded accountOptions arrays. The fix is in the callers, not the modals:
- HouseholdScreen callers: build accountOptions dynamically from registry filtered to role === 'household'
- PersonalScreen callers: build accountOptions dynamically from registry filtered to role === 'personal'
- LogMassageIncomeModal lines 83–88: destination account picker hardcoded to 'cash' and 'entChecking' with labels "Cash" and "ENT Checking" — replace with dynamic registry read filtered to role === 'personal', isActive !== false
- LogMassageIncomeModal line 41: paymentMethod auto-routing hardcoded to 'entChecking' — replace with first active personal-role checking account from registry, or null if none

---

## IMPLEMENTATION PHASES

### PHASE 1 — Data Layer [T1]
- Fix useStore.js initialState.novaConfig.paycheckSplits to []
- Fix completeOnboarding() line 1438 to write wizard paycheckSplits unconditionally
- Fix forecasting.js: all 5 hardcoded key locations listed above
- Fix forecasting.js line 341: orphaned bill key fallback → null + skip
- Fix CalendarScreen.js line 40: add missing accountRegistry and userMode args to getIncomeEventsBetween
- Fix CalendarScreen.js lines 45, 49, 50–56: replace 3 hardcoded 'jointChecking' references

Commit: "Phase 1 — paycheck split bug fix + forecasting hardcoded key removal"

---

### PHASE 2 — Navigation and Tab Gating [T1]
- App.js: add Household tab visibility guard matching the existing Business tab pattern
  Condition: userMode === 'partnered' AND accountRegistry has at least one active role === 'household' account
- DashboardScreen.js line 57: fix showHousehold — remove length === 0 branch, require partnered + shared account
- Add safe empty state to HouseholdScreen for solo users who reach it directly (deep link / stale nav state):
  Render a single centered card: "Household tracking is for partnered mode. Enable it in Settings → Profile."

Commit: "Phase 2 — household tab gating + dashboard zone card fix"

---

### PHASE 3 — Household Screen Refactor [T1]
- Replace all 8 ungated/hardcoded elements listed in findings above
- All account reads → registry lookup of active household-role account (get first, or null if none)
- All accountOptions passed to modals → built dynamically from registry
- All hardcoded 'jointChecking' string references → resolved account id from registry
- Grocery Budget card, Bills card, Recent Activity, Floor warnings: gate on userMode === 'partnered'
- handleTxSubmit and handleEditBalance: resolve target account from registry by role, not hardcoded key
- If no household-role account exists: all balance cards show "—" with "Add a shared account in Settings" CTA

Commit: "Phase 3 — Household screen registry reads + solo gating"

---

### PHASE 4 — Personal Screen Refactor [T1 logic, T2 components]

[T1] Remove ACCOUNT_LABELS const and PERSONAL_ACCOUNTS array entirely from PersonalScreen.js
[T1] Replace all account card rendering with dynamic loop over getActiveAccountsByRole('personal') from store
[T1] Replace all hardcoded label reads with account.displayName from registry
[T1] Fix all activity and warning filters to use registry ids instead of hardcoded key arrays
[T1] Fix line 199: paycheckAmount → paycheckAmountCents
[T1] Replace distribution preview (lines 270–277) with novaConfig.paycheckSplits read + registry name resolution
[T1] Add "not configured" empty state when paycheckSplits === []
[T1] Fix all AddBillModal / MarkPaidModal / EditBillModal callers to build accountOptions from registry

[T2] AccountBalanceCard component
   Props: account (registry object), floorCents, onEditBalance, onLogTransaction
   Renders: account.displayName, formatted balance, floor indicator bar, edit + log buttons
   No hardcoded strings. All labels from props.

[T2] PayCycleSummaryCard component
   Props: paycycleConfig, paycheckSplits, accountRegistry
   Renders: next payday date, one row per split (resolved displayName + amount), total
   Empty state: "Paycheck split not configured — set up in Settings" when paycheckSplits === []

Commit: "Phase 4 — Personal screen dynamic accounts + pay cycle card"

---

### PHASE 5 — Modal Account Picker Cleanup [T2 component, T1 wiring]

[T2] AccountPickerSheet component
   Props: roleFilter (array of role strings), onSelect, label
   Reads: accountRegistry from store, filters to isActive !== false and role in roleFilter
   Renders: scrollable list of account.displayName items, returns selected account id
   Empty state: "No accounts configured for this category — add one in Settings"

[T1] Replace hardcoded destination picker in LogMassageIncomeModal (lines 83–88) with AccountPickerSheet roleFilter={['personal']}
[T1] Fix LogMassageIncomeModal line 41: auto-routing hardcoded 'entChecking' → first active personal checking account from registry

Commit: "Phase 5 — AccountPickerSheet + modal picker cleanup"

---

### PHASE 6 — Paycheck Split Wizard Step + Settings Entry Point [T2 scaffold, T1 wire]

[T2] OnboardingPaycheckSplitScreen.js
   - Shown only when wizard income step was Predictable (not Irregular, not Skip)
   - Reads accounts from wizard state with role 'personal' or 'household'
   - One row per account: displayName label + dollar amount input
   - Running total vs paycheck amount from income step
   - Copy: "Doesn't add up? No problem — adjust this anytime in Settings."
   - Skip → writes [] to wizard state
   - Next → writes splits array to wizard state (not store yet)

[T2] PaycheckSplitSheet component for Settings
   - One editable row per split: resolved account displayName + amount input
   - Add row: opens AccountPickerSheet filtered to personal + household roles
   - Remove row: X per entry
   - Running total display
   - Save button

[T1] Insert OnboardingPaycheckSplitScreen into OnboardingStack after OnboardingIncomeScreen
[T1] Pass paycheckAmountCents from wizard income state as prop for running total
[T1] Include paycheckSplits in completeOnboarding() payload
[T1] Wire PaycheckSplitSheet into SettingsScreen under Pay Cycle Configuration
[T1] Empty state: "Paycheck split not configured — Tap to set up" when paycheckSplits === []
[T1] Configured state: summary of current splits + Edit button

Commit: "Phase 6 — paycheck split wizard step + settings entry point"

---

### PHASE 7 — Device Test Pass [T1]

Run all scenarios on Pixel 8 Pro. Report pass/fail for each.

FRESH INSTALL — SOLO:
[ ] Wizard completes → Dashboard
[ ] Household tab not visible
[ ] Personal screen shows only wizard-configured accounts with user-chosen names
[ ] No hardcoded "ENT Checking", "ENT Savings", "Venmo" labels visible anywhere
[ ] Pay Cycle card shows "not configured" if income was skipped
[ ] Pay Cycle card shows correct splits if configured
[ ] Log transaction → balance updates → Personal card updates

FRESH INSTALL — PARTNERED:
[ ] Household tab visible
[ ] Household screen shows shared account by user-chosen name
[ ] Partner deposit card visible
[ ] Dashboard Household card visible

FRESH INSTALL — ENTREPRENEUR OFF:
[ ] Business tab not visible

PAYCHECK SPLIT:
[ ] Full AsyncStorage clear → Settings shows "not configured", no stale split data
[ ] Skip splits in wizard → paycheckSplits === [] in store confirmed
[ ] Configure splits in wizard → Pay Cycle card shows correct data
[ ] Edit splits in Settings → Pay Cycle card updates

ACCOUNT REMOVAL SAFETY:
[ ] Archive personal savings account → no crash in Personal screen or forecasting
[ ] Archive checking account with bills → bills show warning, no crash in Calendar or forecasting
[ ] Switch Partnered → Solo in Settings → Household tab hides immediately

EXISTING USER MIGRATION:
[ ] Simulate by clearing only registry key, keeping nova_v2_accounts → migration runs → all balances preserved → wizard skipped

Metro logs clean. No red screens. No unhandled promise rejections.

Commit: "Session 6A complete — full audit fixes confirmed on device"

---

Do not open any files in an external editor. Terminal only.
Project directory: C:\Projects\nova-v2\