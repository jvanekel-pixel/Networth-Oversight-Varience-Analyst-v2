## SESSION 5 — NOVA V1 FINAL
## Commit target: "Session 5 complete - notifications + exports + polish - V1 SHIP READY"
## Project: C:\Projects\nova-v2\

---

## PRE-WORK: Session 4 Device Test (do this before anything else)

[T1] Run `npx expo start --tunnel` and test the following on the Pixel 8 Pro via Expo Go:
- Navigate to BusinessScreen → tap "MANAGE BUSINESS ZONES" → BusinessSelectorScreen loads
- Tap Massage → MassageScreen loads, income and expense modals open correctly
- Tap Cleaning → CleaningScreen loads, expense and mileage modals open correctly
- Log one massage income entry → confirm entChecking or cash balance updates
- Log one cleaning mileage entry → confirm deduction preview was correct
- Check Dashboard → all 3 zone cards render, no red error screens
- Metro logs clean (no unhandled promise rejections, no undefined is not an object)

If anything is broken, fix it before proceeding to Part 1. Commit any fixes as:
`git commit -m "Session 5 pre-work - device test fixes"`

---

## PART 1 — NOTIFICATION SYSTEM

[T2] Create `src/config/notifications.config.js`
All notification copy lives here. Generate a config object with these 8 keys:
- billDueAlert: { title, body template with {billName} and {daysUntil} placeholders }
- spendingFloorWarning: { title, body template with {accountName} and {percentRemaining} }
- partnerDepositMissed: { title, body }
- balanceConfirmationNudge: { title, body }
- weeklyVarianceSummary: { title, body template with {zone} and {state} }
- savingsMilestone: { title, body template with {amount} }
- novaDailyDisposition: { title, bodies: [] array of 10 flavor text strings, defaultTime: "09:00" }
- payCycleReminder: { title, body template with {paycheckDate} }
Export as default. Match the tone in personality.config.js — dry, sharp, no fluff.

[T2] Create `src/utils/notifications.js`
Pure utility file. No React. Exports:
- `scheduleLocalNotification(id, title, body, triggerSeconds)` — wraps expo-notifications
- `cancelNotification(id)` — wraps cancelScheduledNotificationAsync
- `requestNotificationPermissions()` — requests permissions, returns granted boolean
- `getScheduledNotifications()` — returns current scheduled list
All functions are async. Include try/catch on each.

[T1] Wire notification triggers into the store and app lifecycle.
In `src/store/useStore.js`:
- After every `logTransaction` call: write `Date.now()` to AsyncStorage key `nova_v2_last_activity`
- In `checkCycleReset`: after any rollover or cycle close, check if partner deposit was logged this month. If not, call the partner deposit missed notification.
- In `updateAccountBalance`: after any debit, check if new balance is within 20% of the account floor. If so, fire spendingFloorWarning.
- In `logMassageIncome` and any savings-affecting action: check if `accounts.entSavings` just crossed a new $1,000 threshold. If so, fire savingsMilestone.

In `App.js` (app open lifecycle):
- On app open, call `requestNotificationPermissions()` once (gate with a seen flag in AsyncStorage)
- Check `nova_v2_last_activity`. If more than 48 hours ago, schedule balanceConfirmationNudge
- Check `nova_v2_config.nextPaycheckDate`. If tomorrow, schedule payCycleReminder
- Check `nova_v2_export_config`. If auto-export is due, trigger export (stub the call for now — Part 2 will implement it)

[T1] Schedule weekly variance summary and NOVA daily disposition.
- On app open, cancel and reschedule both recurring notifications so they don't stack.
- Weekly summary: next Sunday at 7pm, use the household zone state from current variance.
- NOVA daily: use time from `notifications.config.js` `defaultTime`, overridable from `nova_v2_config.novaDailyTime`.
- Pull random body from `novaDailyDisposition.bodies[]` array.

---

## PART 2 — EXPORT SYSTEM

