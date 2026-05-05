Read NOVA_V6_DEVPROMPT.A.md at the project root for full project context before beginning.

Do not write any code yet. This is a full-system audit. Read every file listed below, report all findings, then wait for confirmation before implementing anything.

---

## CONTEXT

The onboarding wizard has been built. The following issues have been identified on first run. This audit must confirm every one of them, find additional issues in the same category, and produce a complete fix plan before a single line is changed.

---

## AUDIT SCOPE

---

### 1 — POST-ONBOARDING ROUTING

**Issue:** After completing the wizard, the user should land on DashboardScreen. Confirm the current behavior.

Read App.js:
- What screen does completeOnboarding() route to?
- Is the OnboardingStack replaced by MainStack immediately on completion, or is there a stale navigator state that could route to a non-Dashboard screen first?
- Does the MainStack default to Dashboard as its initial route?

Flag anything that could cause the user to land on a screen other than Dashboard after finishing the wizard.

---

### 2 — HOUSEHOLD TAB — SOLO MODE VISIBILITY

**Issue:** If the user selected Solo during onboarding, the Household tab is obsolete. It must be hidden.

Read App.js and the bottom tab navigator:
- Is the Household tab conditionally rendered based on userMode?
- If not, identify exactly where in the navigator the tab is registered so it can be gated.

Read HouseholdScreen.js:
- List every UI element that assumes a partner or joint account exists:
  - Partner deposit card
  - Partner funding progress
  - Joint account balance display
  - Any "waiting for partner" states
  - Any variance logic that references a shared/joint account
- For each element, confirm whether it is already gated on userMode === 'partnered' or not.

Define the correct behavior:
- userMode === 'solo': Household tab is hidden from the bottom navigator entirely. No empty screen, no placeholder.
- userMode === 'partnered' but no shared account configured: Household tab is visible but shows an empty state with a CTA to add a shared account in Settings.
- userMode === 'partnered' with a shared account: Full Household screen renders as designed.

---

### 3 — PERSONAL SCREEN — HARDCODED ACCOUNT AUDIT

**Issue:** PersonalScreen.js is displaying ENT Checking, ENT Savings, and Venmo by name. These are legacy hardcoded values. After the wizard, the screen must display only the accounts the user created, using the names they chose.

Read PersonalScreen.js in full:
- List every hardcoded account reference: string literals like 'entChecking', 'entSavings', 'venmo', 'cash', and any display strings like "ENT Checking", "ENT Savings", "Venmo".
- List every place balances are read from the old nova_v2_accounts flat object instead of nova_v2_account_registry.
- List every picker, label, or card that renders a fixed account name instead of account.displayName from the registry.
- Identify the Pay Cycle card — where does it read its data from? Is it hardcoded amounts, or does it read from paycheckSplits config?
- Identify any variance/floor calculations that reference a specific account key instead of looking up by id.

Read useStore.js:
- Confirm that nova_v2_account_registry is the authoritative source for account data going forward.
- Confirm that nova_v2_accounts (old flat object) is only kept for migration and is not written to after migration runs.

---

### 4 — ACCOUNT CLASSIFICATION SYSTEM AUDIT

**Issue:** For the variance engine and Personal screen to work dynamically, every account must have a role and type that drives which UI zone it appears in and how it participates in forecasting.

Read nova_v2_account_registry entries (from useStore.js defaults and migration output):
- Confirm the following role values are defined and used consistently:
  - 'primary' — day-to-day checking, appears in Personal
  - 'savings' — savings/buffer account, appears in Personal
  - 'digital' — Venmo/Cash App/digital wallet, appears in Personal
  - 'cash' — physical cash, appears in Personal
  - 'shared' — joint/partner account, appears in Household
  - 'business' — LLC or side hustle account, appears in Business
  - 'excluded' — tracked balance but not included in variance or zone display
  - 'credit' — debt/credit account, tracked but handled separately

