import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentWeekStart } from '../utils/dates';
import { computeProfileVariance } from '../utils/forecasting';

const KEYS = {
  onboardingComplete: 'nova_v2_onboardingComplete',
  accounts: 'nova_v2_accounts',
  accountFloors: 'nova_v2_accountFloors',
  householdBills: 'nova_v2_householdBills',
  personalBills: 'nova_v2_personalBills',
  billOverrides: 'nova_v2_billOverrides',
  incomeEvents: 'nova_v2_incomeEvents',
  distribution: 'nova_v2_distribution',
  groceryBudget: 'nova_v2_groceryBudget',
  transactions: 'nova_v2_transactions',
  massageIncome: 'nova_v2_massageIncome',
  massageExpenses: 'nova_v2_massageExpenses',
  cleaningExpenses: 'nova_v2_cleaningExpenses',
  cleaningMileage: 'nova_v2_cleaningMileage',
  irsRatePerMile: 'nova_v2_irsRatePerMile',
  xpTotal: 'nova_v2_xpTotal',
  badges: 'nova_v2_badges',
  confirmStreak: 'nova_v2_confirmStreak',
  lastConfirmDate: 'nova_v2_lastConfirmDate',
  currentFlavorText: 'nova_v2_currentFlavorText',
  lastActivityAt: 'nova_v2_lastActivityAt',
  autoExportSchedule: 'nova_v2_autoExportSchedule',
  schemaVersion: 'nova_v2_schemaVersion',
  VARIANCE_CONFIG: 'nova_v2_variance_config',
  LAST_CYCLE_RESET_MONTH: 'nova_v2_last_cycle_reset_month',
};

const initialState = {
  onboardingComplete: false,
  accounts: { jointChecking: 0, entChecking: 0, entSavings: 0, venmo: 0, cash: 0 },
  accountFloors: { entChecking: 5000, others: 0 },
  householdBills: [],
  personalBills: [],
  billOverrides: {},
  incomeEvents: {
    paycheckAmount: 0,
    paycheckFrequency: 'biweekly',
    nextPaycheckDate: null,
    partnerDepositAmount: 0,
    partnerDepositExpected: null,
    partnerDepositLastReceivedMonth: null,
  },
  distribution: { entSavings: 5000, venmo: 15000, entChecking: 16000 },
  groceryBudget: { weeklyLimit: 0, currentWeekSpend: 0, weekStartDate: null },
  transactions: [],
  massageIncome: [],
  massageExpenses: [],
  cleaningExpenses: [],
  cleaningMileage: [],
  irsRatePerMile: 70,
  xpTotal: 0,
  badges: {},
  confirmStreak: 0,
  lastConfirmDate: null,
  currentFlavorText: '',
  lastActivityAt: null,
  autoExportSchedule: 'off',
  schemaVersion: '1.0',
  warnings: [],
  varianceConfig: {
    household: { redThresholdCents: -30000, yellowFloorBufferCents: 0 },
    personal: { redThresholdCents: -30000, yellowFloorBufferCents: 0 },
    business: { redThresholdCents: -30000, yellowFloorBufferCents: 0 },
  },
  varianceCache: {
    household: { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null },
    personal: { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null },
    business: { balance: 0, variance: 0, state: 'neutral', annotation: '—', dipPeriod: null, redDate: null },
    lastComputedAt: null,
  },
  lastCycleResetMonth: null,
};

