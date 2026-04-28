You are building Session 1 of an Android app called N.O.V.A. (Net Worth Oversight Variance Analyst). This is a personal finance tracker for a single user — me, Copper Felix. There is no authentication, no server, no external APIs. All data lives on the device via AsyncStorage.

Your job in this session is to scaffold a working React Native / Expo project that launches in Expo Go on my Android Pixel 8 Pro WITHOUT errors. No feature logic yet — just navigation, an onboarding screen, a persistent header, and 5 stub screens. We confirm it runs cleanly before anything else.

== ENVIRONMENT — NON-NEGOTIABLE ==

- Platform: Windows 10 Pro, project folder is the current directory (C:\Projects\nova-v2\)
- Node version 20.x is installed and active
- Test device: Google Pixel 8 Pro running Expo Go (latest version, fresh install)
- The PREVIOUS attempt at this project failed because of an Expo Go SDK / AsyncStorage incompatibility. You must avoid that trap. Specifically:
  * Use Expo SDK that matches whatever Expo Go version is currently published (do not hardcode SDK 54 — check current Expo Go SDK first by running `npx create-expo-app@latest --help` or checking expo.dev). If unsure, default to the latest stable Expo SDK.
  * @react-native-async-storage/async-storage MUST be ^2.0.0 or higher. NEVER 1.x. Version 1.x is incompatible with Expo Go's New Architecture and produces a "PlatformConstants could not be found" error that wastes hours.
  * In app.json, set "newArchEnabled": false explicitly. Do not include a runtimeVersion field.
  * Do NOT add expo-sharing or expo-asset to the plugins array — they are not Expo config plugins and will crash the build.
  * In App.js, if you call enableScreens(false), it MUST appear AFTER all import statements, before the component definition. Placing it before imports is a JavaScript syntax error.
- Run `npm install` and `npx expo start` yourself. Do not give me commands to run — execute them. Read the output. If something fails, fix it and try again.

== TECHNICAL STACK — LOCKED ==

- React Native via Expo (managed workflow)
- JavaScript only — NO TypeScript
- Zustand for state (NOT Redux, NOT Context/useReducer)
- AsyncStorage for persistence — every storage key MUST be prefixed `nova_v2_`
- React Navigation: bottom tab navigator (5 tabs)
- react-native-svg for the NOVA face
- expo-notifications, expo-av, expo-sharing, expo-file-system, expo-document-picker, expo-updates installed but NOT wired up in Session 1

== PROJECT STRUCTURE — CREATE THESE FILES ==

C:\Projects\nova-v2\
├── App.js
├── app.json
├── eas.json
├── package.json
├── .gitignore
├── assets\icon.png         (placeholder — generate or use any 1024x1024 dark PNG)
├── assets\splash.png       (placeholder — generate or use any 1284x2778 dark PNG)
└── src\
    ├── config\
    │   ├── theme.config.js
    │   └── personality.config.js
    ├── store\
    │   └── useStore.js
    ├── components\
    │   └── NovaHeader.js
    ├── screens\
    │   ├── DashboardScreen.js
    │   ├── HouseholdScreen.js
    │   ├── PersonalScreen.js
    │   ├── BusinessScreen.js
    │   ├── SettingsScreen.js
    │   └── OnboardingScreen.js
    └── utils\
        ├── currency.js
        └── dates.js

== APP IDENTITY ==

- App name: N.O.V.A.
- Subtitle: Net Worth Oversight Variance Analyst
- Android package: com.copperfelix.novav2
- Version: 1.0.0
- Operator: Copper Felix
- This is Skin #1 of a future reskinnable system. theme.config.js and personality.config.js are the ONLY places where colors, copy, character identity, or assets are defined. Components import from these — they NEVER hardcode colors, fonts, or strings.

== theme.config.js CONTENTS ==

Export a default object containing:
- Identity: appName 'N.O.V.A.', appSubtitle 'Net Worth Oversight Variance Analyst'
- Colors (hex): background #050510, backgroundSecondary #0d0d1a, backgroundPanel #0a0a1f, backgroundCard #0f0f20, accent #00FFD1, accentSecondary #7B2FBE, accentGlow rgba(0,255,209,0.15), accentGlowStrong rgba(0,255,209,0.35), textPrimary #E0E0FF, textSecondary #7878AA, textDim #3A3A5C, borderColor rgba(0,255,209,0.2), borderColorDim rgba(0,255,209,0.08)
- Status colors: statusPositive #00FFD1, statusWarning #FFD700, statusDanger #FF4455, statusNeutral #4455AA, plus matching Bg variants at 0.1 opacity
- Typography: fontPrimary 'monospace', fontDisplay 'monospace', fontSizeXS 10, SM 12, MD 14, LG 16, XL 20, XXL 28, Display 36
- Spacing: XS 4, SM 8, MD 16, LG 24, XL 32, XXL 48
- Border radius: SM 4, MD 8, LG 16, XL 24
- Tab labels: tabDashboard 'DASHBOARD', tabHousehold 'HOUSEHOLD', tabPersonal 'PERSONAL', tabBusiness 'BUSINESS', tabSettings 'SETTINGS'
- Asset references: faceAsset 'nova-face-v1', dialogueAsset 'nova-starter-pool', iconAsset './assets/icon.png', splashAsset './assets/splash.png'