Read forecasting.js:
- For each zone (household, personal, business), confirm that computeProfileVariance selects accounts by role, not by hardcoded key.
- Confirm that archived accounts (isActive: false) are excluded from all variance calculations.
- Confirm that accounts with role 'excluded' are excluded from variance but still readable for balance display.
- Confirm that a user with zero accounts of a given role returns a safe neutral state, not a crash.

Read DashboardScreen.js:
- Confirm zone cards are rendered based on whether any active accounts exist for that role group.
- If no 'primary'/'savings'/'digital'/'cash' accounts exist, Personal card should show empty state.
- If no 'shared' accounts exist OR userMode is 'solo', Household card must be hidden.
- If entrepreneurMode is false, Business card must be hidden.

---

### 5 — PAY CYCLE CARD AUDIT

**Issue:** The Pay Cycle card in PersonalScreen shows hardcoded or static paycheck data. It must reflect only what the user configured during onboarding or in Settings.

Read PersonalScreen.js — Pay Cycle card section:
- What data source does it read from? (paycheckSplits? paycycleConfig? hardcoded?)
- Does it show a "not configured" state if paycheckSplits is empty?
- Does it show the correct next paycheck date from paycycleConfig.nextPaycheckDate?
- Does it show the correct split amounts from paycheckSplits, using account displayName from the registry rather than hardcoded names?

Read useStore.js:
- Confirm paycheckSplits default is [] (empty array), not a pre-filled array.
- Confirm paycycleConfig default has null for nextPaycheckDate and no hardcoded amounts.
- Confirm distributePaycheck() reads paycheckSplits dynamically and resolves account names from the registry.

---

### 6 — FULL FORMULA / VARIANCE SAFETY AUDIT (carried from previous prompt)

Read forecasting.js in full. For every exported function, check:

a) NULL SAFETY
   - What happens if accountRegistry is empty? Returns safe default or throws?
   - What happens if a bill references an accountId that no longer exists in the registry?
   - What happens if paycheckSplits is []? Does distributePaycheck crash or skip cleanly?
   - What happens if groceryBudget.weeklyLimitCents is null or undefined?

b) HARDCODED KEY REFERENCES
   - Flag any remaining: 'jointChecking', 'entChecking', 'entSavings', 'venmo', 'cash', 'cleaningChecking'
   - Flag any remaining dollar amounts that should come from config (grocery $200, floor $300, etc.)

c) DESELECTION SAFETY — confirm each scenario degrades gracefully:
   - User archives their only savings account: comma_club badge check, savings goal display, forecasting
   - User archives a checking account with bills assigned to it: CalendarScreen, forecasting dip scan
   - User turns off entrepreneurMode: Business tab hidden, forecasting skips business zone
   - User switches Partnered → Solo: partner deposit notification skipped, HouseholdScreen hidden, forecasting skips partner income

d) BILL ASSIGNMENT SAFETY
   - Bills created during onboarding are assigned to an accountId from the registry.
   - If that account is later archived, the bill must render with a warning state (not crash).
   - forecasting.js must skip bills whose assigned account is not found in the registry.

---

### 7 — PAYCHECK SPLIT PERSISTENCE BUG (carried from previous prompt)

After a full AsyncStorage reset, paycheckSplits data reappears in Settings.

Read useStore.js — initStore() function:
- Is the default config object written fresh when nova_v2_config is absent from storage?
- Or is it merged with partial stale data?
- Is paycheckSplits defaulting to a hardcoded array instead of []?

Find the root cause and document it precisely.

---

### 8 — MODAL AND PICKER AUDIT

Read every modal component that contains an account picker or account dropdown:
- LogTransactionModal
- EditBalanceModal
- LogMassageIncomeModal (or LogBusinessIncomeModal if refactored)
- LogCleaningIncomeModal
- LogBusinessExpenseModal
- LogCleaningMileageModal
- PaycheckModal
- Any bill add/edit modal

For each:
- Is the account list read from nova_v2_account_registry filtered to isActive: true?
- Is the display name shown as account.displayName, not a hardcoded string?
- If the registry is empty, does the picker show an empty state or crash?

---

## REPORT FORMAT

After reading all files, report findings in this exact format before touching anything:

---
POST-ONBOARDING ROUTING:
[what completeOnboarding routes to, any issue found]

