Three targeted adjustments to the card order system. Do not touch anything else.

---

## FIX 1 — Remove Display Section from Settings, Move Card Order Buttons to Each Screen

Read SettingsScreen.js:
- Remove the Display section entirely — all three card order entries go away from Settings
- Do not leave an empty section header

Read PersonalScreen.js:
- At the very bottom of the scrollable content, below all cards and above nothing, add a single tappable row
- Label: "Card Order"
- Style it as a subtle secondary action — not a primary button, not a card. A simple text row with a chevron or right arrow, similar to a settings list item
- Tapping opens CardOrderSheet configured for personal cards

Read HouseholdScreen.js:
- Same treatment — add "Card Order" row at the bottom of scrollable content
- Only renders when userMode === 'partnered' (if somehow a solo user reaches this screen, row is hidden)
- Tapping opens CardOrderSheet configured for household cards

Read BusinessDetailScreen.js:
- Same treatment — add "Card Order" row at the bottom of scrollable content
- Tapping opens CardOrderSheet configured for business cards

The CardOrderSheet itself does not change — only where it is triggered from changes.

---

## FIX 2 — Variance Card Added to Card Order System as Always-Top Anchor

The variance banner currently renders above the ordered cards loop on all three screens. It should be included in the card order system but with a constraint: it is always pinned to the top of its section. The user can toggle its visibility but cannot move it below other cards.

Read PersonalScreen.js, HouseholdScreen.js, and BusinessDetailScreen.js:
- Identify exactly where the variance banner renders in each screen

Implementation:
- Add 'variance' to all three card order arrays
- Default position: first in every array
  - Personal: ['variance', 'accounts', 'pay_cycle', 'savings_goal', 'bills', 'grocery', 'recent_activity']
  - Household: ['variance', 'joint_balance', 'partner_deposit', 'grocery', 'bills', 'recent_activity']
  - Business: ['variance', 'business_balance', 'income', 'expenses', 'mileage', 'recent_activity']
- In the render loop, when the id is 'variance', render the variance banner exactly as it currently renders
- Pin behavior: in CardOrderSheet, the 'variance' row renders first and its up/down arrows are disabled — it cannot be moved. Its hide toggle works normally.
- Card display name: "Variance Summary"
- If variance is hidden: the banner does not render, the rest of the cards shift up

---

## FIX 3 — Add Hide Toggle to Every Card in CardOrderSheet

Read CardOrderSheet.js:
- Currently each row has Up and Down buttons
- Add a Hide button to every row including variance (variance hide works, variance move does not)

Hide behavior:
- nova_v2_personal_card_order, nova_v2_household_card_order, nova_v2_business_card_order store the full order array including hidden cards
- Add a parallel nova_v2_personal_hidden_cards, nova_v2_household_hidden_cards, nova_v2_business_hidden_cards — each is an array of card id strings that are currently hidden
- Add updateHiddenCards action for each screen to store
- In each screen's render loop: skip rendering a card if its id is in the hidden cards array for that screen
- Hidden cards remain in the order array so their position is preserved if unhidden later

CardOrderSheet UI per row:
- Card display name (left)
- UP button — disabled if first in list or if card is 'variance'
- DOWN button — disabled if last in list or if card is 'variance'  
- HIDE button — if card is currently visible: shows "HIDE", tapping moves id to hidden array
- SHOW button — if card is currently hidden: row renders with dimmed/greyed style, shows "SHOW", tapping removes id from hidden array
- Hidden cards still appear in CardOrderSheet list so user can unhide them — they just render greyed out
- Save button writes both the order array and the hidden cards array to store

---

## AFTER FIXING

Confirm on device:

[ ] Settings — Display section is gone entirely
[ ] Personal screen — "Card Order" row appears at the bottom, tapping opens sheet
[ ] Household screen — "Card Order" row appears at the bottom, tapping opens sheet
[ ] Business screen — "Card Order" row appears at the bottom, tapping opens sheet
[ ] CardOrderSheet — Variance Summary appears first, up/down arrows disabled, hide toggle works
[ ] Hiding Variance Summary — banner does not render on screen
[ ] Showing Variance Summary — banner renders again
[ ] Any card can be hidden via the HIDE button
[ ] Hidden cards appear greyed out in the sheet with a SHOW button
[ ] SHOW restores the card to its position
[ ] Up/Down reordering still works for all non-variance cards
[ ] Card Order row in Household hidden when userMode === 'solo'

Commit: "Card order moved to screen footers + variance card added + hide toggle per card"

Do not open any files in an external editor. Terminal only.
Project directory: C:\Projects\nova-v2\