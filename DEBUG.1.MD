# NOVA — DEBUG.1 FIX SESSION

Do not fix anything until the full audit is complete. Report all findings first, then fix in the order listed.

---

## AUDIT — Answer all of these before touching any code

1. Where is `nextPaycheckDate` written to the store? Check `distributePaycheck`, the Settings Pay Schedule save handler, and anywhere else it gets set. Is it storing the raw date the user enters, or is something recalculating it?

2. In `deleteTransaction` — paste the exact function. Does it reverse the account balance when deleting? It should adjust the account balance by the original transaction amount. If it only sets `deleted: true` without touching the balance, that is the bug.

3. In `editTransaction` — same question. Does it reverse the original amount from the original account and apply the new amount to the (possibly different) account?

4. On PersonalScreen.js — search for `varianceCache`. Is `varianceCache.personal` read and displayed anywhere on that screen?

5. On BusinessScreen.js — search for `varianceCache`. Is `varianceCache.business` displayed anywhere?

6. In `useStore.js` — find `distributePaycheck`. After it runs, does it advance `nextPaycheckDate` by the frequency interval (14 days for biweekly)? Paste the relevant lines.

7. In `useStore.js` — find `recordPartnerDeposit`. What does it write to `incomeEvents`? Does it update `partnerDepositAmount` or `partnerDepositAmountCents`? Does it record the amount that was deposited for future reference?

8. In `useStore.js` or wherever grocery spend is managed — find `logGrocerySpend` and any grocery editing logic. Is there any edit or delete handler for individual grocery spend entries? Are grocery entries stored as individual records or just a running total?

9. Add these logs and reload on device. Paste both outputs before proceeding:
```javascript
// In getIncomeEventsBetween, after building events array, before return:
console.log('NOVA_INCOME_EVENTS', JSON.stringify(events));

// In computeProfileVariance, after findMinimumProjectedBalance, household only:
if (profile === 'household') {
  console.log('NOVA_DIP', JSON.stringify({
    minimumBalance,
    minimumDate: new Date(minimumDate).toDateString(),
    dipsBelowFloor,
    variance
  }));
}
```

Report all findings. Wait for my confirmation before fixing anything.

---

## FIXES — Execute in this order after audit is confirmed

---

### Fix 1 — nextPaycheckDate stores exactly what the user enters

Whatever is writing `nextPaycheckDate` to the store, correct it to use the exact date the user enters in Settings Pay Schedule — stored as that date at midnight (00:00:00) ms timestamp. No recalculation, no offset. User entered May 1 → store gets May 1 midnight.

---

### Fix 2 — deleteTransaction must reverse account balance

Current behavior: sets `deleted: true` only. Balance does not change.
Required behavior: when a transaction is deleted, reverse its effect on the account:
- Income transaction (amountCents positive): subtract amountCents from the account balance
- Expense transaction (amountCents negative): add the absolute value back to the account balance

Update `deleteTransaction` in useStore.js to apply the balance reversal before setting `deleted: true`. Then persist. Then call `recomputeVariance()`.

---

### Fix 3 — editTransaction must reverse original and apply new

When a transaction is edited:
1. Reverse the original transaction's effect on the original account (undo it)
2. Apply the new transaction values to the new account (which may be a different account)
3. Update the transaction record in the store
4. Persist
5. Call `recomputeVariance()`

If the account changed, make sure the reversal goes to the original account and the new amount goes to the new account.

---

### Fix 4 — Wire variance card to Personal screen

Add a variance summary card to PersonalScreen.js at the top of the screen, below the NOVA header and above the account balance section.

Card reads from `varianceCache.personal` via Zustand selector.

Card spec:
- Container: `padding: theme.spacingLG`, `borderRadius: theme.radiusLG`, `borderWidth: 2`, `marginHorizontal: theme.spacingMD`, `marginBottom: theme.spacingMD`
- Border + background by state: green=statusPositive/statusPositiveBg, yellow=statusWarning/statusWarningBg, red=statusDanger/statusDangerBg, neutral=borderColorDim/backgroundCard
- Row 1: "PERSONAL VARIANCE" label — `theme.textSecondary`, `theme.fontSizeSM`, uppercase
- Row 2: Total balance across entChecking + entSavings + venmo + cash — `formatCentsShort`, `theme.fontSizeXXL`, `theme.textPrimary`
- Row 3: Variance with explicit +/- sign — `formatCentsShort`, `theme.fontSizeLG`, green if positive, red if negative
- Row 4: Annotation — `theme.fontSizeSM`, `theme.textSecondary`

---