HOUSEHOLD TAB — SOLO MODE:
[is tab currently gated, list of ungated partner UI elements in HouseholdScreen]

PERSONAL SCREEN — HARDCODED ACCOUNTS:
[list every hardcoded reference found, file and line]

ACCOUNT CLASSIFICATION:
[confirm roles are consistent, flag any gaps in forecasting.js or DashboardScreen.js]

PAY CYCLE CARD:
[data source confirmed, list any hardcoded values found]

FORMULA SAFETY:
[null-safety gaps, hardcoded keys remaining, deselection scenarios that would crash]

PAYCHECK SPLIT BUG:
[root cause — exact location in useStore.js]

MODAL AUDIT:
[list any modal still using hardcoded account references]

READY TO IMPLEMENT: YES / NO
[if NO, describe what is still unclear]
---

After reporting, wait for explicit confirmation before writing any code.

---

## IMPLEMENTATION PLAN (execute after audit confirmed)

Work through all phases in order. Do not skip ahead. Commit after each phase.

---

### PHASE 1 — Data Layer Fixes [T1 — Claude Code handles all of this]

- Fix paycheckSplits default to [] in useStore.js
- Fix initStore() config initialization — write full default object, never merge stale keys over missing defaults
- Confirm nova_v2_accounts flat object is read-only after migration (no new writes)
- Add getAccountById(id) and getActiveAccountsByRole(role) selectors to store if not already present
- Add safe fallback to every forecasting.js function for empty registry, missing accountId, null config values
- Fix any remaining hardcoded account key references in forecasting.js
- Fix grocery hardcoded $200 — wire to groceryBudget.weeklyLimitCents from store

Commit: "Phase 1 — data layer null-safety + hardcoded key removal"

---

### PHASE 2 — Navigation and Tab Visibility [T1]

- App.js: gate Household tab on userMode === 'partnered' AND at least one account with role 'shared' exists
- App.js: gate Business tab on entrepreneurMode === true
- App.js: confirm MainStack initial route is DashboardScreen
- App.js: confirm completeOnboarding() routes to Dashboard immediately (no stale navigator state)
- DashboardScreen.js: render zone cards dynamically — Personal card only if active personal-role accounts exist, Household card only if shared-role accounts exist AND partnered, Business card only if entrepreneurMode true

Commit: "Phase 2 — dynamic tab visibility + post-onboarding routing"

---

### PHASE 3 — Personal Screen Refactor [T1 for logic, T2 for UI components]

[T1] Remove all hardcoded account references from PersonalScreen.js
[T1] Replace with dynamic render loop over getActiveAccountsByRole(['primary','savings','digital','cash'])
[T1] Each account card shows: account.displayName, account.balanceCents, account.floorCents
[T1] Variance calculation per account reads from registry by id, not hardcoded key
[T1] Pay Cycle card: reads paycycleConfig.nextPaycheckDate and paycheckSplits from store
[T1] Pay Cycle card: shows "Paycheck split not configured — set up in Settings" if paycheckSplits is []
[T1] Pay Cycle card: resolves account names from registry by accountId in each split row
[T2] AccountBalanceCard component — receives account object as prop, renders displayName + balance + floor indicator
[T2] PayCycleSummaryCard component — receives paycycleConfig + paycheckSplits + accountRegistry as props, renders next payday + split rows or empty state CTA

Commit: "Phase 3 — Personal screen dynamic accounts + pay cycle card"

---

### PHASE 4 — Household Screen Refactor [T1]

- Gate all partner-specific UI on userMode === 'partnered'
- If userMode === 'solo' and somehow user reaches HouseholdScreen: render full empty state with "Switch to Partnered in Settings to enable shared account tracking"
- Partner deposit card: hidden if userMode === 'solo'
- Funding progress bar: hidden if userMode === 'solo'
- All account balance displays: read from registry by role 'shared', not hardcoded 'jointChecking'
- forecasting.js household variance: reads accounts with role 'shared' from registry
- If zero shared accounts in registry: household variance returns neutral green state, not crash