[T2] Create `src/utils/exportUtils.js`
Pure data transformation functions. No React. Exports:
- `buildFullJsonExport(allKeys)` — takes an object of all nova_v2_* key/value pairs, returns a JSON string with a top-level `{ schemaVersion: 2, exportedAt: ISO string, data: {...} }` wrapper
- `buildAccountCsv(accountKey, transactions)` — returns CSV string, columns: Date, Description, Category, Amount, Balance After, Payment Method
- `buildMassageIncomeCsv(massageIncome)` — columns: Date, Amount, Payment Method, Destination, Notes
- `buildMassageExpenseCsv(massageExpenses)` — columns: Date, Amount, Category, Description
- `buildCleaningExpenseCsv(cleaningExpenses)` — columns: Date, Amount, Category, Description, Tax Deductible, Receipt Note
- `buildCleaningMileageCsv(cleaningMileage)` — columns: Date, Miles, Purpose, IRS Rate, Deduction Amount
- `validateImportJson(parsed)` — checks for schemaVersion field and presence of required top-level keys. Returns `{ valid: boolean, reason: string }`.
Each function returns a string. No file I/O inside this file.

[T1] Implement full JSON export and import in the store or a dedicated hook.
Create `src/hooks/useExport.js`:
- `exportAllData()`:
  - Read every `nova_v2_*` key from AsyncStorage using `getAllKeys()` + `multiGet()`
  - Call `buildFullJsonExport()`
  - Write to a temp file using `expo-file-system` at `FileSystem.cacheDirectory + 'nova_backup_YYYY-MM-DD.json'`
  - Share via `expo-sharing`
- `importAllData(uri)`:
  - Read the file from URI using `expo-file-system`
  - Parse JSON and call `validateImportJson()`
  - If invalid, show Alert with the reason and abort
  - If valid, show confirmation Alert: "This will overwrite all current NOVA data. Continue?"
  - On confirm: write all keys back via `multiSet()`, then call `initStore()` to reload state

