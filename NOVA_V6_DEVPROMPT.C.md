Two targeted adjustments to the card order system. Do not touch anything else.

---

## FIX 1 — Card Order System Expanded to All Three Screens

Currently nova_v2_personal_card_order and CardOrderSheet only cover PersonalScreen. Expand the system to cover HouseholdScreen and BusinessDetailScreen as well.

Read useStore.js:
- nova_v2_personal_card_order exists — keep it as-is
- Add nova_v2_household_card_order with default order based on current HouseholdScreen card sequence
- Add nova_v2_business_card_order with default order based on current BusinessDetailScreen card sequence
- Add updateHouseholdCardOrder and updateBusinessCardOrder actions matching the existing updateCardOrder pattern

Read HouseholdScreen.js:
- List every reorderable card in current render sequence
- Assign an id to each: 'joint_balance', 'partner_deposit', 'grocery', 'bills', 'recent_activity'
- Banners and floor warnings stay outside the loop — not reorderable
- Refactor render section to iterate nova_v2_household_card_order the same way PersonalScreen now does

Read BusinessDetailScreen.js:
- List every reorderable card in current render sequence
- Assign an id to each: 'business_balance', 'income', 'expenses', 'mileage', 'recent_activity'
- Refactor render section to iterate nova_v2_business_card_order the same way PersonalScreen now does

Read CardOrderSheet.js:
- Currently receives a hardcoded list of Personal card ids and labels
- Refactor to accept these props:
  - cards — array of { id, label } for all reorderable cards in this screen
  - currentOrder — the current saved order array
  - onSave — callback that receives the new order array
- CardOrderSheet becomes fully generic — no screen-specific logic inside it

Read SettingsScreen.js:
- Currently has one "Customize Card Order" entry that opens CardOrderSheet for Personal
- Replace with three separate entries under the Display section:
  - "Personal Card Order" — opens CardOrderSheet with personal cards + nova_v2_personal_card_order
  - "Household Card Order" — opens CardOrderSheet with household cards + nova_v2_household_card_order (only visible when userMode === 'partnered')
  - "Business Card Order" — opens CardOrderSheet with business cards + nova_v2_business_card_order (only visible when entrepreneurMode === true)

---

## FIX 2 — Grocery Card Added to Card Order System

Currently the Grocery card renders outside the ordered cards loop in both PersonalScreen and HouseholdScreen. It must be included in the reorder system.

PersonalScreen:
- Add 'grocery' to nova_v2_personal_card_order default array
- Default position: after 'bills', before 'recent_activity'
- Default order becomes: ['accounts', 'pay_cycle', 'savings_goal', 'bills', 'grocery', 'recent_activity']
- Move the Grocery card render into the ordered cards loop
- Visibility condition inside the loop: userMode === 'solo' AND active groceries bucket exists — same as before, just now position is controlled by order array

HouseholdScreen:
- Add 'grocery' to nova_v2_household_card_order default array
- Default position: after 'partner_deposit', before 'bills'
- Move the Grocery card render into the ordered cards loop
- Visibility condition: userMode === 'partnered' AND active groceries bucket exists

CardOrderSheet:
- 'grocery' card display name: "Grocery Budget"
- Grocery card only appears in the CardOrderSheet list when its visibility condition is true — same rule as all other cards

---

## AFTER FIXING

Confirm on device:

[ ] Settings → Display → Personal Card Order — opens sheet with Grocery Budget listed when groceries bucket is active
[ ] Settings → Display → Household Card Order — visible only in partnered mode, opens sheet with household cards including Grocery Budget when active
[ ] Settings → Display → Business Card Order — visible only when entrepreneur mode on, opens sheet with business cards
[ ] Reordering Grocery Budget card in Personal changes its position in PersonalScreen
[ ] Reordering Grocery Budget card in Household changes its position in HouseholdScreen
[ ] Grocery Budget card absent from CardOrderSheet when no groceries bucket is active

Commit: "Card order system expanded to all screens + grocery card added to order system"

Do not open any files in an external editor. Terminal only.
Project directory: C:\Projects\nova-v2\