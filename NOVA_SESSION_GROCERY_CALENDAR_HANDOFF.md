# NOVA Session Archive - Calendar Math + Grocery Reserve Handoff

Date: 2026-05-03

## Current User Concern

The calendar currently shows projected bank cash, while NOVA's variance logic can account for grocery budget pressure. This creates confusion for low-margin budgeting: the calendar may show the account comfortably above the floor, but groceries are still a real planned spending risk.

User preference:
- Do not pretend grocery money has already left the bank.
- Do create a second "available after planned spending" layer.
- Grocery planning should follow standard calendar weeks: Sunday through Saturday.
- User personally wants grocery spending hard-coded into anticipated budget behavior.
- A calendar toggle like "Grocery Reserve" / "Include Grocery" is desired.

## Bug Fixed This Session

The Household variance card was saying it entered yellow/red with `XCEL_energy` while the calendar never showed the account near the $300 floor.

Root cause:
- The immediate floor-scan path was subtracting future grocery reserve before checking bill-driven floor risk.
- The calendar projection did not subtract grocery reserve.
- Result: XCEL appeared to be the trigger even when actual projected bank cash stayed above the floor.

Fix applied:
- Immediate floor scans now check actual projected cash only.
- Grocery reserve remains part of cycle-end variance.
- Bill projection filtering was tightened for inactive/deleted/paid bills.
- Bill account resolution now consistently accepts `accountKey` or `defaultAccountKey`.
- NOVA header state now syncs to the recomputed variance cache when the visible state is variance-driven.

Files touched:
- `src/utils/forecasting.js`
- `src/store/useStore.js`
- `src/screens/CalendarScreen.js` had already been updated in prior calendar work to pass account registry/config and use paycheck splits.

Verification:
- `npx expo export --platform android` passed after the fixes.
- `git diff --check` showed only CRLF normalization warnings, no whitespace errors.

## Current Projection Model

Calendar balance is currently:

```text
projected cash = current balance + scheduled income - scheduled bills
```

That is technically correct for bank cash.

Needed next layer:

```text
available after planned spending = projected cash - remaining grocery reserve
```

Important: keep these separate.

`projectAccountBalances()` should remain a pure actual-cash projection and should not silently subtract groceries.

## Proposed Implementation For Claude Code

### Add Calendar Toggle

In `src/screens/CalendarScreen.js`, add a small tactical toggle near the month controls:

```text
Grocery Reserve
```

Behavior:
- OFF: existing calendar behavior, projected cash only.
- ON: calculate and display/use "available after planned grocery spending" for the grocery account.
- Initial V1 can use local component state. AsyncStorage persistence is optional.

### Grocery Reserve Rules

Use store `groceryBudget`:
- `weeklyLimit`
- `currentWeekSpend`
- `weekStartDate`

Rules:
- Calendar week is Sunday-Saturday.
- Current week reserve:

```text
max(weeklyLimit - currentWeekSpend, 0)
```

- Future weeks:

```text
weeklyLimit
```

- Past weeks/days should not create new reserve pressure.
- Reserve applies only to the grocery account.

Account resolution:
- Prefer existing grocery account resolver if exported.
- If not available, mirror current app behavior:
  - solo mode -> personal role account
  - otherwise -> household role account
  - fallback to active household/personal account, then `jointChecking` / `entChecking`.

### Forecasting Utility

Add a pure helper in `src/utils/forecasting.js`.

Possible shape:

```js
export function getGroceryReserveForDate({
  targetDateMs,
  now = Date.now(),
  groceryBudget,
}) {
  // returns integer cents of planned-but-unspent grocery reserve
}
```

Alternative:

```js
export function buildGroceryReserveByDate(startDate, endDate, groceryBudget) {
  // returns Map<YYYY-MM-DD, reserveCents>
}
```

Do not read from Zustand inside this helper.

### Calendar Cell Behavior

Keep projected cash as the canonical balance.

When toggle is ON:
- If the cell represents the grocery account projection, compute:

```text
availableAfterPlanned = projectedCash - groceryReserveForThatDate
```

- Use `availableAfterPlanned` for conservative yellow tinting.
- Red should still mean actual projected cash below zero unless deliberately changing the app's risk semantics.
- Display the available number only if it stays readable on Pixel 8 Pro width.

Recommended compact display:
- Day cell keeps projected cash.
- Conservative tint uses available amount.
- Day modal shows the detailed distinction.

### Day Modal Behavior

In the "Projected Balances" card, for the grocery account row, show:

```text
CHASE_JOINT        $681.38
after grocery reserve: $481.38
```

Only show this secondary line when the toggle is ON.

### Grocery Dot / Icon

Add a subtle grocery/planned-spend indicator:
- Small dot or minimal glyph, not heavy UI.
- Avoid putting it on every day if it creates visual noise.
- Suggested V1: show it on Sundays, or on the current week's anchor day.
- Under budget: accent/safe color.
- Over weekly limit: warning/danger color.
- Add legend label: `Grocery reserve` or `Grocery plan`.

### UX Goal

The user should understand:

```text
Your bank balance will be $681.38, but after protecting grocery money, your usable balance is $481.38.
```

This avoids both bad outcomes:
- ignoring groceries entirely
- pretending grocery money already posted to the bank

## Audit Checklist After Implementation

- Calendar projected cash still matches scheduled deposits/bills.
- Available-after-grocery layer updates by Sunday-Saturday weeks.
- Current week reserve uses remaining grocery budget, not full weekly limit if some groceries have already been logged.
- Future weeks use full weekly grocery limit.
- Grocery reserve applies only to the correct account.
- XCEL/bill warnings only blame bills when the bill actually causes a floor breach.
- Paid bills are not double-deducted.
- Paycheck split projection still works.
- Android export passes:

```powershell
npx expo export --platform android
```

## Recommendation

For broad public release:
- Make grocery reserve toggle default OFF unless the user opts into strict budgeting.

For this user's NOVA setup:
- Default ON is probably correct because grocery spending is intentionally part of anticipated budget safety.

