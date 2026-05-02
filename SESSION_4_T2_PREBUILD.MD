You are working in a hybrid AI environment.
[T1] = handle yourself | [T2] = delegate to Ollama via: powershell -File C:\dev-env\invoke-ollama.ps1 -Prompt "<task>"
Do not pause between tasks. Do not ask for review unless output fails.
Do not open files in an external editor. Terminal only.
Project directory: C:\Projects\nova-v2\

---

## SESSION 4 — SCAFFOLDING PASS
## T2 tasks only. T1 logic tasks are explicitly marked STOP — do not attempt them.

---

## STEP 0 [T1] — Quick survey, no waiting

Read these files and confirm they exist. Do not edit anything.
Report the following, then immediately proceed to Part 1 without stopping:
- Does src/config/badges.config.js exist? (expected: no)
- Does src/screens/MassageScreen.js exist? (expected: no)
- Does src/screens/CleaningScreen.js exist? (expected: no)
- Does src/screens/BusinessSelectorScreen.js exist? (expected: no)
- In useStore.js initial state: confirm whether massageIncome, massageExpenses, cleaningExpenses, cleaningMileage arrays exist
- In useStore.js: confirm whether a KEYS object exists and what its current last key is
- In useStore.js: confirm the exact shape of the gamification object in initial state
- Confirm src/components/modals/ directory exists (if not, create it)

Proceed immediately to Part 1 after reporting.

---

## PART 1 [T2] — Add state arrays and storage keys to useStore.js

Run Ollama with this prompt:
"I have a React Native Zustand store at src/store/useStore.js. I need to add four new arrays to the initial state object and four new storage key constants to a KEYS object. Write only the two code fragments I need to insert — not the whole file. Fragment 1: the four initial state lines to add inside the existing state object: massageIncome: [], massageExpenses: [], cleaningExpenses: [], cleaningMileage: []. Fragment 2: the four storage key lines to add inside the existing KEYS object: MASSAGE_INCOME: 'nova_v2_massage_income', MASSAGE_EXPENSES: 'nova_v2_massage_expenses', CLEANING_EXPENSES: 'nova_v2_cleaning_expenses', CLEANING_MILEAGE: 'nova_v2_cleaning_mileage'. Output only the two labeled fragments. No explanation. No full file."

Take the output and use str_replace to insert the four state lines into the initial state block and the four key lines into the KEYS object. Do not rewrite the file.

---

## PART 2 [T2] — Create src/config/badges.config.js

Run Ollama with this prompt:
"Create a JavaScript ES module file src/config/badges.config.js for a React Native app. Export a const BADGES array with exactly 8 objects. Each object shape: { id: string, name: string, description: string, earned: false, earnedAt: null, icon: string }. The 8 entries: { id: 'first_log', name: 'First Log', description: 'First transaction logged', icon: '📝' }, { id: 'rollover_king', name: 'Rollover King', description: 'First ENT Checking rollover sweep', icon: '🏆' }, { id: 'grocery_discipline', name: 'Grocery Discipline', description: '4 consecutive weeks under grocery budget', icon: '🥦' }, { id: 'balance_confirmed', name: 'Balance Confirmed', description: '7-day Confirm Balance streak', icon: '✅' }, { id: 'comma_club', name: 'Comma Club', description: 'Any savings account reaches $1,000', icon: '💰' }, { id: 'llc_launched', name: 'LLC Launched', description: 'First Cleaning LLC expense logged', icon: '🏢' }, { id: 'massage_income', name: 'First Session', description: 'First massage income logged', icon: '💆' }, { id: 'cycle_complete', name: 'Full Cycle', description: 'Complete one full calendar month with all bills marked paid', icon: '📅' }. Also export: export const getDefaultBadges = () => BADGES.map(b => ({ ...b })); Write the complete file. No explanation."

Write the output directly to src/config/badges.config.js.

---

## PART 3 [T2] — Create src/screens/BusinessSelectorScreen.js

