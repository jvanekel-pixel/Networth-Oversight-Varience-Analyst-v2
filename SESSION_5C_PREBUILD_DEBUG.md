# SESSION 5C — Post-Payday Action Items

All tasks T1. Work in order. Terminal only.

---

TASK 1 — Kill auto-rollover on paycheck record

Read src/store/useStore.js. Find distributePaycheck.
Remove any logic that automatically moves money from entChecking to entSavings
on paycheck distribution. The balance splits ($990 joint, $50 savings, $313 ENT
checking) still apply instantly and silently. Only the automatic rollover sweep
is removed. Do not touch anything else in distributePaycheck.

---

TASK 2 — Post-payday action item state

In src/store/useStore.js add a new state field:
  postPaydayActions: []
  Key: nova_v2_post_payday_actions

Each action item shape:
  {
    id: string,
    type: 'venmo_move' | 'savings_move',
    label: string,       // e.g. "Move money to Venmo"
    completed: boolean,
    completedAt: number | null,
    createdAt: number,
    expiresAt: number    // createdAt + configurable window in ms
  }

Add to nova_v2_config:
  postPaydayExpiryHours: 12   // configurable, default 12

Add store actions:
  generatePostPaydayActions()
  - Creates two action items (venmo_move, savings_move) with expiresAt set from config
  - Overwrites postPaydayActions in state and AsyncStorage
  - Call this at the end of distributePaycheck

  completePostPaydayAction(id)
  - Sets completed: true, completedAt: Date.now() on matching item
  - Awards +15 XP
  - Saves to AsyncStorage

  dismissPostPaydayAction(id)
  - Sets completed: true, completedAt: Date.now() — no XP
  - Saves to AsyncStorage

  pruneExpiredPostPaydayActions()
  - Filters out items where Date.now() > expiresAt
  - Saves result to AsyncStorage
  - Call this on every app foreground resume in App.js alongside the existing
    lifecycle checks

---

TASK 3 — Auto-complete detection in logTransaction

In src/store/useStore.js find logTransaction.
After a transaction is successfully written, run this check:

  const openActions = postPaydayActions.filter(a => !a.completed && Date.now() < a.expiresAt)

  For each open action:
    - If type === 'venmo_move' and the transaction moves money FROM entChecking TO venmo
      (check fromAccount === 'entChecking' && toAccount === 'venmo' or category === 'venmo transfer'):
      call completePostPaydayAction(action.id)

    - If type === 'savings_move' and the transaction moves money FROM entChecking TO entSavings:
      call completePostPaydayAction(action.id)

Use whatever transaction fields already exist for account routing — read the
existing logTransaction signature before writing this check to match the real shape.

---

TASK 4 — Post-Payday Actions card on Personal screen

Read src/screens/PersonalScreen.js.
Add a PostPaydayActionsCard component inline or as a separate file.

Show the card only when:
  postPaydayActions has at least one item where completed === false
  AND Date.now() < expiresAt

Card contents:
  - Header: "Post-Payday Actions" styled with theme.colorWarning or accent
  - One row per incomplete non-expired action showing the label
  - Each row has a "Done, I handled it" button that calls dismissPostPaydayAction(id)
  - When all items are complete or expired, card disappears automatically

Place the card at the top of the PersonalScreen ScrollView, above account balances.

---

TASK 5 — NOVA antsy state flag

In src/store/useStore.js find the novaState object or wherever NOVA's
current mood/text is stored.
Add a derived condition: novaIsAntsy = true when postPaydayActions has any
incomplete non-expired items.

In src/components/NovaHeader.js, read novaIsAntsy.
When true, append a short antsy line to whatever NOVA is currently displaying.
Pull the copy from personality.config.js — add an array called postPaydayNudges
with 3–4 short lines, e.g.:
  "Your Venmo is looking lonely."
  "Savings doesn't move itself."
  "Post-payday. You know what to do."
  "The accounts await your attention."
Pick one at random on each render. When novaIsAntsy is false, display nothing extra.

---

TASK 6 — Settings — Post-Payday configuration

Read src/screens/SettingsScreen.js.
Find the Pay Cycle Configuration section.
Add below it a "Post-Payday Actions" sub-section with:
  - Expiry window input: numeric input, label "Action window (hours)", saves to
    nova_v2_config.postPaydayExpiryHours on blur
  - Two toggle rows (Switch): "Remind me to move to Venmo" / "Remind me to move to Savings"
    Save toggles to nova_v2_config.postPaydayActionToggles: { venmo: true, savings: true }
  - In generatePostPaydayActions, respect these toggles — only create action items
    for enabled types

---

After all tasks complete:
git add -A
git commit -m "Post-payday action items - auto-complete on transaction, NOVA antsy state, settings config"