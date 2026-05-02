## Context

Picking up Session 5 mid-stream. The following are already complete and working on device:
- src/config/notifications.config.js — notification copy + toggle config
- src/utils/notifications.js — scheduling helpers (trigger format fixed for SDK 53+)
- StatusBar hidden in App.js
- Three bugs fixed (faceColor, trigger format, status bar)

The opener routing rules are active. Work through all tasks below in order.
Do not stop between T2 items unless output is broken.
Commit message at the end: "Session 5 complete - notifications + exports + settings + polish - V1 SHIP READY"

---

## PART 1 — Notification Store Wiring [T1]

All T1. Cross-cutting logic that touches the store, app lifecycle, and scheduling.

[T1] Task 1 — lastActivityTimestamp
In src/store/useStore.js, find every call to logTransaction (all variants).
After each successful write, add:
  await AsyncStorage.setItem('nova_v2_last_activity', Date.now().toString());
Also expose a store action: getLastActivity() that reads and returns this value as a number.

[T1] Task 2 — Notification permission request
In App.js, on first mount (useEffect with empty dep array), call:
  import { requestPermissionsAsync } from 'src/utils/notifications.js'
Only request if permissions not already granted. Use expo-notifications
requestPermissionsAsync(). Store the result — do not re-request if already granted.
Read notifications.config.js for the enabled flag before requesting.

[T1] Task 3 — App open lifecycle checks
In App.js, after permissions check, add a second useEffect that fires on every app
foreground resume (use AppState from react-native). On resume, run these checks in order:

  CHECK A — Balance confirmation nudge
  Read nova_v2_last_activity. If more than 48 hours have passed AND
  notificationsConfig.balanceNudge.enabled is true, schedule a timeInterval
  notification using the copy from notifications.config.js balanceNudge.body.
  Only fire once per 48hr window — check a flag nova_v2_nudge_sent_at before scheduling.

  CHECK B — Partner deposit not received
  Read nova_v2_config for partnerDepositExpectedDay. If today >= that day
  and no partner deposit is logged this month (check nova_v2_transactions for
  a partnerDeposit entry with current month), and notificationsConfig.partnerDeposit.enabled
  is true, schedule a timeInterval notification with seconds: 5.

  CHECK C — Auto-export trigger
  Read nova_v2_export_config. If schedule is 'daily', check if last export was
  more than 24hr ago. If 'weekly', check 7 days. If either fires, call the export
  function from useExport.js (built in Part 2 below) silently in background.

[T1] Task 4 — Recurring scheduled notifications
Wire these three recurring notification types. Use expo-notifications
scheduleNotificationAsync with a CalendarTrigger for weekly/daily patterns.
Cancel and reschedule on every app open to avoid duplicates — use
cancelAllScheduledNotificationsAsync() first, then reschedule all enabled ones.

  WEEKLY VARIANCE SUMMARY — every Sunday at 19:00
  { type: 'calendar', weekday: 1, hour: 19, minute: 0, repeats: true }
  Copy from notificationsConfig.weeklySummary.body

  NOVA DAILY DISPOSITION — every day at configurable time (default 09:00)
  Read hour/minute from nova_v2_config.novaDailyTime (default { hour: 9, minute: 0 })
  { type: 'calendar', hour: configHour, minute: configMinute, repeats: true }
  Copy: pick randomly from notificationsConfig.dailyDisposition.pool array

  PAY CYCLE REMINDER — day before nextPaycheckDate at 18:00
  Read nextPaycheckDate from nova_v2_config. Compute the day before.
  { type: 'date', date: dayBeforePaycheck } — one-time, not repeating
  After paycheck is distributed (distributePaycheck action), reschedule for
  the next cycle. Copy from notificationsConfig.payCycleReminder.body

