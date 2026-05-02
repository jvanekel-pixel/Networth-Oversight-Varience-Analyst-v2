# SESSION 5D — V1 Finish Line

All tasks T1. Work in order. Terminal only.

---

TASK 1 — logMassageIncome XP verify and fix

Read src/store/useStore.js. Find logMassageIncome.
If XP awarded is +5, change it to +10.
Log what it was and what it is now. No other changes.

---

TASK 2 — grocery_discipline badge counter

Read src/store/useStore.js. Find checkCycleReset.
Add a new field to the gamification state object: groceryDisciplineStreak: 0
Persisted inside nova_v2_gamification alongside XP and badges.

On every cycle reset (month boundary):
  Read the last 4 weekly grocery entries from groceryBudget.
  If all 4 weeks had totalSpent < weeklyLimit, increment groceryDisciplineStreak.
  Otherwise reset groceryDisciplineStreak to 0.
  If groceryDisciplineStreak >= 4, call checkAndAwardBadge('grocery_discipline').

---

TASK 3 — cycle_complete badge

In checkCycleReset, after the grocery check:
  Read all bills from nova_v2_bills_household and nova_v2_bills_personal.
  Filter to active, non-deleted bills from the closing month.
  If every bill has paidDate set, call checkAndAwardBadge('cycle_complete').

---

TASK 4 — Payday letter hardcoded amounts

Read src/config/personality.config.js.
Find any dollar amounts hardcoded inside payday letter strings.
Move them to a named const block at the top of the file:
  const PAYDAY_AMOUNTS = {
    jointDeposit: 990,
    savingsDeposit: 50,
    entDeposit: 313,
    venmoMove: 150,
  }
Replace all hardcoded occurrences in the string bodies with references to
PAYDAY_AMOUNTS. Export PAYDAY_AMOUNTS so other files can read it if needed.

---

TASK 5 — Onboarding nudge

Find the onboarding completion screen in the navigator or screens folder.
After the completion message, add:
  Read nova_v2_bills_household and nova_v2_bills_personal from AsyncStorage.
  If both are empty or missing, render below the completion content:
  "Add your bill schedule in Settings to unlock full variance forecasting."
  Style with theme.colorWarning. No hardcoded colors.

---

After tasks 1–5:
git add -A
git commit -m "V1 polish - badge counters, massage XP, payday config, onboarding nudge"

---

TASK 6 — E2E test pass

App must be running via npx expo start --tunnel on Pixel 8 Pro.
Walk every flow and report pass/fail:

  1. Fresh install — clear app data, reopen, confirm onboarding appears with nudge
     if no bills exist
  2. Complete onboarding — confirm +25 XP, Dashboard loads
  3. Log a transaction — balance updates, variance updates, +10 XP
  4. Log massage income — destination account credits, +10 XP, mirrors in Personal
     Recent Activity
  5. Log cleaning income — cleaningChecking balance updates
  6. Log cleaning mileage — saves, appears in Cleaning Recent Activity, +2 XP
  7. Add a bill — appears in Calendar, variance updates
  8. Mark a bill paid — Calendar reflects, +5 XP
  9. Record paycheck — balances update silently, Post-Payday Actions card appears
     in Personal tab, NOVA antsy text visible
  10. Complete a post-payday action by logging matching transaction — card item
      auto-completes, +15 XP
  11. Navigate all screens — no red screens
  12. Export backup — share sheet opens, no errors
  13. Settings — all sections render, toggles functional
  14. Metro logs — no unhandled rejections, no new errors

If any flow fails: fix it, then continue from that step.
Do not commit Task 6 results — report pass/fail here only.