[T1] Implement per-account and business CSV export.
In `src/hooks/useExport.js`, add:
- `exportAccountCsv(accountKey)` — pulls relevant transactions from store, calls `buildAccountCsv()`, shares via expo-sharing
- `exportBusinessCsvs()` — generates all 4 business CSVs (massage income, massage expenses, cleaning expenses, cleaning mileage), writes each as a separate file, shares all via expo-sharing (share sequentially if multi-share isn't supported)

[T1] Implement auto-export logic.
In `src/hooks/useExport.js`, add:
- `checkAndRunAutoExport()` — reads `nova_v2_export_config`, checks schedule preference:
  - `'daily'`: compare `lastExportTimestamp` to now — if >24h, run export
  - `'weekly'`: if >7 days, run export
  - `'significant'`: this is triggered externally (see below) — do nothing here
  - `'off'`: do nothing
- Save `lastExportTimestamp` to `nova_v2_export_config` after each successful auto-export
In `useStore.js`: after any transaction > $100 (10000 cents), call `checkAndRunAutoExport()` if schedule is `'significant'`
In `App.js`: call `checkAndRunAutoExport()` on app open (already stubbed in Part 1)

---

## PART 3 — FULL SETTINGS SCREEN

[T1] Survey `src/screens/SettingsScreen.js` and all settings-related components.
Report: what sections already exist and work, what is stubbed, what is missing entirely.
Do not make any changes yet. Report only.

[T2] Scaffold a `src/components/settings/` folder with these section components:
- `AccountFloorsSection.js` — one decimal input per account (jointChecking, entChecking, entSavings, venmo, cash). Saves on blur. Reads from and writes to store `accountFloors`.
- `IrsMileageRateSection.js` — displays current IRS rate from `nova_v2_config.irsMileageRate` (default 0.67), editable decimal input, note: "IRS updates this rate annually — verify each January."
- `AboutSection.js` — static. App version from `app.json` (or hardcode "1.0.0" for now). "Built by CFLX-01."
Each component: self-contained, reads from store, saves to store on change. No navigation props needed.

[T1] Build the complete SettingsScreen, assembling all sections.
Sections in order:
1. Account Floors (new component)
2. Pay Cycle Configuration (already built in Session 3.5 — verify it's wired, add if missing)
3. Bill Schedule (already built — verify it's wired, add if missing)
4. Variance Thresholds (already built in Session 3.5 — verify it's wired, add if missing)
5. IRS Mileage Rate (new component)
6. Notifications — one Toggle row per notification type, reading from `nova_v2_config.notificationToggles`. Add a time input under the NOVA Daily Disposition toggle.
7. Export / Import — "Export All Data" button, "Import Data" button, auto-export schedule picker (Off / Daily / Weekly / On Significant Transaction)
8. About (new component)

All sections use ScrollView. Section headers match existing app styling (theme.config.js only).

---

## PART 4 — POLISH PASS

[T1] Fix hardcoded dollar amounts in `personality.config.js`.
The payday letter contains hardcoded values: $990, $50, $150, $160, $314.
Replace each with a reference to the corresponding config variable from `nova_v2_config` or the store's income/distribution config. Identify the correct variable names by surveying the store before making changes.

[T1] Fix hardcoded grocery $200 reference.
Search all component and utility files for any hardcoded 200 or "200" that refers to the grocery budget.
Replace with a reference to `groceryBudget.weeklyLimit` from the store.

[T1] Wire Confirm Balance glow to `lastActivityTimestamp`.
In `src/components/NovaHeader.js`:
- On mount and on app focus, read `nova_v2_last_activity` from AsyncStorage
- If more than 48 hours ago, apply a subtle pulse/glow style to the Confirm Balance button
- Clear the glow immediately when the user taps Confirm Balance
- Style: use a border glow or animated opacity pulse — do not add a new color outside theme.config.js

[T1] Fix `logMassageIncome` XP award.
The dev plan specifies +10 XP for logging massage income. The current implementation awards +5.
Update `useStore.js` line ~852 to award +10.

[T1] Implement `grocery_discipline` badge counter in `checkCycleReset`.
Add a new state field `groceryStreakWeeks` (integer, default 0) to the store.
On every weekly grocery reset: if the closing week's spend was under `weeklyLimit`, increment `groceryStreakWeeks`. If over, reset to 0.
On month boundary: if `groceryStreakWeeks >= 4`, call `checkAndAwardBadge('grocery_discipline')`.
Persist `groceryStreakWeeks` in `nova_v2_gamification`.

[T1] Implement `cycle_complete` badge in `checkCycleReset`.
On month close: check if all bills in `bills_household` and `bills_personal` with `lastPaidMonth === closingCycleId` are marked paid.
If all paid: call `checkAndAwardBadge('cycle_complete')`.

[T1] OTA update configuration.
In `app.json`: add `"updates": { "enabled": true, "fallbackToCacheTimeout": 0 }` under the `expo` key.
In `app.json`: set `"runtimeVersion": { "policy": "sdkVersion" }`.
Create `eas.json` if it doesn't exist with a minimal preview and production profile.
Do not run `eas build` — config only.

[T1] Skin config audit.
Grep all files in `src/` for hardcoded color values: `/#[0-9a-fA-F]{3,6}/`, `/rgba?\(/`, and any string starting with `'#'`.
For each hit: determine if it should be a theme variable. If yes, move it to `theme.config.js` and replace the hardcoded value with the variable reference.
Report the full list of replacements made.

[T2] Add onboarding nudge to onboarding completion screen.
In `src/screens/OnboardingScreen.js` (or wherever onboarding completion renders):
On the final onboarding screen, check if `bills_household` and `bills_personal` are both empty.
If empty, display a prompt below the completion message: "Add your bill schedule in Settings to unlock full variance forecasting."
Style it as a soft info callout — not an error. Use theme colors only.

---

## PART 5 — END-TO-END TEST PASS

[T1] Walk every primary flow on the Pixel 8 Pro with Expo Go via tunnel.
Test each item below. Log pass/fail for each. Fix any failures before moving on.

- Fresh install (clear Expo Go app data): onboarding runs, all screens reachable from nav
- Log income → balance updates → variance card updates → correct color state
- Log expense → balance updates → variance card updates
- Add new bill → appears in CalendarScreen on correct day → variance updates
- Mark bill paid → calendar dot updates → variance updates
- Distribute paycheck → rollover fires if applicable → XP +50 → NOVA reacts
- All 8 badges: confirm each is earnable by triggering the condition
- Export all data → JSON file appears in share sheet
- Import that same file → confirmation dialog shown → data reloads correctly
- Per-account CSV export → at least one account CSV shared successfully
- All 8 notification types: manually trigger each by meeting the condition, confirm notification appears
- Metro logs: no red screens, no unhandled rejections, no missing key warnings

[T1] After all tests pass, do final commit:
`git commit -m "Session 5 complete - notifications + exports + polish - V1 SHIP READY"`

---

## SESSION CLOSE — MANDATORY

1. Run: `Get-Content C:\dev-env\claude-code-opener.txt`
   Confirm it exists and is current. If missing, recreate before closing.
2. Confirm git commit hash is logged.
3. Log any remaining deferred items explicitly — nothing left as "not confirmed."