Run Ollama with this prompt:
"Create a complete React Native screen file src/screens/BusinessSelectorScreen.js. Requirements: Default export functional component. Uses navigation prop. Import theme from src/config/theme.config.js. No state needed. Layout wrapped in a ScrollView with backgroundColor theme.backgroundPrimary. At the top: Text 'BUSINESS' styled color theme.accent, fontSize theme.fontSizeXL, fontFamily theme.fontMono if it exists, marginTop 24, marginHorizontal 16. Below it: Text 'Select a zone' styled color theme.textSecondary, fontSize theme.fontSizeMD, marginHorizontal 16, marginBottom 24. Then two TouchableOpacity cards stacked vertically, each with: marginHorizontal 16, marginVertical 8, paddingVertical 40, borderRadius 12, borderWidth 2, borderColor theme.accent, backgroundColor theme.backgroundCard, alignItems center, justifyContent center. Card 1: Text 'MASSAGE', color theme.accent, fontSize theme.fontSizeXL. onPress: navigation.navigate('Massage'). Card 2: Text 'CLEANING LLC', color theme.accent, fontSize theme.fontSizeXL. onPress: navigation.navigate('Cleaning'). Write the complete file. No explanation."

Write output directly to src/screens/BusinessSelectorScreen.js.

---

## PART 4 [T2] — Create src/screens/MassageScreen.js

Run Ollama with this prompt:
"Create a complete React Native screen file src/screens/MassageScreen.js. Requirements: Default export functional component. Uses navigation prop. Import useStore from src/store/useStore. Import theme from src/config/theme.config.js. Import formatCentsShort from src/utils/currency.js. Use useState for: showIncomeModal (bool, false), showExpenseModal (bool, false), selectedRecord (null). Read from store: const massageIncome = useStore(s => s.massageIncome) and const massageExpenses = useStore(s => s.massageExpenses). Compute: incomeThisMonth = sum amountCents of massageIncome records where new Date(r.date).getMonth() equals current month and r.deleted !== true. incomeAllTime = sum amountCents of all non-deleted massageIncome. expensesThisMonth = sum amountCents of massageExpenses where current month and not deleted. Layout top to bottom inside a ScrollView: (1) Header: Text 'MASSAGE' color theme.accent fontSize theme.fontSizeXL marginHorizontal 16 marginTop 24. (2) Summary card: View with backgroundColor theme.backgroundCard borderRadius 12 margin 16 padding 16. Three rows each showing a label and value side by side: 'Income This Month' + formatCentsShort(incomeThisMonth) in theme.statusPositive, 'All-Time Income' + formatCentsShort(incomeAllTime) in theme.textPrimary, 'Expenses This Month' + formatCentsShort(expensesThisMonth) in theme.statusDanger. (3) Section header Text 'INCOME' uppercase color theme.textSecondary fontSize theme.fontSizeSM marginHorizontal 16 marginTop 16. (4) FlatList of massageIncome filtered to not deleted, sorted descending by date. Each row: TouchableOpacity with onLongPress showing Alert.alert with buttons Edit (sets selectedRecord) and Delete (placeholder). Row shows: date formatted as locale date string, amount in formatCentsShort green, paymentMethod, destinationAccount. keyExtractor by id. (5) Section header Text 'EXPENSES'. (6) FlatList of massageExpenses filtered not deleted sorted desc by date. Each row: date + formatCentsShort(amountCents) in theme.statusDanger + category. Long-press same Alert pattern. (7) Two buttons at bottom marginHorizontal 16 marginBottom 32: 'LOG INCOME' onPress sets showIncomeModal true, 'LOG EXPENSE' onPress sets showExpenseModal true. Both styled backgroundColor theme.accent, paddingVertical 14, borderRadius 8, Text color theme.backgroundPrimary textAlign center fontSize theme.fontSizeMD, marginVertical 8. Add placeholder Modal components: import LogMassageIncomeModal from src/components/modals/LogMassageIncomeModal and import LogMassageExpenseModal from src/components/modals/LogMassageExpenseModal. Render both at bottom of screen with visible prop and onClose handlers. onConfirm handlers are placeholder arrow functions for now. Write the complete file. No explanation."

Write output directly to src/screens/MassageScreen.js.

---

## PART 5 [T2] — Create src/screens/CleaningScreen.js