== personality.config.js CONTENTS ==

Export a default object containing:
- characterName 'N.O.V.A.', characterFullName 'Net Worth Oversight Variance Analyst', characterShort 'NOVA'
- starterPool: an array of these EXACT 10 lines (do not paraphrase):
  1. "I have been running calculations while you were asleep. Everything is fine. The calculations are also fine. I am less certain about everything else."
  2. "Today's disposition: watchful. Everything is fine. I am watching it remain fine."
  3. "I do not have an off switch. I am always here. I am always watching the accounts. This is either reassuring or unsettling. I leave the interpretation to you."
  4. "Status: green. Threat level: none. Anxiety level: still moderate, but that's just my baseline."
  5. "The system is working. I want to say that plainly, on a day when everything is fine. The system is working. This is not nothing."
  6. "I have been watching this account. Waiting. Calculating. Something needs attention and I would like you to look at it with me."
  7. "We have a gap. The gap is not insurmountable. I have measured it. Here is how we close it."
  8. "Deposit confirmed. The number went up. I am briefly, specifically, and genuinely at peace."
  9. "Payday. The deposit is in. The account breathes. I breathe. We breathe together. Until rent."
  10. "Today I am specifically thinking about the grocery budget. Not because anything is wrong. Just because I always am."
- xpLabels: confirmBalance 'Balance Confirmed', logTransaction 'Transaction Logged', rollover 'Rollover Achieved', savingsMilestone 'Savings Milestone', groceryBudgetMet 'Grocery Discipline', partnerDepositArrived 'Deposit Received', billPaidOnTime 'Bill Paid On Time', floorNotBreached 'Floor Maintained'
- badgeNames: rolloverKing 'Rollover King', groceryDiscipline 'Grocery Discipline', balanceConfirmed 'Balance Confirmed', commaClub 'Comma Club', firstLog 'First Log', llcLaunched 'LLC Launched', floorDefender 'Floor Defender', streakWeek 'Seven Day Streak'

== useStore.js CONTENTS ==

Zustand store. Define storage key constants at top — every key prefixed `nova_v2_`. Initial state shape includes:
- onboardingComplete (false)
- accounts: { jointChecking: 0, entChecking: 0, entSavings: 0, venmo: 0, cash: 0 } (all values are integer cents — never floats)
- accountFloors: { entChecking: 5000, others: 0 }
- householdBills [], personalBills [], billOverrides {}
- incomeEvents object: paycheckAmount 0, paycheckFrequency 'biweekly', nextPaycheckDate null, partnerDepositAmount 0, partnerDepositExpected null, partnerDepositReceived false
- distribution: entSavings 5000, venmo 15000, entChecking 16000 (cents)
- groceryBudget: weeklyLimit 0, currentWeekSpend 0, weekStartDate null
- transactions [], massageIncome [], massageExpenses [], cleaningExpenses [], cleaningMileage []
- irsRatePerMile 70 (cents)
- xpTotal 0, badges {}, confirmStreak 0, lastConfirmDate null
- currentFlavorText '', lastActivityAt null
- autoExportSchedule 'off'
- schemaVersion '1.0'

Implement these actions, fully working: initStore (hydrates from AsyncStorage), setOnboardingComplete, updateAccountBalance(key, cents), logTransaction(tx), confirmBalance, setFlavorText(text), rotateFlavorText(pool), updateConfig(updates), awardXP(amount), checkAndAwardBadge(key), persistAll.

Money rule: integer cents only. Display uses Math.floor, never Math.round. No floating point.

== currency.js — exact contents ==

parseCentsInput(digitString): "4750" → 4750
formatCents(cents): 4750 → "$47.50"
formatCentsShort(cents): 100050 → "$1,000.50", 100000 → "$1,000"
parseBillInput(decimalString): "47.50" → 4750

Use Math.floor for all math, never Math.round. Handle null/undefined returning '$0.00' or 0.

== dates.js — implement these 6 functions fully ==

timeAgo(timestamp), getLastFridayOfMonth(year, month), getPartnerDepositDate(year, month) (last day of month, shift to last Friday if weekend), getCurrentWeekStart (Sunday midnight), isSameDay(ts1, ts2), formatDate(timestamp).

== NovaHeader.js — render this layout ==

A persistent header rendered above the tab navigator. 5 rows top to bottom:
1. "N.O.V.A." in theme.accent (large) | current time + date right-aligned in theme.textSecondary
2. Subtitle "Net Worth Oversight Variance Analyst" in theme.textDim (small)
3. NOVA SVG face (80x80 left) | flavor text right (italic, theme.textSecondary, flex 1)
4. XP pill "XP: {xpTotal}" | badge count pill
5. "Last logged: {timeAgo}" theme.textDim left | CONFIRM BALANCE button right