[T1] Task 5 — Bill due alert trigger
In src/store/useStore.js, find markBillPaid and the bills arrays.
On every app open (same AppState useEffect in App.js), loop through
all household and personal bills. For each unpaid bill:
  - Compute days until expectedDay in current month
  - If daysUntil <= 3 AND notificationsConfig.billDue.enabled is true:
    - Read projected balance from computeProfileVariance result
    - If projectedBalance < bill.amountCents, schedule a timeInterval
      notification: seconds: 10 (immediate-ish), with bill name in body
      using notificationsConfig.billDue.body template
  Deduplicate: store scheduled bill IDs in nova_v2_notified_bills (array of
  "billId-YYYY-MM" strings). Only schedule if not already in that array.

[T1] Task 6 — Spending floor warning trigger
In src/store/useStore.js, find logTransaction and updateAccountBalance.
After any balance update, check: if new balance < (floor * 1.20) and
notificationsConfig.spendingFloor.enabled is true, schedule a timeInterval
notification: { type: 'timeInterval', seconds: 3, repeats: false }
with account name and balance in body from notificationsConfig.spendingFloor.body.

[T1] Task 7 — Savings milestone trigger
In src/store/useStore.js, find the comma_club badge check location.
Immediately after the accounts.entSavings >= 100000 check that fires the badge,
also check: did entSavings just cross a new $1,000 threshold?
  const prevMilestone = Math.floor(prevBalance / 100000);
  const newMilestone = Math.floor(newBalance / 100000);
  if (newMilestone > prevMilestone && notificationsConfig.savingsMilestone.enabled)
    schedule notification with milestone amount in body.

---

## PART 2 — Export System

[T2] Task 8 — CSV utility functions
File: src/utils/exportUtils.js
Write pure utility functions (no React, no AsyncStorage):
  - accountTransactionsToCsv(transactions, accountKey)
    columns: Date, Description, Category, Amount (dollars), Balance After, Payment Method
    returns CSV string
  - massageIncomeToCsv(massageIncome)
    columns: Date, Amount, Payment Method, Destination, Notes
  - massageExpensesToCsv(massageExpenses)
    columns: Date, Amount, Category, Description
  - cleaningExpensesToCsv(cleaningExpenses)
    columns: Date, Amount, Category, Description, Tax Deductible, Receipt Note
  - cleaningMileageToCsv(cleaningMileage)
    columns: Date, Miles, Purpose, IRS Rate, Deduction Amount
  Each function: first row is header, subsequent rows are data, amounts formatted as
  dollar strings (divide cents by 100, toFixed(2)). Return empty string if no data.

[T1] Task 9 — useExport hook
File: src/hooks/useExport.js
Implement:

  exportFullJson()
  - Read ALL keys from AsyncStorage that start with 'nova_v2_'
  - Build object: { schemaVersion: 1, exportedAt: Date.now(), data: { key: value, ... } }
  - JSON.stringify the object
  - Write to a temp file using expo-file-system:
    FileSystem.documentDirectory + 'nova_backup_YYYY-MM-DD.json'
  - Share via expo-sharing: Sharing.shareAsync(fileUri)

  importFullJson(fileUri)
  - Read the file using expo-file-system
  - JSON.parse
  - Validate: must have schemaVersion === 1 and a data object with at least
    'nova_v2_accounts' and 'nova_v2_config' keys. If invalid, return { success: false, error: 'Invalid backup file' }
  - Write all keys back to AsyncStorage in a loop
  - Call store's initStore() to reload state
  - Return { success: true }

  exportAccountCsv(accountKey)
  - Read nova_v2_transactions from AsyncStorage
  - Filter to accountKey
  - Call accountTransactionsToCsv from exportUtils.js
  - Write to FileSystem.documentDirectory + accountKey + '_export.csv'
  - Share via Sharing.shareAsync

  exportBusinessCsv(type)
  - type: 'massageIncome' | 'massageExpenses' | 'cleaningExpenses' | 'cleaningMileage'
  - Read appropriate nova_v2_ key
  - Call matching CSV utility from exportUtils.js
  - Write + share same pattern as above

  scheduleAutoExport()
  - Called from App.js on open (Part 1 Task 3 CHECK C already calls this)
  - This is the implementation that check was referencing

  Return all functions from the hook.

---

