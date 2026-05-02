Four bugs to fix in order. All T1. Do not stop between them.

---

BUG 1 — logMassageIncome not updating balance or UI

Read src/store/useStore.js. Find the logMassageIncome action.
Diagnose: is the account credit actually being applied to the correct account?
Is recomputeVariance being called after the write?
Is the massageIncome array being saved to AsyncStorage before recompute fires?

Fix whatever is broken so that:
- Logging massage income credits the destination account (entChecking or cash)
  by the income amount in cents
- The Massage screen "income this month" and totals reflect the new entry immediately
- The Personal tab balance for the credited account updates
- recomputeVariance fires after the write
- Same audit for logCleaningMileage and logCleaningExpense — check all three
  business log actions for the same pattern and fix any that are broken

---

BUG 2 — Business modals not auto-populating today's date

Read these four modal files:
  src/components/modals/LogMassageIncomeModal.js
  src/components/modals/LogMassageExpenseModal.js
  src/components/modals/LogCleaningExpenseModal.js
  src/components/modals/LogCleaningMileageModal.js

For each one: find the date input field and its initial state value.
If it is empty string, null, or undefined — change it to:
  new Date().toISOString().split('T')[0]
This gives YYYY-MM-DD format matching what the store expects.
Apply to all four files.

---

BUG 3 — Export failing: Cannot read property 'UTF8' of undefined

Read src/hooks/useExport.js. Find where FileSystem.EncodingType.UTF8 is referenced.
The error means EncodingType is not resolving — likely an import or destructuring issue.

Fix:
  import * as FileSystem from 'expo-file-system';
  // Use as: FileSystem.EncodingType.UTF8

Verify every FileSystem call in the file uses this pattern.
Also verify expo-sharing import:
  import * as Sharing from 'expo-sharing';
Fix any import that doesn't match. Test by reading the file and confirming
no bare EncodingType or Sharing references exist without their namespace prefix.

---

BUG 4 — Calendar trigger type not supported on Android

Read src/utils/notifications.js. Find all uses of type: 'calendar' triggers.
These do not work in Expo Go on Android. Replace each one with a calculated
date trigger using the next occurrence of that schedule.

For each recurring notification, write a helper that computes the next
occurrence as a JS Date object, then use:
  { type: 'date', date: nextOccurrenceDate }

Since App.js already cancels and reschedules all notifications on every foreground
resume, one-shot date triggers are sufficient — they will be rescheduled on next open.

Helpers needed:
  getNextSunday7pm() — returns Date for the coming Sunday at 19:00
  getNextDailyTime(hour, minute) — returns Date for next occurrence of that time today or tomorrow
  getDayBeforeDate(dateString) — returns Date for 18:00 the day before a given YYYY-MM-DD string

Replace all three calendar trigger calls with the appropriate helper.
Do not change timeInterval triggers — those work fine.

---

After all four bugs are fixed:
git add -A
git commit -m "Fix massage income account effect, date defaults, export UTF8, Android calendar triggers"