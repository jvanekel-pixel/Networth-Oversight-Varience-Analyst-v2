## FORGE SESSION ARCHIVE
Date: 2026-04-27
App: N.O.V.A. (Net Worth Oversight Variance Analyst) — v2 build
Session type: Forge + Build (Sessions 0 and 1 complete)

### PERMANENT DETAILS
- Operator: Copper Felix, handle CFLX-01
- Platform: Windows 10 Pro desktop, Node 20 via NVM, project at C:\Projects\nova-v2\
- Test device: Google Pixel 8 Pro, Expo Go (fresh install April 2026)
- Subscriptions: Claude Pro ($20), ChatGPT Plus ($20). Claude Code is the active build tool, used via Claude Pro.
- Build philosophy: prefer free/already-paid tools, AI must be able to see the real environment, no more blind copy-paste workflows
- Stack default: React Native via Expo, JavaScript (no TS), Zustand for state, AsyncStorage with versioned key prefix, EAS Build for APK

### DECISIONS LOCKED FOR NOVA V2
- Fresh project at C:\Projects\nova-v2\ (the v1 folder was deleted intentionally after a failed build)
- Storage key prefix: nova_v2_ on every key
- AsyncStorage version: ^2.0.0 (NEVER 1.x — incompatible with Expo Go New Architecture)
- app.json: newArchEnabled false, no runtimeVersion field, empty plugins array
- All visual values live in src/config/theme.config.js
- All character/personality values live in src/config/personality.config.js
- NOVA face V1: static n1-content SVG (calm green/teal, single face, full 50-face system deferred to V2)
- NOVA dialogue V1: 10-line starter pool (locked, see personality.config.js)
- All money stored as integer cents, Math.floor for display, never Math.round
- Account architecture (3 zones): Household (Joint Chase Checking + future Joint Savings), Personal (ENT Checking, ENT Savings, Venmo, Cash; CashApp is payment method only), Business (Massage sole prop + Cleaning LLC)
- Bi-weekly distribution: $50 ENT Savings, $150 Venmo, $160 ENT Checking (configurable)
- Rollover rule: pre-payday sweep of remaining ENT Checking → ENT Savings (biggest XP reward)
- Partner deposit logic: last day of month, shifts to last Friday if weekend
- Build broken into 4 sessions, see below

### SESSION 1 — COMPLETE ✅
Working scaffold confirmed on Pixel 8 Pro.
- All 17 files created (App.js, app.json, eas.json, package.json, .gitignore, theme.config.js, personality.config.js, useStore.js, NovaHeader.js, 6 screens, currency.js, dates.js)
- Onboarding screen renders, BEGIN SETUP advances to 5-tab navigator
- Persistent NOVA header with face, flavor text, XP/badges, Confirm Balance button
- All 5 tabs render stub content without errors
- Initial commit pushed to GitHub: jvanekel-pixel/Networth-Oversight-Variance-Analyst-v2 (or similar — confirm name)

### REMAINING SESSIONS
- Session 2: Household + Personal zones (transaction logging, bills, partner deposit, grocery budget, pay cycle, rollover, floors, NOVA reactions wired)
- Session 3: Business zones + full XP/badge system (Massage, Cleaning LLC, mileage, IRS rate, all 8 badges, Confirm Balance XP, payday template variables)
- Session 4: Notifications + exports + polish (8 notification types, JSON + CSV export, auto-export, settings screen, OTA config, final review)

### WORKFLOW THAT WORKS
1. FORGE writes SESSION_N_BRIEF.md, user saves to project folder
2. User tells Claude Code to read the file at exact path
3. Claude Code scaffolds, installs, launches Expo, displays QR
4. User scans, tests on Pixel
5. Commit + push before moving on
Big prompts go through .md files, NOT direct paste (PowerShell truncates long pastes silently)

### NEXT SESSION STARTING POINT
Session 2 brief is being written. Project state: Session 1 committed and working. No blockers. Resume with: "Build Session 2 of NOVA per SESSION_2_BRIEF.md".