### Fix 5 — Wire variance card to Business screen

Same pattern as Fix 4, but reads from `varianceCache.business`.
Label: "BUSINESS VARIANCE"
In V1 this shows $0 neutral — that is correct and expected. The card must exist for Session 4.

---

### Fix 6 — Auto-advance nextPaycheckDate after distributePaycheck

When `distributePaycheck` runs successfully, automatically advance `nextPaycheckDate` in `incomeEvents` by the correct interval:
- `biweekly`: +14 days
- `weekly`: +7 days  
- `monthly`: same day next month (use `new Date`, set month + 1)
- `unscheduled`: do not advance

This means after each paycheck is recorded, the system already knows the next one — no manual re-entry needed.

---

### Fix 7 — Auto-assume partner deposit amount from last month

When `recordPartnerDeposit` is called:
- Write the deposited amount to `incomeEvents.partnerDepositAmountCents` AND `incomeEvents.partnerDepositAmount` (keep both for backward compat)
- This means next month, `getIncomeEventsBetween` will project the same amount for the partner deposit automatically
- The "CONFIRM RECEIVED" button in Settings already exists — it should pre-fill the amount field with `partnerDepositAmountCents` from last month as the default

If `partnerDepositAmountCents` is 0 (never set), the CONFIRM RECEIVED flow should prompt the user to enter the amount. Once entered and confirmed, it saves to `incomeEvents.partnerDepositAmountCents` for future auto-projection.

---

### Fix 8 — Grocery spend entries: long-press to edit and delete

Currently grocery spend is logged but individual entries cannot be edited or deleted.

First, confirm how grocery entries are stored (audit item 8). If they are stored as individual records with IDs, add long-press edit/delete to the grocery spend list in HouseholdScreen.

If they are stored as a running total only, convert to individual records:
```javascript
// Each grocery entry:
{
  id: 'grocery_001',
  amountCents: 4500,
  description: '',  // optional
  timestamp: Date.now(),
  weekStartDate: getCurrentWeekStart(),
  deleted: false,
}
```
Storage key: `nova_v2_grocery_entries` (new key — keep existing `nova_v2_grocery_budget` for limits/totals)

Add to HouseholdScreen grocery section:
- List of this week's entries below the LOG GROCERY SPEND button
- Each row: amount + timestamp (timeAgo) + optional description
- Long-press → action menu: EDIT / DELETE
- EDIT → decimal input modal pre-filled with existing amount
- DELETE → confirmation → soft delete → recalculate `currentWeekSpend` from non-deleted entries → persist → recomputeVariance()

Add store actions:
- `editGroceryEntry(id, updates)` — updates entry, recalculates week total, persists, recomputeVariance()
- `deleteGroceryEntry(id)` — soft deletes entry, recalculates week total, persists, recomputeVariance()

---

### Fix 9 — Remove all debug console.logs

After all fixes are verified, remove:
- `NOVA_DEBUG` log from `computeProfileVariance`
- `NOVA_INCOME_EVENTS` log from `getIncomeEventsBetween`
- `NOVA_DIP` log added in this session

---

## TESTING CHECKLIST

Verify all of these on device via tunnel before declaring done:

1. Enter May 1 in Settings Pay Schedule → log `incomeEvents.nextPaycheckDate` confirms May 1 midnight timestamp
2. Log a $100 expense on jointChecking → balance reduces by $100
3. Delete that transaction → balance returns to pre-expense value
4. Edit a transaction from $100 to $150 → balance reflects the $50 difference correctly
5. Record a paycheck via Personal screen → `nextPaycheckDate` automatically advances by 14 days (biweekly)
6. Dashboard Personal card shows variance card with real numbers
7. Business screen shows variance card (neutral/$0 is fine)
8. Dashboard Household card turns green given $3,184 balance vs ~$102 remaining bills (Lemonade $32 + Google Fi $70)
9. Partner deposit: confirm received with an amount → that amount saves and is projected next month automatically
10. Grocery spend: long-press an entry → EDIT and DELETE options appear
11. Delete a grocery entry → currentWeekSpend recalculates correctly
12. Edit a grocery entry → currentWeekSpend recalculates correctly
13. All console.logs removed — Metro terminal clean
14. No red error screens

---

## STOPPING POINT

When all 14 items pass: STOP. Tell me to test. After confirmation, commit:

```
Debug.1 complete - variance fix, balance reversal on delete/edit, personal/business variance cards, grocery edit/delete, auto-advance paycheck date, partner deposit memory
```

Push to Git.

If the same error occurs 3 times: stop and report exactly what is failing and what you tried. Do not loop.