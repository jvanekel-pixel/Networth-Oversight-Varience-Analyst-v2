# NOVA Session 8 Personality + Face Expansion Archive

Date: 2026-05-04

This archive captures the V1 personality expansion pass requested after the final audit work. The goal was to make NOVA feel more alive in normal use: more language, more trigger specificity, more badge-aware reactions, and a much larger face library tied to states/events.

## Current State

NOVA now has a bundled offline response system instead of a small hardcoded quote pool. The app can still run without any backend, login, or network dependency for personality behavior. Responses are now selected from:

- The original core state response pack.
- A new generated event/state expansion pack.
- Built-in fallback copy in `novaState.config.js`.

NOVA now has:

- 3,989 bundled response lines total.
- 3,050 newly generated V1 expansion lines.
- 61 event-specific response triggers.
- 28 response states.
- 112 documented/renderable face states.
- Badge-tier aware response support.
- Response-level `faceKey`, `animationKey`, `tags`, `weight`, and optional unlock metadata.

## Major Completed Work

### 1. Response Library Architecture

Added a normalized response picker layer so future response packs can be added without hardcoding copy directly into components.

Primary files:

- `src/utils/novaResponseLibrary.js`
- `src/utils/novaStateEngine.js`
- `src/data/nova-responses.json`
- `src/data/nova-expanded-responses.json`
- `scripts/generateNovaExpansionPack.js`

Completed behavior:

- Supports `state`, `event`, and `packs[].lines[]` response formats.
- Dedupes repeated text across merged pools.
- Supports weighted response selection.
- Avoids immediately repeating the current header line when alternatives exist.
- Supports badge/tier-gated responses through `unlock` / `unlocks`.
- Supports response-attached `faceKey` and future-facing `animationKey`.
- Keeps old state-based behavior as a fallback.

### 2. Generated Expansion Pack

Added `scripts/generateNovaExpansionPack.js`, which generates `src/data/nova-expanded-responses.json`.

Generated output:

- 3,050 response lines.
- 61 event types.
- 50 responses per event type.
- 0 duplicate generated texts.
- 0 retired service-keyword hits in generated text.
- 0 invalid generated face references.

Examples of generated event categories:

- Income and expense logging.
- Large/small/uncategorized transactions.
- Transfers.
- Savings deposits and draws.
- Balance adjustments up/down.
- Bills paid on time/late.
- Grocery logging, warnings, closeouts, and streaks.
- Scheduled income, payday, partner deposits, payday split/rollover.
- Red/yellow/green status changes.
- Fresh month, zero waste, overflow, comma milestones.
- Business income, expenses, mileage, profit/tax-ready moments.
- Export/import/auto-export.
- Onboarding complete.
- Account/settings/category changes.
- Search/report/chart reactions.
- Badge unlocks by tier: bronze, silver, gold, platinum, onyx.

### 3. New State Options

Expanded NOVA state metadata from the original risk/milestone states into a broader V1 state map.

New state categories added:

- `income`
- `expense`
- `transfer`
- `savings_deposit`
- `business`
- `export`
- `import`
- `onboarding`
- `account`
- `search`
- `report`
- `badge_unlock`

Existing action states now borrow from larger emotional families using `copySourceStates`. This keeps specific states like `bill_paid` or `confirm_balance` from feeling shallow while preserving their state labels/faces.

### 4. Trigger Wiring

NOVA now reacts to more specific app actions instead of routing most actions through generic transaction or green/yellow/red responses.

Primary file:

- `src/store/useStore.js`

New or refined runtime triggers:

- `onboarding_complete`
- `balance_adjustment_up`
- `balance_adjustment_down`
- `transaction_income`
- `transaction_expense`
- `transaction_large_expense`
- `transaction_tiny_expense`
- `transaction_uncategorized`
- `transfer`
- `savings_deposit`
- `savings_withdrawal`
- `bill_paid_on_time`
- `bill_paid_late`
- `grocery_logged`
- `grocery_warning`
- `scheduled_income`
- `partner_deposit`
- `rollover`
- `post_payday_action`
- `reserve_on`
- `reserve_off`
- `account_added`
- `settings_saved`
- `business_income`
- `business_expense`
- `business_mileage`
- `business_tax_ready`
- `red_status`
- `yellow_status`
- `green_status`
- badge-tier events

Additional screen/action surfaces:

- `ReportsScreen` triggers `report_opened`.
- `TransactionSearchScreen` triggers `transaction_search`.
- Export/import flows trigger `export_complete`, `import_complete`, and `auto_export`.

### 5. Badge-Aware Language