Run Ollama with this prompt:
"Create a complete React Native screen file src/screens/CleaningScreen.js. Default export functional component. Uses navigation prop. Import useStore from src/store/useStore. Import theme from src/config/theme.config.js. Import formatCentsShort from src/utils/currency.js. Use useState for showExpenseModal (false), showMileageModal (false), categoryExpanded (false). Read from store: cleaningExpenses and cleaningMileage arrays. Compute: expensesThisMonth = sum amountCents of non-deleted cleaningExpenses where current month. expensesAllTime = sum all non-deleted cleaningExpenses amountCents. mileageDeductionYTD = sum deductionCents of all non-deleted cleaningMileage records where new Date(r.date).getFullYear() equals current year. categoryTotals = reduce non-deleted cleaningExpenses into object keyed by category summing amountCents. Layout inside ScrollView: (1) Header Text 'CLEANING LLC' color theme.accent fontSize theme.fontSizeXL marginHorizontal 16 marginTop 24. (2) Summary card backgroundColor theme.backgroundCard borderRadius 12 margin 16 padding 16 with three rows: 'Expenses This Month' + formatCentsShort(expensesThisMonth) red, 'All-Time Expenses' + formatCentsShort(expensesAllTime) theme.textPrimary, 'Mileage Deduction YTD' + formatCentsShort(mileageDeductionYTD) green. (3) Section header 'EXPENSES'. FlatList of non-deleted cleaningExpenses desc by date. Each row: date + formatCentsShort(amountCents) red + category. Long-press Alert with Edit and Delete placeholders. (4) Section header 'MILEAGE'. FlatList of non-deleted cleaningMileage desc by date. Each row: date + miles.toFixed(1) + 'mi' + formatCentsShort(deductionCents) green. Long-press same. (5) TouchableOpacity section header 'BY CATEGORY' with chevron indicator that toggles categoryExpanded. When expanded: render Object.entries(categoryTotals) as rows showing category name + formatCentsShort(total). (6) Two buttons at bottom: 'LOG EXPENSE' and 'LOG MILEAGE' same style as MassageScreen buttons. Import LogCleaningExpenseModal and LogCleaningMileageModal as placeholders from src/components/modals/. Render both at bottom with visible and onClose props. onConfirm placeholder. Write complete file. No explanation."

Write output directly to src/screens/CleaningScreen.js.

---

## PART 6 [T2] — Create LogMassageIncomeModal

Run Ollama with this prompt:
"Create a complete React Native modal component file src/components/modals/LogMassageIncomeModal.js. Default export functional component. Props: visible (bool), onClose (func), onConfirm (func). Import theme from src/config/theme.config.js. Import parseBillInput from src/utils/currency.js. Use useState for: month (''), day (''), year (''), amount (''), paymentMethod ('cash'), destinationAccount ('cash'), notes (''). When paymentMethod changes to 'venmo' auto-set destinationAccount to 'entChecking'. When paymentMethod changes to 'cash' auto-set destinationAccount to 'cash'. Use useEffect for this dependency on paymentMethod. handleConfirm: construct date ms from parseInt(month)-1 month, parseInt(day), parseInt(year) using new Date(year, month-1, day).getTime(). Call onConfirm with { date, amountCents: parseBillInput(amount), paymentMethod, destinationAccount, notes }. Then call onClose. Validate: all of month day year amount must be non-empty, show Alert if missing. Layout: Modal component visible prop animationType slide transparent. Outer View flex 1 backgroundColor rgba(0,0,0,0.7) justifyContent flex-end. Inner View backgroundColor theme.backgroundCard borderTopLeftRadius 16 borderTopRightRadius 16 padding 24. Title Text 'LOG INCOME' color theme.accent fontSize theme.fontSizeLG marginBottom 20. Date row: three TextInput side by side with flex 1 each, placeholders 'MM' 'DD' 'YYYY', keyboardType numeric, value/onChange wired to state, backgroundColor theme.backgroundPrimary color theme.textPrimary borderRadius 8 padding 10 textAlign center. Label row above: Text 'Date' color theme.textSecondary. Amount: TextInput full width keyboardType decimal-pad placeholder '0.00' value amount onChange setAmount same input styling. Label 'Amount'. Payment method row: Text label 'Payment Method' then two TouchableOpacity buttons side by side 'CASH' and 'VENMO'. Selected button: backgroundColor theme.accent Text color theme.backgroundPrimary. Unselected: borderWidth 1 borderColor theme.borderColorDim Text color theme.textSecondary. Destination account row: same two-button pattern 'Cash' and 'ENT Checking'. Notes: TextInput placeholder 'Notes (optional)' same styling. Bottom row: two buttons side by side CANCEL (borderWidth 1 borderColor theme.borderColorDim text theme.textSecondary onPress onClose) and CONFIRM (backgroundColor theme.accent text theme.backgroundPrimary onPress handleConfirm). Write complete file. No explanation."

Write output to src/components/modals/LogMassageIncomeModal.js.

---

## PART 7 [T2] — Create LogMassageExpenseModal

