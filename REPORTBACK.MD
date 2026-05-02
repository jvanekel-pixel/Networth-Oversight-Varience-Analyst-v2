Before we do anything else, I need a full audit. Do not write any code. Do not fix anything yet.
Go through each of the following and tell me exactly what exists in the codebase right now — not what was planned, not what was attempted. What is actually there.

Does src/utils/forecasting.js exist? If yes, list every function it exports.
In useStore.js — do these actions exist: recomputeVariance, checkCycleReset, updateVarianceConfig, editBill, deleteBill, editTransaction, deleteTransaction? For each one, confirm yes or no.
Does recomputeVariance() get called at the end of any existing financial actions (logTransaction, markBillPaid, etc.)? List which ones have it and which don't.
Does src/screens/CalendarScreen.js exist? If yes, how many lines is it?
Does DashboardScreen.js still show the stub, or has it been replaced? Paste the first 20 lines.
Does a "Recent Activity" section exist in HouseholdScreen or PersonalScreen?
Does App.js have a stack navigator wrapping the tab navigator? Does it have the two useEffects for checkCycleReset and recomputeVariance?
Does theme.config.js have a radiusLG alias?

Report findings only. Wait for my instructions before touching anything.