## PART 3 — Full Settings Screen

[T1] Task 10 — Survey existing Settings screen
Read src/screens/SettingsScreen.js fully.
Report back: which sections exist, which are stubbed, what is missing.
Do not make any changes yet. Just report.

[T2] Task 11 — Account Floors section component
File: src/components/settings/AccountFloorsSection.js
Props: floors (object), onSave(accountKey, valueCents)
Render one row per account: jointChecking, entChecking, entSavings, venmo, cash
Each row: label + TextInput (decimal, formatted as dollars, saves on blur)
On blur: parse input to cents using parseBillInput, call onSave.
Use theme colors. No hardcoded hex values.

[T2] Task 12 — IRS Mileage Rate section component
File: src/components/settings/IrsMileageSection.js
Props: currentRate (number, cents per mile), onSave(newRateCents)
Render: current rate display + TextInput to edit + "Save" button
Note below field: "IRS standard mileage rate. Update annually (typically January)."
Parse input as float, multiply by 100, store as integer cents.

[T2] Task 13 — About section component
File: src/components/settings/AboutSection.js
No props needed.
Display: App name "N.O.V.A.", version "1.0.0", tagline from personality.config.js,
"Built by CFLX-01". Static component, no interactivity.

[T1] Task 14 — Assemble full Settings screen
In src/screens/SettingsScreen.js, build the complete screen from scratch or replace stub.
Sections in order:
  1. Account Floors — use AccountFloorsSection, read/write accountFloors from store
  2. Pay Cycle Configuration — verify this section is present from Session 3.5.
     If missing, add fields: frequency (picker: weekly/biweekly/monthly),
     nextPaycheckDate (date input), paycheckAmountCents (decimal input)
  3. Bill Schedule — verify present from Session 3.5. If present, keep as-is.
  4. Variance Thresholds — verify present from Session 3.5. If present, keep as-is.
  5. IRS Mileage Rate — use IrsMileageSection, read/write from nova_v2_config
  6. Notifications — one toggle row per notification type using Switch component.
     Read/write from notificationsConfig.js toggles via nova_v2_notification_prefs key.
     Add a time input row for NOVA Daily time (hour:minute).
  7. Export / Import — two primary buttons: "Export Backup (JSON)" and "Import Backup"
     Each calls useExport functions. Add sub-section "Export by Account" with
     one button per account. Add "Export Business Data" with four buttons.
     Auto-export schedule: picker (Off / Daily / Weekly / On Transaction > $100)
     Reads/writes nova_v2_export_config.
  8. About — use AboutSection

Wrap in ScrollView. Each section has a header label styled from theme.

---

## PART 4 — Polish Pass [T1]

[T1] Task 15 — Verify and fix logMassageIncome XP
Read src/store/useStore.js line ~852. Check XP awarded for logMassageIncome.
Dev plan says +10. If currently +5, change to +10 and log the change.

[T1] Task 16 — Grocery hardcoded $200
Search all files for hardcoded 200 in grocery-related context (weekly limit, budget display).
Replace all occurrences with a reference to store state: groceryBudget.weeklyLimit
(already stored in nova_v2_grocery_budget as integer cents).
If any component is reading a raw 200 literal for display or comparison, fix it.

[T1] Task 17 — grocery_discipline badge counter
In src/store/useStore.js, find checkCycleReset.
Add a new state field: groceryDisciplineStreak (integer, default 0) stored in
nova_v2_gamification alongside XP and badges.
On cycle reset (month boundary), read the last 4 weekly grocery entries.
If all 4 weeks had totalSpent < weeklyLimit, increment the streak. Otherwise reset to 0.
If streak >= 4 for the first time, call checkAndAwardBadge('grocery_discipline').

[T1] Task 18 — cycle_complete badge
In checkCycleReset, after processing the month boundary:
Read all bills (household + personal) for the closing month.
Check: were all active, non-deleted bills marked paid (paidDate is set)?
If yes, call checkAndAwardBadge('cycle_complete').

