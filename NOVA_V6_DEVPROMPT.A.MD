## Session 6 Task Plan — Onboarding Wizard

### PHASE 1 — Store Foundation
[T1] Add onboardingComplete, userMode, entrepreneurMode to nova_v2_config defaults in useStore.js
[T1] Add nova_v2_account_registry: state array, KEYS entry, addAccount/editAccount/archiveAccount/getAccountById actions
[T1] Add nova_v2_businesses: state array, KEYS entry, addBusiness/editBusiness/archiveBusiness actions
[T1] Add nova_v2_spending_buckets: state array, KEYS entry, addBucket/editBucket/removeBucket actions
[T1] Write migrateToAccountRegistry() — maps 6 hardcoded keys to registry entries, sets onboardingComplete: true for existing users
[T1] Write migrateBusinessRegistry() — creates biz_legacy_massage and biz_legacy_cleaning entries
[T1] Call both migrations in initStore() behind a "registry already exists" guard
[T1] Refactor forecasting.js — replace all hardcoded account key references with registry lookup by legacyKey or id

### PHASE 2 — Wizard Screens (T2 scaffolding, T1 wiring)
[T2] WelcomeScreen.js — logo, tagline, single "Get Started" button
[T2] OnboardingUserModeScreen.js — Solo/Partnered two-card selector, Next button
[T2] OnboardingAccountsScreen.js — account list, Add Account bottom sheet (name, type, balance, floor inputs), Next/Skip
[T2] OnboardingIncomeScreen.js — Predictable/Irregular/Skip selector, conditional payday date + amount + frequency inputs
[T2] OnboardingBillsScreen.js — add bill rows (name, amount, due day, account picker), Add Another, Skip
[T2] OnboardingBucketsScreen.js — preset category chips, custom input, weekly/monthly toggle, Skip
[T2] OnboardingSavingsGoalScreen.js — four preset goal cards + custom input, Skip
[T2] OnboardingEntrepreneurScreen.js — enable toggle, business name input, track-field checkboxes, Add Another, Skip
[T2] OnboardingReviewScreen.js — summary list by section, Edit button per section, Finish CTA
[T1] Create OnboardingStack navigator in App.js with all 9 wizard screens registered
[T1] Wire App.js root: read onboardingComplete from store on load, render OnboardingStack or MainStack
[T1] Build wizard local state object accumulated across steps, written to store atomically on Finish
[T1] Wire completeOnboarding() to accept full wizard payload: writes accounts to registry, businesses to registry, config fields, bills, buckets, savings goal, paycheckSplits
[T1] Wire progress bar to step index. Wire Back and Skip on all steps.

### PHASE 3 — Conditional App UI
[T1] DashboardScreen.js — render zone cards from account registry roles, hide cards with no active accounts
[T1] HouseholdScreen.js — gate partner deposit card and funding progress on userMode === 'partnered'
[T1] BusinessSelectorScreen.js — read nova_v2_businesses registry, render one card per active business
[T1] Build BusinessDetailScreen.js — generic screen driven by business route param, renders Income/Expenses/Mileage sections conditionally on track* flags
[T1] App.js — hide Business tab when entrepreneurMode === false
[T1] notifications.js — skip partner deposit notification scheduling when userMode === 'solo'
[T1] forecasting.js — skip partner income projection when userMode === 'solo'

### PHASE 4 — Settings Additions
[T2] ProfileModeSection component — Solo/Partnered toggle with data-preserved warning
[T2] AccountsSection component — list accounts, edit/add/archive
[T2] SpendingBucketsSection component — list buckets, add/edit/remove
[T2] SavingsGoalSection component — edit target + account link
[T2] PartnerDepositSection component — enable toggle, amount input, day input
[T2] EntrepreneurModeSection component — enable toggle, list businesses, navigate to edit
[T2] BusinessEditSheet component — edit business name + track-field toggles
[T1] Mount all 7 new sections in SettingsScreen.js between existing sections — do not disturb current layout
[T1] Wire all section save handlers to correct store actions
[T1] Verify useExport.js includes cleaning income CSV — add nova_v2_cleaning_income export if absent
[T1] Fix grocery hardcoded $200 — wire all references to groceryBudget.weeklyLimitCents from store

### PHASE 5 — E2E Test Pass
[T1] Run full E2E test pass on Pixel 8 Pro per Session 5 outstanding checklist
[T1] Confirm migration on device: existing data intact, wizard skipped, all screens functional
[T1] git commit — "Session 6 complete - onboarding wizard + dynamic accounts + business registry + V1 E2E signed off"