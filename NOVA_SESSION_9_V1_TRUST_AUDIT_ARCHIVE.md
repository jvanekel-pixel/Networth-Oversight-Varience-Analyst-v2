# NOVA Session 9 V1 Trust Audit Archive

Date: 2026-05-04

## Purpose

This session was a V1 trust pass over a large feature batch that was implemented from a copied list of finance-app gaps. The focus was not adding another big surface area. It was checking that the new systems are reachable from UI, included in backup/import where appropriate, aligned with card ordering, and consistent in the math that drives NOVA's finance guidance.

## Feature Batch Covered

- Receipt photo attachments: camera/image/file picker support, local sandbox storage, per-transaction viewing, receipt cards, and backup/export/import inclusion.
- CSV / OFX / QFX / QIF statement import: file picker, parsing, duplicate flags, import preview, learned description-to-category rules, and transaction creation.
- Multiple savings goals: settings management, scope/home-tab assignment, linked account progress, dashboard and tab cards.
- Android widgets and quick-log paths: widget config plugin, multiple widget sizes, widget snapshot sync, quick-log deep links, notification action, and app entry modal.
- Biometric / PIN app lock: local authentication, 4/6 digit PIN options, lock gate, background/foreground relock behavior, and secret stripping in backup exports.
- Split transactions: two-line max split UI, signed total validation, account/category assignment, and split metadata.
- Recurring non-bill transactions: generic recurring items by scope, reminders/notifications, cards, and forecast integration.
- Spending trends: 6/12-month reporting support in charts.
- Encrypted backups: passphrase-based AES-GCM backup wrapping and decrypt-on-import flow, with plaintext export still available if encryption is off.
- Reconciliation: formal account reconciliation records with date, statement balance, app balance, adjustment option, and history.
- Configurable cash-flow forecast: dashboard/personal/household forecast card with 30/60/90-day horizon and card-order visibility.

## Audit Fixes Made

- Fixed a math mismatch where recurring transactions were included in cash-flow forecasts but not in profile variance.
- Added recurring transaction events to yellow/red floor scans so a scheduled expense can trigger the same risk state the forecast already showed.
- Improved floor-dip annotation so recurring-caused dips name the recurring item instead of looking like an unnamed projection.
- Included business-scoped recurring items in business monthly variance.
- Made savings goal, grocery, scheduled income, and business savings cards consistently available in card-order sheets even before the user has data in them.
- Added a household scheduled income empty state so an enabled but empty card does not render as a blank panel.
- Added the business savings-goals card to the business detail screen, matching the saved business card-order contract.
- Let the variance card move like other cards in the reorder sheet. Defaults still place it first, but the UI no longer advertises a card as reorderable while pinning it.
- Updated Settings > Display copy so it no longer says card order/show-hide controls are future V2 work.
- Changed savings-goal progress bars so 0% renders as 0%, not a tiny optimistic sliver.
- Hardened the Expo Go crypto resolver path by pinning Noble packages and importing the required AES/PBKDF2/SHA modules from installed package files.

## Card Order Contract

All four card-order systems now use stable default card lists:

- Dashboard: variance, cash-flow forecast, charts, savings goals, recurring items, quick actions, badges, recent activity.
- Personal: variance, cash-flow forecast, spending chart, spending categories, account balances, pay cycle, recurring items, savings goals, bills, grocery, receipt photos, recent activity.
- Household: variance, cash-flow forecast, spending chart, spending categories, shared account, scheduled income, recurring items, savings goals, grocery, bills, receipt photos, recent activity.
- Business: variance, spending chart, spending categories, savings goals, recurring items, business summary, tax records, receipt photos, income, expenses, mileage.

Receipt photo cards remain visible by default for Business and hidden by default for Personal/Household, matching the original request. They can be enabled from each screen's card-order control.

## Verification

- Focused utility smoke: recurring expenses now reduce variance and forecast totals; recurring floor dips name the recurring item; split expenses preserve exact signed totals across two lines.
- `npx expo export --platform android --output-dir .expo-export-smoke --clear`: passed. Android bundle completed with 1,212 modules.
- Android dev bundle endpoint: `http://localhost:8083/index.bundle?platform=android&dev=true&minify=false` returned HTTP 200.
- `npx expo-doctor`: passed 17/17 checks.
- `git diff --check`: no whitespace errors; only existing Windows LF-to-CRLF warnings.

Temporary export output was removed after verification.

## Operational Notes

- Expo Go can load the JavaScript bundle, but Android home-screen widgets and the Quick Settings tile are native/plugin features. They require a prebuild/dev client/EAS build to appear on a real Android launcher.
- The repository remains intentionally dirty from the larger feature batch. No unrelated files were reverted during this audit.
- This archive summarizes the whole chat's implementation and audit work; it is not a substitute for real-device finance QA before store release.
