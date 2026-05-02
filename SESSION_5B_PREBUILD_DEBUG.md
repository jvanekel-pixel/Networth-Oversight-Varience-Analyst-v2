Four items to build in order. All T1 unless marked. Do not stop between them.

---

ITEM 1 — Cleaning LLC dedicated account + income logging

The Cleaning LLC needs its own tracked balance: cleaningChecking.
This account belongs to the LLC only — it does not appear in the Personal tab.
The user pays themselves out of it manually; NOVA just tracks what's in it.

Step A — Add cleaningChecking to the store
In src/store/useStore.js, add cleaningChecking: 0 to the accounts object
and to the KEYS/AsyncStorage account structure alongside the existing accounts.
Default balance: 0.

Step B — Add logCleaningIncome store action
Same pattern as logMassageIncome:
  - Accepts: { date, amountCents, paymentMethod, notes }
  - Appends to cleaningIncome array (new array, new key nova_v2_cleaning_income)
  - Credits accounts.cleaningChecking by amountCents
  - Awards +10 XP
  - Calls recomputeVariance
  - Soft delete + edit variants: editCleaningIncome, deleteCleaningIncome (reverses credit)

Step C — Add LogCleaningIncomeModal [T2]
File: src/components/modals/LogCleaningIncomeModal.js
Same pattern as LogMassageIncomeModal.
Fields: date (pre-filled today), amount (decimal input), payment method (pill toggle:
Cash / Check / Venmo / Zelle), notes (optional text input).
Pre-populate date with new Date() components on mount.

Step D — Wire into CleaningScreen
Add an "LOG INCOME" button at the top of CleaningScreen alongside the existing buttons.
Add a "Cleaning Account Balance" summary card showing accounts.cleaningChecking
formatted via formatCentsShort. Place it above the expense/mileage sections.
Wire LogCleaningIncomeModal onConfirm to the logCleaningIncome store action.
Add "Income This Month" total calculated from cleaningIncome filtered to current month.

---

ITEM 2 — Export: migrate off deprecated writeAsStringAsync

Read src/hooks/useExport.js.
The error is: writeAsStringAsync imported from expo-file-system is deprecated in SDK 54.

Fix: Replace the import and all writeAsStringAsync calls using the legacy import path:
  import * as FileSystem from 'expo-file-system/legacy';

This is the correct SDK 54 migration path — the legacy API is identical but imported
from the /legacy subpath. Do not change any method names or logic.
Apply to every FileSystem reference in useExport.js.
If expo-sharing has any similar deprecation pattern, check and fix that too.

---

ITEM 3 — Massage income transactions visible in Personal Recent Activity

When logMassageIncome fires, it credits a personal account (entChecking or cash).
That transaction should be visible in the Personal screen's Recent Activity section
with long-press to edit/delete — same as any other personal transaction.

Step A — Read src/screens/PersonalScreen.js
Find the Recent Activity section. Understand how it sources its transaction list.
It likely reads from nova_v2_transactions filtered to personal accounts.

Step B — On logMassageIncome, also write a mirror transaction record
In src/store/useStore.js, inside logMassageIncome (after the existing logic),
append a record to the transactions array with:
  {
    id: uuid or Date.now(),
    date: income.date,
    description: 'Massage Income',
    category: 'income',
    amountCents: income.amountCents,
    account: income.destinationAccount,  // entChecking or cash
    source: 'massage',
    sourceId: the massageIncome record's id
  }
This lets the Personal screen pick it up automatically via its existing filter.

Step C — Long-press on this transaction in Personal Recent Activity
When the user long-presses a transaction with source: 'massage', open
LogMassageIncomeModal in edit mode, pre-filled with the original entry.
On save: call editMassageIncome (which reverses and re-applies the account effect)
and update the mirror transaction record to match.
On delete: call deleteMassageIncome and remove the mirror transaction.
Find where PersonalScreen handles long-press on transactions and add this branch.

---

ITEM 4 — Recent Activity sections on Massage and Cleaning screens

Both screens need a Recent Activity section at the bottom showing all logged entries
for that business, with long-press to edit/delete.

[T2] Task A — MassageRecentActivity component
File: src/components/MassageRecentActivity.js
Props: incomeEntries, expenseEntries, onLongPressIncome(entry), onLongPressExpense(entry)
Render two sub-sections: "Income" and "Expenses"
Each row: date (formatted), description or category, amount (formatCentsShort)
Long-press on any row calls the appropriate handler.
Empty state: "No entries yet" per section.
Style using theme only — no hardcoded colors.

[T2] Task B — CleaningRecentActivity component  
File: src/components/CleaningRecentActivity.js
Props: incomeEntries, expenseEntries, mileageEntries,
       onLongPressIncome(entry), onLongPressExpense(entry), onLongPressMileage(entry)
Three sub-sections: "Income", "Expenses", "Mileage"
Mileage row: date, purpose, miles + deduction amount
Same long-press and empty state pattern as above.

[T1] Task C — Wire MassageRecentActivity into MassageScreen
Read src/screens/MassageScreen.js.
Import MassageRecentActivity.
Pass massageIncome and massageExpenses from store.
onLongPressIncome: open LogMassageIncomeModal in edit mode pre-filled with that entry
onLongPressExpense: open LogMassageExpenseModal in edit mode pre-filled with that entry
On save in either modal: call the appropriate edit action.
On delete: call the appropriate delete action.
Add MassageRecentActivity at the bottom of the ScrollView.

[T1] Task D — Wire CleaningRecentActivity into CleaningScreen
Same pattern for CleaningScreen.
Pass cleaningIncome, cleaningExpenses, cleaningMileage from store.
Wire all three long-press handlers to their respective edit modals.
Add CleaningRecentActivity at the bottom of the ScrollView.

---

After all items are complete:
git add -A
git commit -m "Cleaning LLC income account, export legacy fix, massage transactions in Personal, business recent activity"