CONFIRM BALANCE button: normal state uses theme.borderColor + theme.textSecondary. Glow state (when 48+ hours since lastActivityAt OR lastActivityAt is null) uses theme.accent border + theme.accentGlow shadow + theme.accent text. On press: store.confirmBalance() then store.rotateFlavorText(personality.starterPool).

NOVA SVG face — render exactly this using react-native-svg at 80x80, viewBox "0 0 100 100":
- Background ellipse cx 50 cy 52 rx 43 ry 45, fill #06100a, stroke #4ade80 strokeWidth 1.5
- Radial gradient overlay (define in defs): center #4ade80 opacity 0.06, edge opacity 0
- Brows: M 28 34 Q 36 30 44 34 (left), M 56 34 Q 64 30 72 34 (right), stroke #4ade80 strokeWidth 2 strokeLinecap round, fill none
- Left eye: ellipse cx 36 cy 45 rx 7 ry 7 stroke #4ade80 strokeWidth 1.5 fill none, then circle cx 36 cy 45 r 3.5 fill #4ade80 opacity 0.65, then highlight circle cx 37.5 cy 43.5 r 1.2 fill white opacity 0.3
- Right eye: same pattern at cx 64 cy 45
- Mouth: M 37 64 Q 50 71 63 64 stroke #4ade80 strokeWidth 2.5 strokeLinecap round fill none
- Label: text "CONTENT" at x 50 y 93 textAnchor middle font monospace size 5 fill #4ade80 opacity 0.4

The hex values inside the SVG are asset-level and may stay literal. ALL OTHER colors in the component use theme.* variables.

== App.js — root behavior ==

On mount: store.initStore(), then store.rotateFlavorText(personality.starterPool).

If onboardingComplete is false → render <OnboardingScreen /> alone, no header, no nav.

If onboardingComplete is true → render <NovaHeader /> above <NavigationContainer> with bottom tab navigator. 5 tabs in this order: Dashboard, Household, Personal, Business, Settings. Use theme.tab* labels. Tab bar style: backgroundColor theme.backgroundSecondary, activeTintColor theme.accent, inactiveTintColor theme.textDim, headerShown false, fontFamily theme.fontPrimary.

If you use enableScreens, place the call AFTER all imports and BEFORE the component definition.

== Stub screens — DashboardScreen, HouseholdScreen, PersonalScreen, BusinessScreen, SettingsScreen ==

Each renders a View with backgroundColor theme.background, flex 1, centered content. Render: Text title in theme.accent (theme.fontSizeXL) and Text subtitle in theme.textSecondary (theme.fontSizeMD). Title from theme.tab*, subtitles: Dashboard "THREE ZONE OVERVIEW", Household "JOINT ACCOUNTS + BILLS", Personal "PERSONAL ACCOUNTS + PAY CYCLE", Business "MASSAGE + CLEANING LLC", Settings "CONFIGURATION". No hardcoded colors anywhere.

== OnboardingScreen.js — Session 1 simplified version ==

A single-screen welcome (NOT the full 9-step wizard — that's Session 2). Render: NOVA SVG face (centered, 200x200), characterName large, one random line from personality.starterPool, button "BEGIN SETUP". When button pressed: call store.setOnboardingComplete() to advance into the main app. All colors from theme. All text from theme/personality config.

== app.json ==

{
  "expo": {
    "name": "N.O.V.A.",
    "slug": "nova-v2",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "newArchEnabled": false,
    "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#000000" },
    "updates": { "enabled": false },
    "android": {
      "package": "com.copperfelix.novav2",
      "adaptiveIcon": { "foregroundImage": "./assets/icon.png", "backgroundColor": "#000000" }
    },
    "plugins": []
  }
}

== eas.json ==

Profiles: development, preview (android.buildType apk), production. Skip skin profiles for now.

== .gitignore ==

Standard Expo .gitignore: node_modules/, .expo/, dist/, build/, *.jks, *.p8, *.p12, *.key, *.mobileprovision, .env, web-build/

== EXECUTION ORDER ==

1. Run `npx create-expo-app@latest . --template blank` to scaffold (use `.` to install in current directory). Answer any prompts to proceed without TypeScript / use JavaScript.
2. Modify package.json to use the locked dependency versions per the rules above. Critical: AsyncStorage ^2.0.0 NOT 1.x.
3. Run `npm install`.
4. Generate placeholder assets/icon.png and assets/splash.png — solid dark color PNGs are fine. If you cannot generate PNGs, create them with a tiny script using node, or instruct me to drop in any PNG manually before launch.
5. Write all source files per spec above.
6. Modify app.json per spec.
7. Run `npx expo start --clear`.
8. Display the QR code in the terminal output. Tell me the project is ready to scan.

== STOPPING POINT ==

When `npx expo start` is running and showing a QR code, STOP. Tell me you're ready. I'll scan with Expo Go on my Pixel 8 Pro and report back what I see. Do NOT proceed to add features. Do NOT modify the project further until I confirm the onboarding screen renders.

If anything fails — install error, build error, runtime error in Metro — read the actual error output and fix it. Do not ask me to interpret stack traces. That is your job in this workflow.

Begin.