Commit: "Phase 4 — Household screen partner gating + registry reads"

---

### PHASE 5 — Modal and Picker Cleanup [T2 for components, T1 for wiring]

[T2] Shared AccountPickerSheet component — receives role filter array as prop, reads from registry, shows only isActive: true entries, returns selected account id — reusable across all modals
[T1] Replace hardcoded account pickers in all modals listed in Audit Section 8 with AccountPickerSheet
[T1] Confirm empty-picker state: if no accounts match the role filter, show "No accounts configured — add one in Settings"

Commit: "Phase 5 — dynamic account picker across all modals"

---

### PHASE 6 — Paycheck Split Wizard Step + Settings Entry Point [T2 scaffold, T1 wire]

[T2] OnboardingPaycheckSplitScreen.js
   - Shown only if user selected Predictable income in OnboardingIncomeScreen
   - Displays accounts from wizard state with role primary, savings, shared
   - One input row per account: account displayName label + dollar amount input
   - Running total display vs paycheck amount from income step
   - "Doesn't add up? Adjust anytime in Settings." copy
   - Skip button — leaves paycheckSplits as []
   - Next button — saves splits to wizard state, not store yet

[T1] Insert OnboardingPaycheckSplitScreen into OnboardingStack after OnboardingIncomeScreen
[T1] Pass income amount from wizard state as prop for running total comparison
[T1] Include paycheckSplits in completeOnboarding() payload write

[T2] PaycheckSplitSheet component for Settings
   - One editable row per split: account displayName + amount input
   - Add row button (shows account picker filtered to personal + shared roles)
   - Remove row button per entry
   - Running total display
   - Save button

[T1] Wire PaycheckSplitSheet into SettingsScreen under Pay Cycle Configuration
[T1] Show "Paycheck split not configured — Tap to set up" if paycheckSplits is [] 
[T1] Show current split summary with Edit button if paycheckSplits has entries

Commit: "Phase 6 — paycheck split wizard step + settings entry point"

---

### PHASE 7 — Full Device Test Pass [T1]

Run every scenario below on Pixel 8 Pro. Report pass/fail for each before closing.

FRESH INSTALL — SOLO MODE:
[ ] Wizard completes → Dashboard appears
[ ] Household tab is not visible
[ ] Personal screen shows only wizard-configured accounts with user-chosen names
[ ] Pay Cycle card shows "not configured" if income was skipped
[ ] Pay Cycle card shows correct data if income was configured
[ ] Log transaction → account balance updates → Personal card updates
[ ] Add bill → appears in Calendar → forecasting updates

FRESH INSTALL — PARTNERED MODE:
[ ] Household tab is visible
[ ] Household screen shows shared account balance
[ ] Partner deposit card visible
[ ] Dashboard shows Household zone card

FRESH INSTALL — ENTREPRENEUR MODE OFF:
[ ] Business tab not visible

FRESH INSTALL — ENTREPRENEUR MODE ON:
[ ] Business tab visible
[ ] BusinessSelectorScreen shows wizard-configured businesses
[ ] BusinessDetailScreen renders for selected business

ACCOUNT REMOVAL SAFETY:
[ ] Archive savings account in Settings → no crash in forecasting, no crash in Personal screen
[ ] Archive checking account with bills → bills show warning state, no crash in Calendar or forecasting
[ ] Switch Partnered → Solo in Settings → Household tab hides, no crash

PAYCHECK SPLIT:
[ ] Full AsyncStorage clear → Settings shows "not configured", no stale split data
[ ] Configure split in wizard → appears correctly in Settings and Pay Cycle card
[ ] Edit split in Settings → Pay Cycle card updates

EXISTING USER MIGRATION:
[ ] App update simulation (nova_v2_accounts present, no registry) → migration runs → all balances preserved
[ ] Wizard skipped → Dashboard shows legacy account names from migration

Metro logs clean. No red screens. No unhandled promise rejections.

Commit: "Phase 7 — full audit fixes confirmed on device. V1 system complete."

---

Do not open any files in an external editor. Terminal only.
Project directory: C:\Projects\nova-v2\