Badge unlock behavior now routes through NOVA's state system.

Completed behavior:

- Badge tier unlocks can trigger a NOVA response.
- Tier-specific event keys are supported:
  - `badge_bronze`
  - `badge_silver`
  - `badge_gold`
  - `badge_platinum`
  - `badge_onyx`
- Response lines can require badge ownership or minimum tier.
- Risk states still avoid being overwritten by badge celebration when the app is in a red/yellow status.

### 6. Face Library Expansion

Expanded `NovaFace` from a small static face set into generated face variants.

Primary files:

- `src/components/NovaFace.js`
- `src/config/novaState.config.js`

Completed behavior:

- Base face definitions are still explicit and readable.
- Derived variants are generated from base faces.
- Variant roles:
  - `focus`
  - `soft`
  - `spark`
  - `scan`
  - `pulse`
  - `deep`
- Rendered variants adjust glow, scan intensity, eye position, and add visible role-specific SVG marks.
- `NOVA_FACE_STATES` documents 112 face states.
- State metadata now has `facePool` arrays.
- Generated response lines include valid `faceKey`s that map into the face library.

## Verification

Commands run:

```powershell
node scripts\generateNovaExpansionPack.js
npx expo export --platform android
npx expo-doctor
git diff --check
npx expo config --type introspect --json
```

Results:

- Android export passed.
- Expo doctor passed 17/17 checks.
- `git diff --check` passed with only existing CRLF warnings.
- Android manifest still has `allowBackup=false`.
- Android positive permissions remain limited to `INTERNET` and `VIBRATE`.
- Generated response audit passed:
  - 3,050 expansion lines.
  - 61 events.
  - 3,989 total bundled response lines.
  - 28 response states.
  - 112 face states.
  - 0 duplicate generated texts.
  - 0 retired service-keyword hits.
  - 0 invalid generated face references.

## Files Changed In This Build Set

New files:

- `scripts/generateNovaExpansionPack.js`
- `src/data/nova-expanded-responses.json`
- `src/data/nova-responses.json`
- `src/utils/novaResponseLibrary.js`
- `NOVA_SESSION_8_PERSONALITY_FACE_EXPANSION_ARCHIVE.md`

Updated files:

- `src/utils/novaStateEngine.js`
- `src/config/novaState.config.js`
- `src/components/NovaFace.js`
- `src/store/useStore.js`
- `src/hooks/useExport.js`
- `src/screens/ReportsScreen.js`
- `src/screens/TransactionSearchScreen.js`

## Design Notes

The expansion pack is generated rather than hand-authored because V1 needs broad coverage quickly, and the generator makes it easy to regenerate consistently. Hand-authored lines should still be added later for the most emotionally important moments.

Best near-term hand-authored targets:

- Red-status shortfall lines with bill/account context.
- Yellow recovery lines.
- Savings deposit streaks.
- Grocery streaks.
- Badge unlocks for each named badge and tier.
- Business profit/tax-ready comments.
- Import/export safety comments.
- First-week onboarding reactions.

## Future Build Plan

### Immediate V1 Polish

Add a curated handwritten pack on top of the generated pack:

- 20 lines per named badge.
- 20 lines per badge tier.
- 25 lines for red shortfall.
- 25 lines for yellow recovery.
- 25 lines for green stability.
- 25 lines for business income/expense/mileage.
- 25 lines for grocery discipline.
- 25 lines for savings goal progress.

### V1.1 / V2 Direction

Add context interpolation:

- `{amount}`
- `{accountName}`
- `{billName}`
- `{category}`
- `{badgeName}`
- `{tier}`
- `{daysLeft}`
- `{projectedBalance}`

Add response memory:

- Per-event cooldowns.
- Recently used response IDs.
- Favorite/rare line weights.
- Time-of-day response flavor.
- "NOVA is getting to know you" progression.

Add animation integration:

- Use `animationKey` from response entries.
- Map badge unlocks to pulse/spark animations.
- Map red/yellow states to scan intensity.
- Map calm green states to soft idle loops.

Add expansion packs:

- Core NOVA.
- Spicy NOVA.
- Gentle NOVA.
- Business NOVA.
- Badge celebration pack.
- Seasonal/holiday pack if desired.

## Handoff Notes

The current implementation is intentionally offline and bundled. There is no remote content fetch, no dynamic script execution, and no backend dependency. That keeps the app simpler for V1 marketplace review and tester distribution.

The main risk is content quality, not runtime architecture. The generated lines are structurally valid and broad, but the most important emotional beats should still get hand-authored polish before public V1 if time allows.

