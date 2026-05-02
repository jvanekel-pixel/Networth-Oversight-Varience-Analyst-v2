1. distributePaycheck — gross vs. config
Neither option as written. Use this sequence: entSavings and venmo are fixed transfer amounts; entChecking gets the residual. Treat distribution.entChecking in the config as a display baseline only — not enforced.
Order of operations inside distributePaycheck(grossAmountCents):

Rollover sweep — move all current entChecking balance → entSavings, logged as "Rollover Sweep". Award +50 XP if amount > 0.
Log gross paycheck as income to entChecking.
Transfer distribution.entSavings cents from entChecking → entSavings (logged).
Transfer distribution.venmo cents from entChecking → venmo (logged).
Whatever remains stays in entChecking.

No validation that gross ≥ config sum. If gross is too small, accounts go negative and the operator sees it. This matches real-world flow (paycheck hits ENT Checking via direct deposit, then transfers go out).
2. nextPaycheckDate auto-advance
Auto-advance by 14 days inside distributePaycheck. User can edit manually in Settings (Session 4). For Session 2, auto-advance is enough.
3. billOverrides format
Use an object rather than a bare string — future-proofs the schema:
billOverrides[billId] = { lastPaidMonth: 'YYYY-MM' }
MARK PAID button is visible when billOverrides[billId]?.lastPaidMonth !== currentYYYYMM. This lets us add fields later (paidAmount, paidDate, accountKey used) without restructuring storage.
4. partnerDepositReceived reset
Lazy reset on screen load — but replace the bare boolean with a stored month:
partnerDepositLastReceivedMonth: 'YYYY-MM' | null
The "received this month" state is derived at render time: lastReceivedMonth === currentYYYYMM. No background timer, no manual reset, self-heals across month boundaries. recordPartnerDeposit writes the current YYYY-MM string to that field. The Household card reads it and renders the right state automatically.

All four are non-breaking schema changes — just replace the existing boolean / shape in initialState. Project is fresh so no migration needed.