async function loadKey(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function upgradeBillIfNeeded(bill, defaultAccountKey) {
  if (bill.expectedDay !== undefined) return bill;
  return {
    ...bill,
    expectedDay: bill.dueDay,
    isAutoDraft: true,
    isActive: bill.isActive !== undefined ? bill.isActive : true,
    lastPaidDate: bill.lastPaidDate || null,
    lastPaidAmountCents: bill.lastPaidAmountCents || null,
    lastPaidMonth: bill.lastPaidMonth || null,
    defaultAccountKey: bill.defaultAccountKey || defaultAccountKey,
    createdAt: bill.createdAt || Date.now(),
  };
}

const useStore = create((set, get) => ({
  ...initialState,

  initStore: async () => {
    const [
      onboardingComplete,
      accounts,
      accountFloors,
      householdBills,
      personalBills,
      billOverrides,
      incomeEvents,
      distribution,
      groceryBudget,
      transactions,
      massageIncome,
      massageExpenses,
      cleaningExpenses,
      cleaningMileage,
      irsRatePerMile,
      xpTotal,
      badges,
      confirmStreak,
      lastConfirmDate,
      currentFlavorText,
      lastActivityAt,
      autoExportSchedule,
      schemaVersion,
      varianceConfig,
      lastCycleResetMonth,
    ] = await Promise.all([
      loadKey(KEYS.onboardingComplete, initialState.onboardingComplete),
      loadKey(KEYS.accounts, initialState.accounts),
      loadKey(KEYS.accountFloors, initialState.accountFloors),
      loadKey(KEYS.householdBills, initialState.householdBills),
      loadKey(KEYS.personalBills, initialState.personalBills),
      loadKey(KEYS.billOverrides, initialState.billOverrides),
      loadKey(KEYS.incomeEvents, initialState.incomeEvents),
      loadKey(KEYS.distribution, initialState.distribution),
      loadKey(KEYS.groceryBudget, initialState.groceryBudget),
      loadKey(KEYS.transactions, initialState.transactions),
      loadKey(KEYS.massageIncome, initialState.massageIncome),
      loadKey(KEYS.massageExpenses, initialState.massageExpenses),
      loadKey(KEYS.cleaningExpenses, initialState.cleaningExpenses),
      loadKey(KEYS.cleaningMileage, initialState.cleaningMileage),
      loadKey(KEYS.irsRatePerMile, initialState.irsRatePerMile),
      loadKey(KEYS.xpTotal, initialState.xpTotal),
      loadKey(KEYS.badges, initialState.badges),
      loadKey(KEYS.confirmStreak, initialState.confirmStreak),
      loadKey(KEYS.lastConfirmDate, initialState.lastConfirmDate),
      loadKey(KEYS.currentFlavorText, initialState.currentFlavorText),
      loadKey(KEYS.lastActivityAt, initialState.lastActivityAt),
      loadKey(KEYS.autoExportSchedule, initialState.autoExportSchedule),
      loadKey(KEYS.schemaVersion, initialState.schemaVersion),
      loadKey(KEYS.VARIANCE_CONFIG, initialState.varianceConfig),
      loadKey(KEYS.LAST_CYCLE_RESET_MONTH, initialState.lastCycleResetMonth),
    ]);

    // Migrate old partnerDepositReceived boolean to partnerDepositLastReceivedMonth
    const migratedIncomeEvents = { ...initialState.incomeEvents, ...incomeEvents };
    if ('partnerDepositReceived' in migratedIncomeEvents) {
      delete migratedIncomeEvents.partnerDepositReceived;
    }
    if (!('partnerDepositLastReceivedMonth' in migratedIncomeEvents)) {
      migratedIncomeEvents.partnerDepositLastReceivedMonth = null;
    }

    // Migrate bills to V1.2 schema (idempotent — no-op for already-upgraded bills)
    const upgradedHouseholdBills = householdBills.map(b => upgradeBillIfNeeded(b, 'jointChecking'));
    const upgradedPersonalBills = personalBills.map(b => upgradeBillIfNeeded(b, 'entChecking'));

    set({
      onboardingComplete,
      accounts,
      accountFloors,
      householdBills: upgradedHouseholdBills,
      personalBills: upgradedPersonalBills,
      billOverrides,
      incomeEvents: migratedIncomeEvents,
      distribution,
      groceryBudget,
      transactions,
      massageIncome,
      massageExpenses,
      cleaningExpenses,
      cleaningMileage,
      irsRatePerMile,
      xpTotal,
      badges,
      confirmStreak,
      lastConfirmDate,
      currentFlavorText,
      lastActivityAt,
      autoExportSchedule,
      schemaVersion,
      varianceConfig,
      lastCycleResetMonth,
    });
    await Promise.all([
      AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(upgradedHouseholdBills)),
      AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(upgradedPersonalBills)),
    ]);
  },

  setOnboardingComplete: async () => {
    set({ onboardingComplete: true });
    await AsyncStorage.setItem(KEYS.onboardingComplete, JSON.stringify(true));
  },

  updateAccountBalance: async (key, cents) => {
    const accounts = { ...get().accounts, [key]: Math.floor(cents) };
    const now = Date.now();
    set({ accounts, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accounts)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().recomputeVariance();
  },

  logTransaction: async ({ accountKey, amountCents, category, description, paymentMethod, timestamp }) => {
    const { accounts, transactions } = get();
    const now = Date.now();
    const amt = Math.floor(amountCents);
    const newTx = {
      id: now.toString() + Math.random().toString(36).slice(2, 6),
      accountKey,
      amountCents: amt,
      category,
      description,
      paymentMethod,
      timestamp: timestamp || now,
    };
    const updatedAccounts = accountKey
      ? { ...accounts, [accountKey]: (accounts[accountKey] || 0) + amt }
      : accounts;
    const updatedTransactions = [...transactions, newTx];
    set({ accounts: updatedAccounts, transactions: updatedTransactions, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().awardXP(10);
    get().checkAndAwardBadge('firstLog');
    get().rotateFlavorTextForEvent('transaction');
    get().recomputeVariance();
  },

  rotateFlavorTextForEvent: (eventType) => {
    const personality = require('../config/personality.config').default;
    get().rotateFlavorText(personality.starterPool);
  },

  distributePaycheck: async (grossAmountCents) => {
    const { accounts, distribution, incomeEvents, transactions } = get();
    const now = Date.now();
    const gross = Math.floor(grossAmountCents);
    let accts = { ...accounts };
    const newTxs = [];
    let awardRolloverXP = false;
    let idx = 0;
    const mkId = () => `${now}_${++idx}`;

    // 1. Rollover sweep: move all entChecking → entSavings
    const rolloverAmt = accts.entChecking || 0;
    if (rolloverAmt > 0) {
      awardRolloverXP = true;
      accts.entChecking = 0;
      accts.entSavings = (accts.entSavings || 0) + rolloverAmt;
      newTxs.push({ id: mkId(), accountKey: 'entChecking', amountCents: -rolloverAmt, category: 'Transfer', description: 'Rollover Sweep', timestamp: now });
      newTxs.push({ id: mkId(), accountKey: 'entSavings', amountCents: rolloverAmt, category: 'Transfer', description: 'Rollover Sweep', timestamp: now });
    }

    // 2. Log gross paycheck as income to entChecking
    accts.entChecking = (accts.entChecking || 0) + gross;
    newTxs.push({ id: mkId(), accountKey: 'entChecking', amountCents: gross, category: 'Paycheck', description: 'Paycheck', timestamp: now });

    // 3. Transfer distribution.entSavings from entChecking → entSavings
    const savingsAmt = distribution.entSavings || 0;
    accts.entChecking -= savingsAmt;
    accts.entSavings = (accts.entSavings || 0) + savingsAmt;
    newTxs.push({ id: mkId(), accountKey: 'entChecking', amountCents: -savingsAmt, category: 'Transfer', description: 'Transfer → ENT Savings', timestamp: now });
    newTxs.push({ id: mkId(), accountKey: 'entSavings', amountCents: savingsAmt, category: 'Transfer', description: 'Transfer from ENT Checking', timestamp: now });

    // 4. Transfer distribution.venmo from entChecking → venmo
    const venmoAmt = distribution.venmo || 0;
    accts.entChecking -= venmoAmt;
    accts.venmo = (accts.venmo || 0) + venmoAmt;
    newTxs.push({ id: mkId(), accountKey: 'entChecking', amountCents: -venmoAmt, category: 'Transfer', description: 'Transfer → Venmo', timestamp: now });
    newTxs.push({ id: mkId(), accountKey: 'venmo', amountCents: venmoAmt, category: 'Transfer', description: 'Transfer from ENT Checking', timestamp: now });

    // 5. Advance nextPaycheckDate by 14 days
    const currentNext = incomeEvents.nextPaycheckDate;
    const nextPaycheckDate = currentNext
      ? currentNext + 14 * 24 * 60 * 60 * 1000
      : now + 14 * 24 * 60 * 60 * 1000;

    const updatedIncomeEvents = { ...incomeEvents, paycheckAmount: gross, nextPaycheckDate };
    const updatedTransactions = [...transactions, ...newTxs];

    set({ accounts: accts, transactions: updatedTransactions, incomeEvents: updatedIncomeEvents, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);

    if (awardRolloverXP) get().awardXP(50);
    get().rotateFlavorTextForEvent('rollover');
    get().recomputeVariance();
  },

  recordPartnerDeposit: async (amountCents) => {
    const { accounts, incomeEvents, transactions } = get();
    const now = Date.now();
    const amt = Math.floor(amountCents);
    const currentMonth = new Date().toISOString().slice(0, 7);

    const updatedAccounts = { ...accounts, jointChecking: (accounts.jointChecking || 0) + amt };
    const newTx = {
      id: now.toString(),
      accountKey: 'jointChecking',
      amountCents: amt,
      category: 'Income',
      description: 'Partner Deposit',
      timestamp: now,
    };
    const updatedTransactions = [...transactions, newTx];
    const updatedIncomeEvents = { ...incomeEvents, partnerDepositLastReceivedMonth: currentMonth };

    set({ accounts: updatedAccounts, transactions: updatedTransactions, incomeEvents: updatedIncomeEvents, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().awardXP(10);
    get().rotateFlavorTextForEvent('partner_deposit');
    get().recomputeVariance();
  },

  addHouseholdBill: async ({ name, amountCents, expectedDay, isAutoDraft, defaultAccountKey }) => {
    const day = Math.max(1, Math.min(31, expectedDay || 1));
    const bill = {
      id: `bill_${Date.now()}`,
      name,
      amountCents: Math.floor(amountCents),
      expectedDay: day,
      dueDay: day,
      isAutoDraft: isAutoDraft !== undefined ? isAutoDraft : true,
      isActive: true,
      lastPaidDate: null,
      lastPaidAmountCents: null,
      lastPaidMonth: null,
      defaultAccountKey: defaultAccountKey || 'jointChecking',
      createdAt: Date.now(),
    };
    const householdBills = [...get().householdBills, bill];
    set({ householdBills });
    await AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(householdBills));
    get().recomputeVariance();
  },

  addPersonalBill: async ({ name, amountCents, expectedDay, isAutoDraft, defaultAccountKey }) => {
    const day = Math.max(1, Math.min(31, expectedDay || 1));
    const bill = {
      id: `bill_${Date.now()}`,
      name,
      amountCents: Math.floor(amountCents),
      expectedDay: day,
      dueDay: day,
      isAutoDraft: isAutoDraft !== undefined ? isAutoDraft : true,
      isActive: true,
      lastPaidDate: null,
      lastPaidAmountCents: null,
      lastPaidMonth: null,
      defaultAccountKey: defaultAccountKey || 'entChecking',
      createdAt: Date.now(),
    };
    const personalBills = [...get().personalBills, bill];
    set({ personalBills });
    await AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(personalBills));
    get().recomputeVariance();
  },

  markBillPaid: async (billId, { paidDate, paidAmountCents, accountKey, notes }) => {
    const { billOverrides, accounts, transactions, householdBills, personalBills } = get();
    const now = Date.now();

    const allBills = [...householdBills, ...personalBills];
    const bill = allBills.find(b => b.id === billId);
    if (!bill) return;

    const amt = Math.floor(paidAmountCents);
    const paidDateObj = new Date(paidDate);
    const paidMonth = `${paidDateObj.getFullYear()}-${String(paidDateObj.getMonth() + 1).padStart(2, '0')}`;
    const desc = notes ? `Bill: ${bill.name} — ${notes}` : `Bill: ${bill.name}`;

    const updatedOverrides = { ...billOverrides, [billId]: { lastPaidMonth: paidMonth } };
    const updatedAccounts = { ...accounts, [accountKey]: (accounts[accountKey] || 0) - amt };
    const newTx = {
      id: now.toString() + Math.random().toString(36).slice(2, 6),
      accountKey,
      amountCents: -amt,
      category: 'bill_payment',
      description: desc,
      timestamp: paidDate,
    };

    const updateBillInArray = (arr) =>
      arr.map(b => b.id === billId
        ? { ...b, lastPaidDate: paidDate, lastPaidAmountCents: amt, lastPaidMonth: paidMonth }
        : b
      );

    const updatedHouseholdBills = updateBillInArray(householdBills);
    const updatedPersonalBills = updateBillInArray(personalBills);
    const updatedTransactions = [...transactions, newTx];

    set({
      billOverrides: updatedOverrides,
      accounts: updatedAccounts,
      transactions: updatedTransactions,
      householdBills: updatedHouseholdBills,
      personalBills: updatedPersonalBills,
      lastActivityAt: now,
    });
    await Promise.all([
      AsyncStorage.setItem(KEYS.billOverrides, JSON.stringify(updatedOverrides)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(updatedHouseholdBills)),
      AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(updatedPersonalBills)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().awardXP(5);
    get().rotateFlavorTextForEvent('bill_paid');
    get().checkSpendingFloors();
    get().recomputeVariance();
  },

  editBill: async (billId, updates) => {
    const { householdBills, personalBills } = get();
    const applyUpdate = (arr) =>
      arr.map(b => b.id === billId ? { ...b, ...updates } : b);
    const updatedHousehold = applyUpdate(householdBills);
    const updatedPersonal = applyUpdate(personalBills);
    set({ householdBills: updatedHousehold, personalBills: updatedPersonal });
    await Promise.all([
      AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(updatedHousehold)),
      AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(updatedPersonal)),
    ]);
    get().recomputeVariance();
  },

  deleteBill: async (billId) => {
    const { householdBills, personalBills } = get();
    const deactivate = (arr) =>
      arr.map(b => b.id === billId ? { ...b, isActive: false } : b);
    const updatedHousehold = deactivate(householdBills);
    const updatedPersonal = deactivate(personalBills);
    set({ householdBills: updatedHousehold, personalBills: updatedPersonal });
    await Promise.all([
      AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(updatedHousehold)),
      AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(updatedPersonal)),
    ]);
    get().recomputeVariance();
  },

  editTransaction: async (txId, updates) => {
    const { transactions, accounts } = get();
    const tx = transactions.find(t => t.id === txId && !t.deleted);
    if (!tx) return;
    const oldAmt = tx.amountCents;
    const newAmt = updates.amountCents !== undefined ? Math.floor(updates.amountCents) : oldAmt;
    const amtDelta = newAmt - oldAmt;
    const updatedTx = { ...tx, ...updates, amountCents: newAmt };
    const updatedTransactions = transactions.map(t => t.id === txId ? updatedTx : t);
    const updatedAccounts = (tx.accountKey && amtDelta !== 0)
      ? { ...accounts, [tx.accountKey]: (accounts[tx.accountKey] || 0) + amtDelta }
      : accounts;
    set({ transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      ...(amtDelta !== 0 ? [AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts))] : []),
    ]);
    get().recomputeVariance();
  },

  deleteTransaction: async (txId) => {
    const { transactions, accounts } = get();
    const tx = transactions.find(t => t.id === txId && !t.deleted);
    if (!tx) return;
    const updatedTransactions = transactions.map(t =>
      t.id === txId ? { ...t, deleted: true } : t
    );
    const updatedAccounts = tx.accountKey
      ? { ...accounts, [tx.accountKey]: (accounts[tx.accountKey] || 0) - tx.amountCents }
      : accounts;
    set({ transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    get().recomputeVariance();
  },

  updateGroceryBudget: async ({ weeklyLimitCents }) => {
    const { groceryBudget } = get();
    const currentWeekStart = getCurrentWeekStart();
    const isNewWeek = !groceryBudget.weekStartDate || groceryBudget.weekStartDate < currentWeekStart;
    const updatedBudget = {
      weeklyLimit: Math.floor(weeklyLimitCents),
      currentWeekSpend: isNewWeek ? 0 : groceryBudget.currentWeekSpend,
      weekStartDate: currentWeekStart,
    };
    set({ groceryBudget: updatedBudget });
    await AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget));
    get().recomputeVariance();
  },

  logGrocerySpend: async (amountCents) => {
    const { groceryBudget } = get();
    const currentWeekStart = getCurrentWeekStart();
    const amt = Math.floor(amountCents);

    const isNewWeek = !groceryBudget.weekStartDate || groceryBudget.weekStartDate < currentWeekStart;
    const prevSpend = isNewWeek ? 0 : (groceryBudget.currentWeekSpend || 0);
    const updatedBudget = {
      ...groceryBudget,
      currentWeekSpend: prevSpend + amt,
      weekStartDate: currentWeekStart,
    };

    set({ groceryBudget: updatedBudget });
    await AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget));

    await get().logTransaction({
      accountKey: 'jointChecking',
      amountCents: -amt,
      category: 'Grocery',
      description: 'Grocery spend',
    });

    if (updatedBudget.weeklyLimit > 0 && updatedBudget.currentWeekSpend > updatedBudget.weeklyLimit) {
      get().rotateFlavorTextForEvent('grocery_warning');
    }
    get().recomputeVariance();
  },

  checkSpendingFloors: () => {
    const { accounts, accountFloors } = get();
    const othersFloor = accountFloors.others ?? 0;
    const warnings = [];

    Object.entries(accounts).forEach(([accountKey, balance]) => {
      const floor = accountFloors[accountKey] !== undefined ? accountFloors[accountKey] : othersFloor;
      if (floor <= 0) return;
      const threshold = floor + Math.floor(floor * 0.2);
      if (balance < threshold) {
        warnings.push({ accountKey, balance, floor, threshold });
      }
    });

    set({ warnings });
    if (warnings.length > 0) get().rotateFlavorTextForEvent('floor_warning');
  },

  confirmBalance: async () => {
    const now = Date.now();
    const lastConfirmDate = get().lastConfirmDate;
    const isSameDay = lastConfirmDate
      ? new Date(lastConfirmDate).toDateString() === new Date(now).toDateString()
      : false;

    const newStreak = isSameDay ? get().confirmStreak : get().confirmStreak + 1;

    set({ lastActivityAt: now, lastConfirmDate: now, confirmStreak: newStreak });
    await Promise.all([
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
      AsyncStorage.setItem(KEYS.lastConfirmDate, JSON.stringify(now)),
      AsyncStorage.setItem(KEYS.confirmStreak, JSON.stringify(newStreak)),
    ]);

    get().awardXP(25);
    get().checkAndAwardBadge('balanceConfirmed');
    if (newStreak >= 7) get().checkAndAwardBadge('streakWeek');
  },

  setFlavorText: async (text) => {
    set({ currentFlavorText: text });
    await AsyncStorage.setItem(KEYS.currentFlavorText, JSON.stringify(text));
  },

  rotateFlavorText: (pool) => {
    if (!pool || pool.length === 0) return;
    const text = pool[Math.floor(Math.random() * pool.length)];
    get().setFlavorText(text);
  },

  updateConfig: async (updates) => {
    set(updates);
    const saves = Object.entries(updates).map(([k, v]) => {
      const storageKey = KEYS[k];
      if (storageKey) return AsyncStorage.setItem(storageKey, JSON.stringify(v));
      return Promise.resolve();
    });
    await Promise.all(saves);
    get().recomputeVariance();
  },

  recomputeVariance: () => {
    const state = get();
    const now = Date.now();
    const profiles = ['household', 'personal', 'business'];
    const newCache = { ...state.varianceCache, lastComputedAt: now };

    for (const profile of profiles) {
      newCache[profile] = computeProfileVariance({
        profile,
        accounts: state.accounts,
        accountFloors: state.config?.accountFloors || state.accountFloors || {},
        bills: [...(state.householdBills || []), ...(state.personalBills || [])],
        incomeEvents: state.incomeEvents,
        groceryBudget: state.groceryBudget,
        varianceConfig: state.varianceConfig[profile],
        now,
      });
    }

    set({ varianceCache: newCache });
  },

  updateVarianceConfig: async (profile, updates) => {
    const { varianceConfig } = get();
    const updatedConfig = {
      ...varianceConfig,
      [profile]: { ...varianceConfig[profile], ...updates },
    };
    set({ varianceConfig: updatedConfig });
    await AsyncStorage.setItem(KEYS.VARIANCE_CONFIG, JSON.stringify(updatedConfig));
    get().recomputeVariance();
  },

  checkCycleReset: async () => {
    const now = new Date();
    const currentCycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { lastCycleResetMonth } = get();
    if (currentCycleId !== lastCycleResetMonth) {
      set({ lastCycleResetMonth: currentCycleId });
      await AsyncStorage.setItem(KEYS.LAST_CYCLE_RESET_MONTH, JSON.stringify(currentCycleId));
      get().recomputeVariance();
      get().rotateFlavorTextForEvent('cycle_reset');
    }
  },

  awardXP: async (amount) => {
    const xpTotal = get().xpTotal + Math.floor(amount);
    set({ xpTotal });
    await AsyncStorage.setItem(KEYS.xpTotal, JSON.stringify(xpTotal));
    get().checkAndAwardBadge('commaClub');
  },

  checkAndAwardBadge: async (key) => {
    const badges = get().badges;
    if (badges[key]) return;
    const { xpTotal, confirmStreak, transactions } = get();

    let earned = false;
    if (key === 'firstLog' && transactions.length >= 1) earned = true;
    if (key === 'balanceConfirmed' && confirmStreak >= 1) earned = true;
    if (key === 'streakWeek' && confirmStreak >= 7) earned = true;
    if (key === 'commaClub' && xpTotal >= 100000) earned = true;

    if (earned) {
      const newBadges = { ...badges, [key]: Date.now() };
      set({ badges: newBadges });
      await AsyncStorage.setItem(KEYS.badges, JSON.stringify(newBadges));
    }
  },

  persistAll: async () => {
    const state = get();
    await Promise.all(
      Object.entries(KEYS).map(([k, storageKey]) =>
        state[k] !== undefined
          ? AsyncStorage.setItem(storageKey, JSON.stringify(state[k]))
          : Promise.resolve()
      )
    );
  },
}));

export default useStore;