[T1] Task 19 — Confirm Balance glow
In src/components/NovaHeader.js, read nova_v2_last_activity on mount.
If more than 48 hours have passed since last activity:
  Apply a subtle pulsing glow to the Confirm Balance button.
  Use Animated.loop + Animated.sequence to pulse opacity between 1.0 and 0.6
  on a 1500ms cycle.
  Stop the animation and reset opacity after the user taps Confirm Balance.

[T1] Task 20 — Payday letter hardcoded amounts
Read src/config/personality.config.js. Find any dollar amounts hardcoded in the
payday letter strings ($990, $50, $150, $160, $314 or similar).
Replace each with a template reference: use a paydayLetterAmounts object in
nova_v2_config that stores those values, and update the personality config to use
a generatePaydayLetter(config) function that interpolates them.
If the amounts are constants that never change, move them to a named const in
personality.config.js instead of hardcoding in string bodies.

[T1] Task 21 — Onboarding nudge
Read the onboarding completion screen (find it in the navigator or screens folder).
After the completion message, add a conditional:
  Read nova_v2_bills_household and nova_v2_bills_personal from AsyncStorage.
  If both arrays are empty or missing, render a nudge below the completion text:
  "Add your bill schedule in Settings to unlock full variance forecasting."
  Style using theme.colorWarning or similar — not hardcoded.

[T1] Task 22 — OTA update configuration
In app.json, add under the expo key:
  "updates": { "enabled": true, "fallbackToCacheTimeout": 0 }
In eas.json (create if missing), add:
  { "build": { "production": { "channel": "production" } } }
Set runtimeVersion policy: in app.json add "runtimeVersion": { "policy": "sdkVersion" }
Do not change any other app.json values. Log exactly what was added.

[T1] Task 23 — Skin config audit
Run a search across all src/ files for any of these patterns:
  - Hex color literals: #[0-9a-fA-F]{3,6}
  - rgba( or rgb( values not coming from a theme variable
  - Hardcoded color strings like 'white', 'black', 'red', 'green', 'gray'
For each hit: determine if it should be moved to theme.config.js.
If yes: add the value to theme.config.js with a descriptive key, then replace
the hardcoded value in the source file with theme.thatKey.
Do not change values that are intentionally hardcoded (e.g. transparent, Platform checks).
Report a summary of all changes made.

---

## PART 5 — End-to-End Test Pass [T1]

[T1] Task 24 — Device test run
The app must already be running via npx expo start --tunnel on Pixel 8 Pro.
Walk through each flow below. For each one, check Metro logs for errors.
Report pass/fail per flow.

  1. Fresh install simulation — clear app data on device, reload, confirm onboarding appears
  2. Complete onboarding — confirm +25 XP, confirm variance cards show on Dashboard
  3. Log a transaction — confirm balance updates, variance updates, +10 XP
  4. Log a massage income entry — confirm balance credits entChecking or cash, +10 XP (after Task 15 fix)
  5. Log a cleaning mileage entry — confirm +2 XP
  6. Add a bill — confirm it appears in CalendarScreen dot, variance updates
  7. Mark a bill paid — confirm calendar reflects, +5 XP
  8. Trigger rollover sweep — confirm +50 XP, NOVA reacts
  9. Navigate all screens — Dashboard, Household, Personal, Business, BusinessSelector, Massage, Cleaning, Calendar, Settings — confirm no red screens
  10. Export backup JSON — confirm share sheet appears with correct filename
  11. Settings screen — confirm all 8 sections render, all toggles functional
  12. Confirm Balance button — trigger 48hr glow (manually set lastActivity to 3 days ago in AsyncStorage), confirm animation appears and stops on tap
  13. Metro logs after all flows — confirm no unhandled rejections, no red errors

If any flow fails: stop, fix, then resume the test pass from that step.

---

## SESSION CLOSE — Run after Task 24 passes

1. git add -A
2. git commit -m "Session 5 complete - notifications + exports + settings + polish - V1 SHIP READY"
3. Get-Content C:\dev-env\claude-code-opener.txt — confirm file is current
4. Report all deferred items not completed in this session