# FORGE SESSION ARCHIVE
Date: 2026-04-28
App: NOVA V1 (codename: NOVA)
Project path: C:\Projects\nova-v2\
Session type: Build (Session 2.5 + Session 3 combined)
Coding tool used: Claude Code (claude CLI in PowerShell)
Handoff target: Qwen2.5-Coder:14b via Continue in VS Code

---

## PERMANENT DETAILS (carry forward always)

- Operator: Copper Felix / CFLX-01
- Machine: Windows 10 Pro, GeForce RTX 3060 8GB, 64GB RAM
- Primary coding tool going forward: Qwen2.5-Coder:14b via Ollama + Continue extension in VS Code
- Claude Pro retained for: planning, debugging, prompt writing, handoff archives (this document)
- ChatGPT Plus retained for: DALL-E 3 image generation only
- Test device: Pixel 8 Pro running Expo Go SDK 54
- Test command: `npx expo start --tunnel` (LAN is blocked on operator's network — always tunnel)
- Claude Code command: `claude` (run from inside project folder in PowerShell)
- All apps target Android APK first. iOS always deferred.
- Default stack: React Native via Expo, JavaScript (not TypeScript), AsyncStorage ^2.0.0, EAS Build
- All storage keys use `nova_v2_` prefix — never change this
- `newArchEnabled: false` in app.json — never change this
- All money stored as integer cents. Math.floor for display. Never Math.round.
- All colors/fonts/copy from theme.config.js or personality.config.js. Never hardcode.
- Every app assumes skin/theme architecture from session 1 — reskinnable and remarketed.
- Operator supplies all creative assets (art, dialogue, sound) — AI stubs placeholders only.

---

## SESSION 2.5 — DECISIONS MADE AND CONFIRMED

### Stack / Environment
- AsyncStorage stays ^2.0.0 (confirmed, currently 2.2.0 in package.json)
- Expo SDK 54, React Native 0.74.5, Zustand ^5.0.12 — confirmed in package.json
- No new dependencies added in Session 2.5

### Bill Schema Upgrade (Part 3)
Old bill shape: `{ id, name, amountCents, dueDay }`

New bill shape (V1.2):
```javascript
{
  id: 'bill_001',
  name: 'Rent',
  amountCents: 235000,
  expectedDay: 1,
  isAutoDraft: true,
  isActive: true,
  lastPaidDate: null,         // ms timestamp
  lastPaidAmountCents: null,
  lastPaidMonth: null,        // 'YYYY-MM'
  defaultAccountKey: 'jointChecking',
  createdAt: Date.now(),
}
```

- Migration shim (`upgradeBillIfNeeded`) runs in `initStore()` — idempotent, non-destructive
- `dueDay` field left in place on migrated bills (not deleted)
- Migration confirmed working — existing $235,000 rent bill survived with all data intact

### Monetary Input (Part 1)
- All money input modals switched from `keyboardType="numeric"` + `parseCentsInput` to `keyboardType="decimal-pad"` + `parseBillInput`
- Live formatted preview below every money input using `formatCentsShort`
- Placeholder: "0.00", disabled submit if input is 0 or NaN

### Display Formatting (Part 2)
- All money display switched from `formatCents` to `formatCentsShort` (hides .00 on round numbers)
- Store still uses integer cents — display layer only changed

### Mark Paid Form (Part 5)
- Replaced one-tap MARK PAID with a full form modal
- Fields: bill name (read-only header), date paid (Month/Day/Year numeric inputs with live preview), amount paid (decimal input, defaults to expected amount), account dropdown (defaults to bill's defaultAccountKey), notes (optional)
- On confirm: debits account, updates bill's lastPaidDate/lastPaidAmountCents/lastPaidMonth, awards XP +5, triggers NOVA flavor rotation, checks spending floors
- `markBillPaid(billId, { paidDate, paidAmountCents, accountKey, notes })` — rewrote the existing one-tap version

### Session 2.5 — What Did NOT Ship (open debt carried into Session 3)
The following were in the Session 2.5 spec but were confirmed MISSING during Session 3's survey:
- `editBill(billId, updates)` — store action does not exist
- `deleteBill(billId)` — store action does not exist
- `editTransaction(transactionId, updates)` — store action does not exist
- `deleteTransaction(transactionId)` — store action does not exist
- Long-press bill → action menu (EDIT BILL / MARK PAID / DELETE BILL) — UI not built
- Long-press transaction → action menu (EDIT / DELETE) — UI not built
- "Recent Activity" section on Household and Personal screens — not built

These four store actions and their UI are being built as part of Session 3, Part 2 — before the Calendar needs them. This is the right resolution.

### Session 2.5 Git commit
`Session 2.5 complete - schema upgrade, decimal input, edit/delete bills + transactions`
Note: Commit message says "edit/delete bills + transactions" but those features did not fully ship — commit message is aspirational. The schema migration and decimal input did ship.

---

## SESSION 3 — STATUS AS OF HANDOFF

Session 3 was started with Claude Code. Survey completed. Two decisions made. Build not yet started.

### Survey findings (confirmed clean except two items)
- All 9 confirmed store actions that need `recomputeVariance()` appended: `logTransaction`, `distributePaycheck`, `recordPartnerDeposit`, `addHouseholdBill`, `addPersonalBill`, `markBillPaid`, `logGrocerySpend`, `updateAccountBalance`, `updateConfig`
- `formatCentsShort` ✅, `parseBillInput` ✅, `getCurrentWeekStart` ✅ (in dates.js), `getPartnerDepositDate` ✅ (in dates.js), `timeAgo` ✅, `formatDate` ✅
- DashboardScreen.js ✅ confirmed stub
- App.js: only a bottom tab navigator — no stack navigator yet. CalendarScreen requires wrapping tabs in a createNativeStackNavigator. AppState not yet imported.
- All theme tokens present EXCEPT: `theme.radiusLG` does not exist — equivalent is `theme.borderRadiusLG` (= 16). **Decision: add `radiusLG: 16` alias to theme.config.js.**

### Session 3 decisions confirmed
1. **radiusLG alias** — add `radiusLG: 16` to theme.config.js before building
2. **editBill / deleteBill / editTransaction / deleteTransaction** — build fully (store action + modal UI) as part of Part 2, not minimal stubs. Calendar's tap-to-edit depends on these being real.

### Session 3 — What still needs to be built (everything)
Execute in this order:

**Part 2 — State additions + missing Session 2.5 actions**
- Add `varianceConfig`, `varianceCache`, `lastCycleResetMonth` to store initial state
- Add storage key: `KEYS.VARIANCE_CONFIG = 'nova_v2_variance_config'`
- Add actions: `recomputeVariance()`, `updateVarianceConfig(profile, updates)`, `checkCycleReset()`
- Append `get().recomputeVariance()` to all 9 financial actions listed above
- Build the four missing Session 2.5 actions with full UI: `editBill`, `deleteBill`, `editTransaction`, `deleteTransaction` — including long-press action menus on bill rows and transaction rows, and Recent Activity section on Household + Personal screens
- Add two useEffects to App.js: (1) `checkCycleReset()` + `recomputeVariance()` on mount, (2) `checkCycleReset()` on AppState 'active'
- **Git commit after this part:** `"Session 3 checkpoint - variance state scaffold"`

**Part 1 — forecasting.js (pure functions)**
- Create `src/utils/forecasting.js`
- Functions: `getLastDayOfMonth`, `getCurrentCycleId`, `getCycleBounds`, `weeksRemainingInCycle`, `getBillEventsBetween`, `getIncomeEventsBetween`, `projectBalance`, `findMinimumProjectedBalance`, `computeProfileVariance`
- Business profile returns neutral stub in V1
- State classification: red if variance ≤ redThresholdCents OR redDate not null; yellow if dips below floor in 14 days; green if positive variance, no dip
- Annotation copy: see brief for exact strings

**Part 3 — Dashboard (replace stub)**
- Replace DashboardScreen.js entirely
- Layout: header strip → three profile variance cards → quick actions row → recent activity strip
- Cards: colored border/bg by state (green/yellow/red/neutral), balance line, variance line with explicit +/- sign, annotation line, tappable → navigate to zone tab
- Quick actions: VIEW CALENDAR (→ CalendarScreen), LOG TRANSACTION (→ Household tab for V1), CONFIRM BALANCE
- Recent activity: last 3 transactions across all accounts, non-deleted, sorted desc

**Part 4 — CalendarScreen (new file)**
- Create `src/screens/CalendarScreen.js`
- Add stack navigator in App.js wrapping the existing tab navigator
- Register CalendarScreen as a stack screen
- Layout: month header with chevrons + TODAY button → day-of-week row → calendar grid → selected day detail panel
- Grid: red dot (bill due), green dot (income event), blue dot (transaction logged)
- Danger day tinting: statusDangerBg if projected jointChecking below floor — only compute for days with bill events
- Detail panel: tappable rows → bill → EDIT BILL modal, income → Alert info only, transaction → EDIT TRANSACTION modal
- Only render visible month — no pre-computation of adjacent months

**Part 5 — Variance Thresholds in Settings**
- Add one section to Settings screen (still mostly stubbed)
- Per profile: red threshold field (default -$300, stored as -30000 cents), floor buffer field (default $0)
- Auto-save on blur

### Session 3 testing checklist (16 items — verify all before commit)
1. App launches without errors (no Session 2.5 regression)
2. Dashboard loads, three profile cards visible
3. Empty state: all profiles show $0, neutral
4. Add data (paycheck $1,200, partner deposit $500, rent $2,350 day 1, internet $90 day 12, grocery limit $200) → variance updates live
5. Household variance math correct
6. Personal variance math correct (all four accounts)
7. Tap Dashboard card → navigates to correct zone tab
8. VIEW CALENDAR → calendar opens, current month visible
9. Calendar red dots on bill days, green dots on income days
10. Tap day with events → detail panel updates, tap bill event → EDIT BILL modal opens
11. Edit bill → calendar and Dashboard update
12. Mark bill paid → paid indicator on calendar, variance updates
13. Settings → change Household red threshold to -$100 → state flips if variance between -$100 and -$300
14. checkCycleReset() fires correctly (test via debug or manual)
15. NOVA flavor text still rotates on transactions
16. No red error screens, Metro logs clean

### Final commit message (after all 16 pass)
`Session 3 complete - variance engine + dashboard + calendar`

---

## OPEN QUESTIONS FOR NEXT SESSION

- None blocking Session 3. All decisions confirmed.
- After Session 3: Session 4 = Business tab tracking (massage/cleaning logs). Session 5 = Settings full build, polish, notifications, date picker upgrade.

---

## DELIVERABLES PRODUCED THIS ARCHIVE PERIOD

- `SESSION_2_5_BRIEF_ClaudeCode.md` — Claude Code edition of Session 2.5 brief (in project root)
- `SESSION_3_BRIEF_ClaudeCode.md` — Claude Code edition of Session 3 brief (in project root)
- `FORGE_PROJECT_INSTRUCTIONS_v2.md` — Updated FORGE instructions for Qwen/Continue workflow (replace project instructions)

---

## NEXT SESSION STARTING POINT

Paste this archive at the top of the new FORGE project chat (Qwen edition). The next session is Session 3, starting at Part 2. Everything above is confirmed. No re-establishment needed.

**First message to Qwen via Continue:**

Open `useStore.js`, `theme.config.js`, `App.js`, `src/screens/HouseholdScreen.js`, `src/screens/PersonalScreen.js` in VS Code. Reference them with @file in Continue.

Then paste this as the first instruction block:

> You are working on the NOVA app at C:\Projects\nova-v2\. Session 3 is in progress. Survey was completed by a previous coding session — all findings confirmed clean. Two pre-work items before Part 2 begins:
>
> 1. In theme.config.js, add `radiusLG: 16` as an alias (one line — do not change anything else)
> 2. Confirm the alias exists, then proceed to Session 3 Part 2 per SESSION_3_BRIEF_ClaudeCode.md in the project root
>
> Read the brief now. Begin with Part 2. Survey is already done — do not re-survey. Edit only what the brief specifies for each part. Do not rewrite whole files.

After that, work through Parts 2 → 1 → 3 → 4 → 5 in order, committing after Part 2 completes.
