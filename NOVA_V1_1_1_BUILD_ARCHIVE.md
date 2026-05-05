# NOVA V1.1.1 Build Archive

Date: 2026-05-05

## Purpose

This archive captures the complete NOVA V1.1.1 APK build cycle. V1.1.0 was the first successful personal-use APK install. V1.1.1 focused on removing rough/incomplete features, strengthening backups, improving business receipt tracking, fixing savings-goal/account linking, improving text readability, and adding a responsive-layout foundation for broader Android device testing.

## Final Build

- App: `nova-v2`
- Display name: `N.O.V.A`
- App version: `1.1.1`
- Android versionCode: `2`
- EAS profile: `preview`
- Distribution: internal APK
- Final build commit: `7338913 Add responsive layout foundation`
- Main V1.1.1 feature commit: `1a9b789 Prepare Nova V1.1.1 APK`

APK:

- Final first-round testing APK: https://expo.dev/artifacts/eas/gT8Y42DbGsRJ8mbEAaqGKd.apk
- Final build page: https://expo.dev/accounts/copper_felix/projects/nova-v2/builds/809cebf1-30a7-460e-995e-025eea7f307a

Earlier V1.1.1 APK before responsive layout pass:

- APK: https://expo.dev/artifacts/eas/3ofpFhu4v992z1MLqZ89DZ.apk
- Build page: https://expo.dev/accounts/copper_felix/projects/nova-v2/builds/134d8507-94b2-4b19-87ac-dbf6447461e3

Previous V1.1.0 APK:

- APK: https://expo.dev/artifacts/eas/douaTXdfCBABTp2bVEF3xr.apk
- Build page: https://expo.dev/accounts/copper_felix/projects/nova-v2/builds/6451633a-fba8-4d03-a0bf-f72b93e9e1ff

## User Direction

The user requested V1.1.1 after using V1.1.0 for about 12 hours. Priorities were:

- Remove backup encryption entirely.
- Focus backups on real-time and automatic backups saved to a dedicated location.
- Remove `Upcoming Recurring Items` unless there was a strong reason to keep it.
- Split `Entertainment/Dining Out` into separate default category buttons.
- Review and improve Business receipts so photos can be added/viewed and tied into business records.
- Fix savings goals linked to savings accounts so the goal card reflects the linked account balance.
- Improve low-contrast gray text used for controls like `edit`.
- Build another APK.
- Add a responsive layout pass so APK installs on different Android devices stay clean.

## Major Changes

### 1. Backup Encryption Removed

Backup encryption was removed from the user-facing product and dependency stack.

Completed behavior:

- Removed backup encryption settings section.
- Removed backup passphrase/import passphrase UI.
- Deleted `src/utils/backupCrypto.js`.
- Deleted `src/components/settings/BackupEncryptionSection.js`.
- Removed `@noble/ciphers` and `@noble/hashes`.
- Simplified Metro config by removing custom crypto package aliases.
- JSON backup exports are plain import-ready NOVA backups.
- Existing encrypted backup envelopes now show a clear unsupported message on import.
- Backup manifests no longer reference encrypted backups.

Primary files:

- `src/hooks/useExport.js`
- `src/components/ExportPanel.js`
- `src/screens/SettingsScreen.js`
- `src/store/useStore.js`
- `src/utils/exportUtils.js`
- `metro.config.js`
- `package.json`
- `package-lock.json`

### 2. Dedicated Backup Folder + Real-Time Backups

Backups were moved toward a more realistic automatic-backup model.

Completed behavior:

- Settings now includes backup-folder selection using Android Storage Access Framework.
- Manual, scheduled, and real-time JSON backups can write to the selected folder.
- If automatic export runs without a chosen folder, it falls back to app document storage.
- Auto-export schedule now includes `Real-time`.
- Real-time backup attempts are throttled to about once per minute.
- Ledger-changing actions trigger the auto-export check.

Primary files:

- `src/hooks/useExport.js`
- `src/screens/SettingsScreen.js`
- `src/store/useStore.js`

Important note:

- This is a first practical backup foundation, not cloud sync. It stores files locally using Android permissions/folders.

### 3. Recurring Items Surface Removed

The generic `Upcoming Recurring Items` card and prompt were removed from the main product surfaces.

Completed behavior:

- Removed `RecurringTransactionsCard`.
- Removed generic recurring-item card from Dashboard, Personal, Household, and Business card orders.
- Removed Calendar recurring dots/events.
- Removed generic transaction-modal prompt that asked to add Bill/Subscription expenses to recurring calendar tracking.
- Removed recurring-item notification copy.
- Cash-flow forecast no longer includes generic recurring transactions in rendered forecast cards.

Primary files:

- `src/components/RecurringTransactionsCard.js`
- `src/components/TransactionModal.js`
- `src/screens/DashboardScreen.js`
- `src/screens/PersonalScreen.js`
- `src/screens/HouseholdScreen.js`
- `src/screens/BusinessDetailScreen.js`
- `src/screens/CalendarScreen.js`
- `src/components/CashFlowForecastCard.js`
- `src/config/notifications.config.js`
- `src/store/useStore.js`

Important note:

- Some underlying recurring transaction utilities/state handlers remain for backward compatibility with existing stored data and forecast internals. The user-facing generic recurring item feature is removed.

### 4. Spending Categories Split

`Entertainment/Dining Out` was split into separate categories.

Completed behavior:

- Default spending suggestions now include `Entertainment` and `Dining Out`.
- Theme category colors separate Entertainment and Dining Out.
- Category aliases normalize old `Entertainment/Dining Out` and restaurant/dining terms to `Dining Out`.
- Quick log routes dining words to `Dining Out` and entertainment words to `Entertainment`.

Primary files:

- `src/utils/spendingCategories.js`
- `src/config/theme.config.js`
- `src/utils/quickLog.js`

### 5. Business Receipt Path Improved

Business receipt functionality already existed, but the entry points were not obvious enough.

Completed behavior:

- Business income and expense rows now show `ADD RECEIPT` or receipt photo counts.
- Hint copy explains that tapping saved rows opens receipt camera/upload handling.
- Business income/expense receipt attachments remain tied to source transactions and business records.
- Business receipt card remains available for receipt browsing.

Primary files:

- `src/screens/BusinessDetailScreen.js`
- `src/components/ReceiptAttachmentsCard.js`
- `src/store/useStore.js`
- `src/utils/receiptFiles.js`

### 6. Savings Goal Account-Link Fix

The savings goal bug was traced to linked goals keeping a stale manual `currentCents: 0`. Linked goals now derive their current balance from the selected savings account instead of the manual value.

Completed behavior:

- Linked savings goals use account balance as the progress source.
- Manual current balance remains available for unlinked goals.

Primary files:

- `src/utils/savingsGoals.js`
- `src/components/SavingsGoalsCard.js`
- `src/components/settings/SavingsGoalSection.js`

### 7. Text Visibility Pass

Low-contrast gray text was lightened globally.

Completed behavior:

- `textSecondary`, `textDim`, and `muted` were brightened.
- Edit/action labels using these theme tokens are more visible in bright environments.

Primary file:

- `src/config/theme.config.js`

### 8. Responsive Layout Foundation

After V1.1.1 initial APK, the user requested a layout strategy for different Android devices. A first responsive pass was added before the final first-round testing APK.

Completed behavior:

- Added central responsive layout utilities.
- Added `ScrollScreen` for shared safe-area, bottom padding, centered content, and max-width behavior.
- Added `ResponsiveGrid` for breakpoint-aware wrapping grids.
- Updated Dashboard, Personal, Household, Business, Settings, Reports, and Business Selector screens to use the shared screen shell.
- Updated Dashboard variance cards to use responsive grid layout.
- Fixed Calendar runtime sizing by replacing module-load `Dimensions.get()` cell sizing.
- Updated BarChart to use responsive runtime width.
- Made Cash Flow Forecast header and metric rows adapt on narrow or large-font screens.

Primary files:

- `src/layout/responsive.js`
- `src/layout/ScrollScreen.js`
- `src/layout/ResponsiveGrid.js`
- `src/screens/DashboardScreen.js`
- `src/screens/PersonalScreen.js`
- `src/screens/HouseholdScreen.js`
- `src/screens/BusinessScreen.js`
- `src/screens/BusinessSelectorScreen.js`
- `src/screens/SettingsScreen.js`
- `src/screens/ReportsScreen.js`
- `src/screens/CalendarScreen.js`
- `src/components/CashFlowForecastCard.js`
- `src/components/charts/BarChart.js`

## Screenshot Test Matrix

Added:

- `APK_SCREENSHOT_TEST_MATRIX.md`
- `scripts/capture-apk-screenshots.ps1`

Purpose:

- Define device/window classes to test.
- Define required APK screenshots for major screens/states.
- Provide ADB commands for installing APKs, changing font scale, and capturing screenshots.
- Give pass/fail criteria for text overlap, system bar overlap, calendar cell behavior, chart bounds, modal scrolling, touch target size, and wide-screen content caps.

## Verification Performed

Before V1.1.1 feature APK:

- `npx expo-doctor`
- `npx expo export --platform android --output-dir .expo\v111-export-check`
- `npx expo export --platform android --output-dir .expo\v111-export-check-2`
- `git diff --check`
- `npm audit --audit-level=high`
- EAS Android preview build

Before responsive-layout APK:

- `npx expo-doctor`
- `npx expo export --platform android --output-dir .expo\responsive-layout-export-check`
- `npx expo export --platform android --output-dir .expo\responsive-layout-export-check-2`
- `git diff --check`
- `npm audit --audit-level=high`
- EAS Android preview build

Results:

- Expo Doctor passed 17/17 checks.
- Android production export/bundling passed.
- Diff whitespace check passed.
- High-severity audit passed.
- EAS builds finished successfully.

Audit note:

- `npm audit --audit-level=high` still reports 4 moderate PostCSS advisories through Expo tooling. The offered npm fix requires `npm audit fix --force` and would install an incompatible/breaking Expo version, so it was intentionally not applied during this APK patch.

## EAS Build Notes

The first V1.1.1 EAS build remained queued for a long time under the Free plan. After upgrading EAS from Free to Basic, the queued build moved to `IN_PROGRESS` and finished.

Final first-round testing build:

- Build ID: `809cebf1-30a7-460e-995e-025eea7f307a`
- Status: `FINISHED`
- Priority: `HIGH`
- App version: `1.1.1`
- Android build version: `2`
- Commit: `733891382768872d7543cb7d504bf1e7ac349dc5`
- APK: https://expo.dev/artifacts/eas/gT8Y42DbGsRJ8mbEAaqGKd.apk

## Git State

Relevant commits:

- `7338913 Add responsive layout foundation`
- `1a9b789 Prepare Nova V1.1.1 APK`
- `b0d6459 Fix Android project name for EAS`
- `aadaa6c Link EAS project`

The final V1.1.1 testing APK was built from commit `7338913`.

## Known Remaining Risks / Follow-Up

- Responsive layout foundation is in place, but the APK screenshot matrix still needs to be executed across actual or emulated Android devices.
- Onboarding screens were documented in the screenshot matrix but were not deeply refactored during this responsive pass.
- Some older fixed heights and dense row layouts remain in lower-risk cards/components.
- Generic recurring transaction data handlers remain in the store for compatibility, even though the user-facing generic recurring feature was removed.
- Backup automation writes local files; cloud/remote sync is not implemented.
- Backup folder behavior should be tested on at least Samsung and Motorola devices because OEM file pickers can differ.

## Suggested Next Session

Run first-round V1.1.1 APK testing using `APK_SCREENSHOT_TEST_MATRIX.md`, especially:

- Samsung large phone
- Motorola phone
- narrow emulator
- font scale 1.3
- Calendar day sheet
- Settings backup folder flow
- Business receipt camera/gallery flow
- Savings goal linked-account progress

If screenshots reveal layout drift, fix through `src/layout` primitives first whenever possible.