Run Ollama with this prompt:
"Create a complete React Native modal component file src/components/modals/LogMassageExpenseModal.js. Default export functional component. Props: visible (bool), onClose (func), onConfirm (func). Import theme from src/config/theme.config.js. Import parseBillInput from src/utils/currency.js. useState for: month (''), day (''), year (''), amount (''), category ('supplies'), description (''), notes (''). Categories array: ['platform_fee', 'supplies', 'marketing', 'equipment', 'other']. handleConfirm: validate month day year amount non-empty else Alert. Call onConfirm({ date: new Date(parseInt(year), parseInt(month)-1, parseInt(day)).getTime(), amountCents: parseBillInput(amount), category, description, notes }). Then onClose. Layout: same Modal bottom-sheet pattern as other modals. backgroundColor theme.backgroundCard borderTopRadius 16 padding 24. Title 'LOG EXPENSE' theme.accent. Date row: three inputs MM DD YYYY side by side. Amount input decimal-pad. Category: ScrollView horizontal showing five TouchableOpacity pills for each category. Selected pill: backgroundColor theme.accent text theme.backgroundPrimary. Unselected: border theme.borderColorDim text theme.textSecondary. Padding 8 16 borderRadius 20. Description: TextInput full width. Notes: optional TextInput. CANCEL + CONFIRM buttons same pattern. Write complete file. No explanation."

Write output to src/components/modals/LogMassageExpenseModal.js.

---

## PART 8 [T2] — Create LogCleaningExpenseModal

Run Ollama with this prompt:
"Create a complete React Native modal component file src/components/modals/LogCleaningExpenseModal.js. Default export functional component. Props: visible (bool), onClose (func), onConfirm (func). Import theme from src/config/theme.config.js. Import parseBillInput from src/utils/currency.js. useState for: month (''), day (''), year (''), amount (''), category ('supplies'), description (''), taxDeductible (true), receiptNote (''). Categories: ['formation_legal', 'equipment', 'supplies', 'marketing', 'software_tools', 'meals_entertainment', 'other']. handleConfirm: validate non-empty fields, call onConfirm({ date: new Date(parseInt(year), parseInt(month)-1, parseInt(day)).getTime(), amountCents: parseBillInput(amount), category, description, taxDeductible, receiptNote }), then onClose. Layout: bottom-sheet Modal same pattern. Title 'LOG EXPENSE' subtitle text 'Cleaning LLC' in theme.textSecondary. Date inputs. Amount input. Category: horizontal ScrollView pill selectors same style as LogMassageExpenseModal. Description TextInput. Tax Deductible: row with Text 'Tax Deductible' and Switch component value taxDeductible onValueChange setTaxDeductible trackColor false theme.borderColorDim true theme.accent. Receipt Note: optional TextInput. CANCEL + CONFIRM buttons. Write complete file. No explanation."

Write output to src/components/modals/LogCleaningExpenseModal.js.

---

## PART 9 [T2] — Create LogCleaningMileageModal

Run Ollama with this prompt:
"Create a complete React Native modal component file src/components/modals/LogCleaningMileageModal.js. Default export functional component. Props: visible (bool), onClose (func), onConfirm (func), irsRateCents (number, default 70). Import theme from src/config/theme.config.js. useState for: month (''), day (''), year (''), miles (''), purpose (''). Compute liveDeduction: inside render, const milesFloat = parseFloat(miles) || 0; const deductionCents = Math.floor(milesFloat * irsRateCents); const deductionDisplay = (deductionCents / 100).toFixed(2); const rateDisplay = (irsRateCents / 100).toFixed(2). handleConfirm: validate month day year miles non-empty, miles must be a valid positive number else Alert. Call onConfirm({ date: new Date(parseInt(year), parseInt(month)-1, parseInt(day)).getTime(), miles: parseFloat(miles), purpose, irsRateCents, deductionCents: Math.floor(parseFloat(miles) * irsRateCents) }). Then onClose. Layout: bottom-sheet Modal. Title 'LOG MILEAGE'. Date row MM DD YYYY. Miles: TextInput keyboardType decimal-pad placeholder '0.0' value miles onChangeText setMiles. Immediately below miles input: Text showing 'Deduction: $' + deductionDisplay + ' (at $' + rateDisplay + '/mile)' styled color theme.statusPositive fontSize theme.fontSizeSM marginTop 4. Purpose: TextInput placeholder 'Purpose / destination'. CANCEL + CONFIRM. Write complete file. No explanation."

Write output to src/components/modals/LogCleaningMileageModal.js.

---

## PART 10 [T2] — Simple store actions (append-only, no account effects)

