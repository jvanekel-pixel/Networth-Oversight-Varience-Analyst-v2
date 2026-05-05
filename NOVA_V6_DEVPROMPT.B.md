Read NOVA_V6_DEVPROMPT.B.md and SESSION_6_POSTBUILD_AUDIT.md at the project root for full project context before beginning.

Reminder: this project uses a hybrid AI workflow.
- [T1] tasks = complex, cross-cutting, or logic-heavy → Claude Code handles directly
- [T2] tasks = UI components, scaffolding, forms, cards → delegate to Ollama via:
  powershell -File C:\dev-env\invoke-ollama.ps1 -Prompt "<task description>"

Do not write any code yet. Read the three feature requests below, audit the relevant files, then report your implementation plan before touching anything. Wait for confirmation before proceeding.

---

## FEATURE 1 — Spending Category Cards Driven by Wizard Selection

### Concept
If the user selects "Groceries" as a spending bucket during the onboarding wizard (OnboardingBucketsScreen), the Grocery Budget card should automatically appear in their Personal screen (solo mode) or Household screen (partnered mode, if grocery account is shared-role). If they do not select Groceries, the card is hidden entirely — they can still log grocery transactions but the dedicated tracking card does not appear.

This same show/hide pattern should apply to any card that maps directly to a spending bucket category.

### Audit required before implementing
Read the following files:

OnboardingBucketsScreen.js:
- What spending category presets are offered?
- What does the wizard write to the store when a bucket is selected? (nova_v2_spending_buckets entries)
- Is "Groceries" a named preset or is it a free-entry custom bucket?

PersonalScreen.js and HouseholdScreen.js:
- Where is the Grocery Budget card rendered?
- Is it currently always shown, or already conditionally rendered?
- What data does it read from (groceryBudget config, spending buckets, or hardcoded)?

useStore.js:
- How is nova_v2_spending_buckets structured?
- Is there a label or type field that can be matched to identify the Groceries bucket?

After reading, assess which other existing cards across PersonalScreen and HouseholdScreen map to a spending bucket or wizard choice and should follow the same show/hide pattern. Produce a complete list before implementing anything.

### Fix to implement
- Each spending card's visibility is driven by whether a matching active bucket exists in nova_v2_spending_buckets
- Match on a canonical label field (e.g. label: 'Groceries') — do not match on free-text displayName
- The preset buckets in OnboardingBucketsScreen must write a canonical type or id field that cards can key off of
- Grocery Budget card: visible if a bucket with type === 'groceries' is active, hidden otherwise
- Apply the same pattern to any other cards identified in the audit
- A user who skips the buckets step entirely sees none of the category cards — clean dashboard

---

## FEATURE 2 — Savings Goal Card in UI + Card Order Customization

### Part A — Savings Goal Card
The Savings Goal was configured in the wizard and is editable in Settings, but no card exists in the UI to show progress.

Read PersonalScreen.js:
- Confirm no SavingsGoalCard currently exists

Read useStore.js:
- Confirm the shape of the savings goal config: targetCents, accountId, label
- Confirm how to read current balance of the linked savings account from the registry

Implement:
[T2] SavingsGoalCard component
   Props: goalLabel, targetCents, currentCents, accountDisplayName
   Renders: goal label, progress bar (currentCents / targetCents), current balance vs target, percentage
   Empty/complete states: "No savings goal set — add one in Settings" if no goal configured, celebratory state if target reached
   No hardcoded values. All data from props.

[T1] Mount SavingsGoalCard in PersonalScreen
   - Visible only when a savings goal is configured (savingsGoal.targetCents > 0 and savingsGoal.accountId is set)
   - Reads current balance from accountRegistry by savingsGoal.accountId
   - Hidden if no goal configured

### Part B — Editable Card Order
Users should be able to reorder cards within Personal screen to match their priorities.

Read PersonalScreen.js:
- List every card currently rendered and its current fixed position

Implement:
[T1] Add nova_v2_personal_card_order to store — array of card id strings representing render order
   Default order (based on current layout): derive from existing card sequence
   Card ids: 'accounts', 'pay_cycle', 'savings_goal', 'bills', 'spending_buckets', 'recent_activity'
   Plus one id per active spending bucket card (e.g. 'bucket_groceries')

[T1] PersonalScreen renders cards by iterating nova_v2_personal_card_order, skipping any card whose visibility condition is false

[T2] CardOrderSheet component for Settings
   Renders a drag-to-reorder list of active card names
   Only shows cards that are currently visible (respects bucket and goal visibility conditions)
   Save button writes new order to nova_v2_personal_card_order in store
   Reorder icon (≡) per row

[T1] Add "Customize Card Order" entry to SettingsScreen under a new Display section
   Tapping opens CardOrderSheet

---

## FEATURE 3 — Date Picker: Format + Calendar UI

### Problem
The payday date input in OnboardingIncomeScreen currently shows a YYYY-MM-DD text field. This needs two changes:
1. Display format changed to MM/DD/YYYY
2. Text input replaced with a tap-to-open calendar picker

### Audit required
Read OnboardingIncomeScreen.js:
- How is the date input currently implemented? (TextInput, DateTimePicker, or custom?)
- What format is the date stored in internally? (Keep internal storage format as-is — only change display and input method)
- Are there any other date inputs in the wizard or in modals that use the same YYYY-MM-DD pattern? List them all — fix them all in this pass.

### Fix to implement
[T2] DatePickerField component
   Props: value (stored date string), onChange (callback with updated date string), label
   Display: shows selected date formatted as MM/DD/YYYY, or "Select a date" placeholder if empty
   On tap: opens a modal calendar overlay
   Calendar overlay:
   - Shows current month by default, or the month of the currently selected date if one exists
   - Left arrow / right arrow to move between months
   - Day grid: tappable day cells, selected day highlighted in theme accent color
   - Today's date subtly indicated
   - Selecting a day closes the overlay and calls onChange with the date in the same internal storage format that was already being used (do not change storage format)
   - No YYYY-MM-DD text visible to the user at any point

[T1] Replace every date TextInput in the wizard and in any modal that currently shows YYYY-MM-DD with DatePickerField
   Confirm: OnboardingIncomeScreen payday input
   Confirm: any bill due date inputs that show raw date strings
   Confirm: any other wizard step date fields

---

## REPORT FORMAT

After auditing, report in this format before writing any code:

GROCERY CARD AUDIT:
[current render condition, data source, canonical type field available or needs adding]

OTHER CARDS THAT SHOULD FOLLOW SHOW/HIDE PATTERN:
[list every card and what wizard selection should drive its visibility]

SAVINGS GOAL CARD:
[confirm goal shape in store, confirm no existing card, confirm account registry lookup path]

CURRENT PERSONAL CARD LIST AND ORDER:
[list all cards in current render sequence with their id assignments]

DATE INPUT AUDIT:
[current implementation, internal storage format, list of all date inputs across wizard and modals]

READY TO IMPLEMENT: YES / NO

---

After confirmation, implement all three features in this phase order:

Phase 1 — DatePickerField component + all date input replacements [T2 component, T1 wiring]
Phase 2 — Spending bucket card visibility system [T1 store logic, T2 no new components needed]
Phase 3 — SavingsGoalCard [T2 component, T1 mount + visibility]
Phase 4 — Card order system [T1 store + PersonalScreen, T2 CardOrderSheet]

Commit after each phase.

Do not open any files in an external editor. Terminal only.
Project directory: C:\Projects\nova-v2\