Run Ollama with this prompt:
"I have a React Native Zustand store. I need to add 9 new store actions as plain JavaScript methods inside the existing set/get store object. Write only the 9 action functions — no imports, no full file, no wrapping create() call. Assume get().awardXP(n) already exists. Assume KEYS.MASSAGE_EXPENSES, KEYS.CLEANING_EXPENSES, KEYS.CLEANING_MILEAGE exist. Assume AsyncStorage is already imported. The 9 actions:

logMassageExpense: async (record) => { const id = 'massage_exp_' + Date.now(); const newRecord = { ...record, id, createdAt: Date.now() }; const updated = [...get().massageExpenses, newRecord]; set({ massageExpenses: updated }); await AsyncStorage.setItem(KEYS.MASSAGE_EXPENSES, JSON.stringify(updated)); get().awardXP(3); get().recomputeVariance(); },

editMassageExpense: async (id, updates) => { const updated = get().massageExpenses.map(r => r.id === id ? { ...r, ...updates } : r); set({ massageExpenses: updated }); await AsyncStorage.setItem(KEYS.MASSAGE_EXPENSES, JSON.stringify(updated)); get().recomputeVariance(); },

deleteMassageExpense: async (id) => { const updated = get().massageExpenses.map(r => r.id === id ? { ...r, deleted: true } : r); set({ massageExpenses: updated }); await AsyncStorage.setItem(KEYS.MASSAGE_EXPENSES, JSON.stringify(updated)); get().recomputeVariance(); },

logCleaningExpense: async (record) => { const id = 'clean_exp_' + Date.now(); const newRecord = { ...record, id, createdAt: Date.now() }; const updated = [...get().cleaningExpenses, newRecord]; set({ cleaningExpenses: updated }); await AsyncStorage.setItem(KEYS.CLEANING_EXPENSES, JSON.stringify(updated)); get().awardXP(3); get().recomputeVariance(); },

editCleaningExpense: async (id, updates) => { const updated = get().cleaningExpenses.map(r => r.id === id ? { ...r, ...updates } : r); set({ cleaningExpenses: updated }); await AsyncStorage.setItem(KEYS.CLEANING_EXPENSES, JSON.stringify(updated)); get().recomputeVariance(); },

deleteCleaningExpense: async (id) => { const updated = get().cleaningExpenses.map(r => r.id === id ? { ...r, deleted: true } : r); set({ cleaningExpenses: updated }); await AsyncStorage.setItem(KEYS.CLEANING_EXPENSES, JSON.stringify(updated)); get().recomputeVariance(); },

logCleaningMileage: async (record) => { const id = 'clean_mile_' + Date.now(); const newRecord = { ...record, id, createdAt: Date.now() }; const updated = [...get().cleaningMileage, newRecord]; set({ cleaningMileage: updated }); await AsyncStorage.setItem(KEYS.CLEANING_MILEAGE, JSON.stringify(updated)); get().awardXP(2); get().recomputeVariance(); },

editCleaningMileage: async (id, updates) => { const updated = get().cleaningMileage.map(r => r.id === id ? { ...r, ...updates } : r); set({ cleaningMileage: updated }); await AsyncStorage.setItem(KEYS.CLEANING_MILEAGE, JSON.stringify(updated)); get().recomputeVariance(); },

deleteCleaningMileage: async (id) => { const updated = get().cleaningMileage.map(r => r.id === id ? { ...r, deleted: true } : r); set({ cleaningMileage: updated }); await AsyncStorage.setItem(KEYS.CLEANING_MILEAGE, JSON.stringify(updated)); get().recomputeVariance(); },

Output only the 9 functions, formatted cleanly. No explanation."

Take Ollama's output and use str_replace to insert all 9 actions into the store actions block in useStore.js, just before the final closing of the create() call. Do not rewrite the file.

---

## STOP — DO NOT PROCEED PAST THIS LINE

The following tasks require T1 reasoning and are deferred to the next session:
- awardXP helper function
- checkAndAwardBadge helper function  
- XP wiring into existing store actions (confirmBalance, logTransaction, checkCycleReset, etc.)
- logMassageIncome / editMassageIncome / deleteMassageIncome (account effects)
- Stack navigator registration for BusinessSelectorScreen, MassageScreen, CleaningScreen
- Business variance hookup in forecasting.js

---

## WHEN ALL 10 PARTS ARE DONE

Run: npx expo start --tunnel
Check that the app still launches without a red error screen.
If it launches clean, report "Scaffolding pass complete. App launches."
If it crashes, read the Metro error, fix the specific import or syntax issue, and report what you fixed.

Do not commit yet. T1 pass happens next session before commit.