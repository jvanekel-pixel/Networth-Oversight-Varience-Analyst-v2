import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentWeekStart } from '../utils/dates';
import { computeProfileVariance } from '../utils/forecasting';
import { scheduleLocalNotification } from '../utils/notifications';
import notificationsConfig from '../config/notifications.config';

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
  groceryEntries: 'nova_v2_grocery_entries',
  MASSAGE_INCOME: 'nova_v2_massageIncome',
  MASSAGE_EXPENSES: 'nova_v2_massageExpenses',
  CLEANING_EXPENSES: 'nova_v2_cleaningExpenses',
  CLEANING_MILEAGE: 'nova_v2_cleaningMileage',
  groceryStreakWeeks: 'nova_v2_grocery_streak_weeks',
  cleaningIncome: 'nova_v2_cleaning_income',
  postPaydayActions: 'nova_v2_post_payday_actions',
  novaConfig: 'nova_v2_config',
};

const initialState = {
  onboardingComplete: false,
  accounts: { jointChecking: 0, entChecking: 0, entSavings: 0, venmo: 0, cash: 0, cleaningChecking: 0 },
  accountFloors: { jointChecking: 30000, entChecking: 5000, others: 0 },
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
  groceryEntries: [],
  transactions: [],
  massageIncome: [],
  massageExpenses: [],
  cleaningExpenses: [],
  cleaningMileage: [],
  cleaningIncome: [],
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
    household: { redThresholdCents: 0, yellowFloorBufferCents: 0 },
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
  groceryStreakWeeks: 0,
  postPaydayActions: [],
  novaConfig: { postPaydayExpiryHours: 12, postPaydayActionToggles: { venmo: true, savings: true } },
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
      groceryEntries,
      groceryStreakWeeks,
      cleaningIncome,
      postPaydayActions,
      novaConfig,
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
      loadKey(KEYS.groceryEntries, initialState.groceryEntries),
      loadKey(KEYS.groceryStreakWeeks, initialState.groceryStreakWeeks),
      loadKey(KEYS.cleaningIncome, initialState.cleaningIncome),
      loadKey(KEYS.postPaydayActions, initialState.postPaydayActions),
      loadKey(KEYS.novaConfig, initialState.novaConfig),
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
      groceryEntries,
      groceryStreakWeeks,
      cleaningIncome,
      postPaydayActions,
      novaConfig: { ...initialState.novaConfig, ...novaConfig },
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
    get().checkAndAwardBadge('comma_club');
    // Fire floor warning if new balance is within 20% above floor
    const { accountFloors } = get();
    const floor = accountFloors[key] ?? accountFloors.others ?? 0;
    if (floor > 0) {
      const newBal = accounts[key] || 0;
      const threshold = floor + Math.floor(floor * 0.2);
      if (newBal < threshold) {
        const accountLabel = key.replace(/([A-Z])/g, ' $1').toUpperCase();
        const pct = Math.max(0, Math.round(((newBal - floor) / floor) * 100));
        const cfg = notificationsConfig.spendingFloorWarning;
        scheduleLocalNotification(
          `floor_${key}`,
          cfg.title,
          cfg.body.replace('{accountName}', accountLabel).replace('{percentRemaining}', pct),
          5,
        );
      }
    }
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
    // Floor warning for the affected account
    if (accountKey) {
      const { accountFloors } = get();
      const floor = accountFloors[accountKey] ?? accountFloors.others ?? 0;
      if (floor > 0) {
        const newBal = updatedAccounts[accountKey] || 0;
        const threshold = floor + Math.floor(floor * 0.2);
        if (newBal < threshold) {
          const accountLabel = accountKey.replace(/([A-Z])/g, ' $1').toUpperCase();
          const pct = Math.max(0, Math.round(((newBal - floor) / floor) * 100));
          const cfg = notificationsConfig.spendingFloorWarning;
          scheduleLocalNotification(
            `floor_${accountKey}`,
            cfg.title,
            cfg.body.replace('{accountName}', accountLabel).replace('{percentRemaining}', pct),
            5,
          );
        }
      }
    }
    get().awardXP(10);
    get().checkAndAwardBadge('first_log');
    get().rotateFlavorTextForEvent('transaction');
    // Auto-complete post-payday actions when matching transfer is logged
    if (amt > 0) {
      const openActions = (get().postPaydayActions || []).filter(a => !a.completed && Date.now() < a.expiresAt);
      for (const action of openActions) {
        if (action.type === 'venmo_move' && accountKey === 'venmo') get().completePostPaydayAction(action.id);
        if (action.type === 'savings_move' && accountKey === 'entSavings') get().completePostPaydayAction(action.id);
      }
    }
    // Trigger significant-transaction auto-export
    if (Math.abs(amt) >= 10000) {
      AsyncStorage.getItem('nova_v2_export_config').then(raw => {
        if (raw) {
          const cfg = JSON.parse(raw);
          if (cfg.schedule === 'significant') {
            // Lazy import to avoid circular deps
            import('../hooks/useExport').then(m => {
              m.useExport().checkAndRunAutoExport();
            });
          }
        }
      }).catch(() => {});
    }
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
    let idx = 0;
    const mkId = () => `${now}_${++idx}`;

    // 1. Log gross paycheck as income to entChecking
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

    // 5. Advance nextPaycheckDate by the correct frequency interval
    const currentNext = incomeEvents.nextPaycheckDate;
    const freq = incomeEvents.payFrequency || incomeEvents.paycheckFrequency || 'biweekly';
    let nextPaycheckDate;
    if (!currentNext || freq === 'unscheduled') {
      nextPaycheckDate = currentNext;
    } else if (freq === 'weekly') {
      nextPaycheckDate = currentNext + 7 * 24 * 60 * 60 * 1000;
    } else if (freq === 'monthly') {
      const d = new Date(currentNext);
      nextPaycheckDate = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime();
    } else {
      nextPaycheckDate = currentNext + 14 * 24 * 60 * 60 * 1000;
    }

    const updatedIncomeEvents = { ...incomeEvents, paycheckAmount: gross, paycheckAmountCents: gross, nextPaycheckDate };
    const updatedTransactions = [...transactions, ...newTxs];

    set({ accounts: accts, transactions: updatedTransactions, incomeEvents: updatedIncomeEvents, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);

    get().checkAndAwardBadge('comma_club');
    // Savings milestone check after paycheck distribution
    const prevSavingsThousands = Math.floor((accounts.entSavings || 0) / 100000);
    const newSavingsThousands = Math.floor((accts.entSavings || 0) / 100000);
    if (newSavingsThousands > prevSavingsThousands && (accts.entSavings || 0) >= 100000) {
      const cfg = notificationsConfig.savingsMilestone;
      const amt = `$${newSavingsThousands.toLocaleString()},000`;
      scheduleLocalNotification('savings_milestone', cfg.title, cfg.body.replace('{amount}', amt), 5);
    }
    get().rotateFlavorTextForEvent('rollover');
    get().recomputeVariance();
    get().generatePostPaydayActions();
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
    const updatedIncomeEvents = { ...incomeEvents, partnerDepositLastReceivedMonth: currentMonth, partnerDepositAmountCents: amt, partnerDepositAmount: amt };

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
    const oldAccountKey = tx.accountKey;
    const newAccountKey = updates.accountKey || oldAccountKey;
    const updatedTx = { ...tx, ...updates, amountCents: newAmt };
    const updatedTransactions = transactions.map(t => t.id === txId ? updatedTx : t);
    let updatedAccounts = { ...accounts };
    if (oldAccountKey === newAccountKey) {
      const delta = newAmt - oldAmt;
      if (delta !== 0 && oldAccountKey) {
        updatedAccounts[oldAccountKey] = (updatedAccounts[oldAccountKey] || 0) + delta;
      }
    } else {
      if (oldAccountKey) updatedAccounts[oldAccountKey] = (updatedAccounts[oldAccountKey] || 0) - oldAmt;
      if (newAccountKey) updatedAccounts[newAccountKey] = (updatedAccounts[newAccountKey] || 0) + newAmt;
    }
    set({ transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);

    if (tx.category === 'Grocery') {
      const { groceryEntries, groceryBudget } = get();
      const currentWeekStart = getCurrentWeekStart();
      const matched = groceryEntries.find(e =>
        !e.deleted &&
        Math.abs(e.timestamp - tx.timestamp) < 5000 &&
        e.amountCents === Math.abs(oldAmt)
      );
      if (matched) {
        const updatedEntries = groceryEntries.map(e =>
          e.id === matched.id ? { ...e, amountCents: Math.abs(newAmt) } : e
        );
        const currentWeekSpend = updatedEntries
          .filter(e => !e.deleted && e.weekStartDate === currentWeekStart)
          .reduce((sum, e) => sum + e.amountCents, 0);
        const updatedBudget = { ...groceryBudget, currentWeekSpend };
        set({ groceryEntries: updatedEntries, groceryBudget: updatedBudget });
        await Promise.all([
          AsyncStorage.setItem(KEYS.groceryEntries, JSON.stringify(updatedEntries)),
          AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget)),
        ]);
      }
    }

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

    if (tx.category === 'Grocery') {
      const { groceryEntries, groceryBudget } = get();
      const currentWeekStart = getCurrentWeekStart();
      const matched = groceryEntries.find(e =>
        !e.deleted &&
        Math.abs(e.timestamp - tx.timestamp) < 5000 &&
        e.amountCents === Math.abs(tx.amountCents)
      );
      if (matched) {
        const updatedEntries = groceryEntries.map(e =>
          e.id === matched.id ? { ...e, deleted: true } : e
        );
        const currentWeekSpend = updatedEntries
          .filter(e => !e.deleted && e.weekStartDate === currentWeekStart)
          .reduce((sum, e) => sum + e.amountCents, 0);
        const updatedBudget = { ...groceryBudget, currentWeekSpend };
        set({ groceryEntries: updatedEntries, groceryBudget: updatedBudget });
        await Promise.all([
          AsyncStorage.setItem(KEYS.groceryEntries, JSON.stringify(updatedEntries)),
          AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget)),
        ]);
      }
    }

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
    const { groceryBudget, groceryEntries } = get();
    const currentWeekStart = getCurrentWeekStart();
    const now = Date.now();
    const amt = Math.floor(amountCents);

    const isNewWeek = !groceryBudget.weekStartDate || groceryBudget.weekStartDate < currentWeekStart;
    const prevSpend = isNewWeek ? 0 : (groceryBudget.currentWeekSpend || 0);
    const updatedBudget = {
      ...groceryBudget,
      currentWeekSpend: prevSpend + amt,
      weekStartDate: currentWeekStart,
    };

    const newEntry = {
      id: `grocery_${now}`,
      amountCents: amt,
      description: '',
      timestamp: now,
      weekStartDate: currentWeekStart,
      deleted: false,
    };
    const updatedEntries = [...groceryEntries, newEntry];

    set({ groceryBudget: updatedBudget, groceryEntries: updatedEntries });
    await Promise.all([
      AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget)),
      AsyncStorage.setItem(KEYS.groceryEntries, JSON.stringify(updatedEntries)),
    ]);

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

  editGroceryEntry: async (entryId, updates) => {
    const { groceryEntries, groceryBudget } = get();
    const currentWeekStart = getCurrentWeekStart();
    const updatedEntries = groceryEntries.map(e =>
      e.id === entryId ? { ...e, ...updates, amountCents: Math.floor(updates.amountCents ?? e.amountCents) } : e
    );
    const currentWeekSpend = updatedEntries
      .filter(e => !e.deleted && e.weekStartDate === currentWeekStart)
      .reduce((sum, e) => sum + e.amountCents, 0);
    const updatedBudget = { ...groceryBudget, currentWeekSpend };
    set({ groceryEntries: updatedEntries, groceryBudget: updatedBudget });
    await Promise.all([
      AsyncStorage.setItem(KEYS.groceryEntries, JSON.stringify(updatedEntries)),
      AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget)),
    ]);
    get().recomputeVariance();
  },

  deleteGroceryEntry: async (entryId) => {
    const { groceryEntries, groceryBudget } = get();
    const currentWeekStart = getCurrentWeekStart();
    const updatedEntries = groceryEntries.map(e =>
      e.id === entryId ? { ...e, deleted: true } : e
    );
    const currentWeekSpend = updatedEntries
      .filter(e => !e.deleted && e.weekStartDate === currentWeekStart)
      .reduce((sum, e) => sum + e.amountCents, 0);
    const updatedBudget = { ...groceryBudget, currentWeekSpend };
    set({ groceryEntries: updatedEntries, groceryBudget: updatedBudget });
    await Promise.all([
      AsyncStorage.setItem(KEYS.groceryEntries, JSON.stringify(updatedEntries)),
      AsyncStorage.setItem(KEYS.groceryBudget, JSON.stringify(updatedBudget)),
    ]);
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
    get().checkAndAwardBadge('balance_confirmed');
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
        massageIncome: state.massageIncome,
        massageExpenses: state.massageExpenses,
        cleaningExpenses: state.cleaningExpenses,
        now,
      });
    }

    set({ varianceCache: { ...newCache } });
  },

  resetStore: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const novaKeys = allKeys.filter(k => k.startsWith('nova_v2_'));
      if (novaKeys.length > 0) await AsyncStorage.multiRemove(novaKeys);
    } catch (e) {}
    set({ ...initialState });
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
    const { lastCycleResetMonth, groceryBudget, groceryStreakWeeks, householdBills, personalBills } = get();
    if (currentCycleId !== lastCycleResetMonth) {
      // Check partner deposit missed for closing cycle
      const { incomeEvents } = get();
      if (lastCycleResetMonth && incomeEvents?.partnerDepositLastReceivedMonth !== lastCycleResetMonth) {
        const cfg = notificationsConfig.partnerDepositMissed;
        scheduleLocalNotification('partner_deposit_missed', cfg.title, cfg.body, 5);
      }

      // Grocery streak: check if closing week was under limit
      let newStreakWeeks = groceryStreakWeeks;
      if (groceryBudget?.weeklyLimit > 0) {
        if ((groceryBudget.currentWeekSpend || 0) <= groceryBudget.weeklyLimit) {
          newStreakWeeks += 1;
        } else {
          newStreakWeeks = 0;
        }
      }
      if (newStreakWeeks >= 4) {
        get().checkAndAwardBadge('grocery_discipline');
      }

      // cycle_complete badge: all active bills paid this cycle
      const closingCycleId = lastCycleResetMonth;
      if (closingCycleId) {
        const allBills = [...(householdBills || []), ...(personalBills || [])];
        const activeBills = allBills.filter(b => b.isActive !== false);
        const allPaid = activeBills.length > 0 && activeBills.every(b => b.lastPaidMonth === closingCycleId);
        if (allPaid) {
          get().checkAndAwardBadge('cycle_complete');
        }
      }

      set({ lastCycleResetMonth: currentCycleId, groceryStreakWeeks: newStreakWeeks });
      await Promise.all([
        AsyncStorage.setItem(KEYS.LAST_CYCLE_RESET_MONTH, JSON.stringify(currentCycleId)),
        AsyncStorage.setItem(KEYS.groceryStreakWeeks, JSON.stringify(newStreakWeeks)),
      ]);
      get().recomputeVariance();
      get().rotateFlavorTextForEvent('cycle_reset');
    }
  },

  awardXP: async (amount) => {
    const xpTotal = get().xpTotal + Math.floor(amount);
    set({ xpTotal });
    await AsyncStorage.setItem(KEYS.xpTotal, JSON.stringify(xpTotal));
  },

  checkAndAwardBadge: async (key) => {
    const badges = get().badges;
    if (badges[key]) return;
    const { confirmStreak, transactions, massageIncome, cleaningExpenses, accounts } = get();

    let earned = false;
    if (key === 'first_log') earned = (transactions || []).filter(t => !t.deleted).length >= 1;
    if (key === 'rollover_king') earned = true; // only called when rollover actually fires
    if (key === 'balance_confirmed') earned = confirmStreak >= 7;
    if (key === 'llc_launched') earned = (cleaningExpenses || []).filter(r => !r.deleted).length >= 1;
    if (key === 'massage_income') earned = (massageIncome || []).filter(r => !r.deleted).length >= 1;
    if (key === 'comma_club') earned = (accounts.entSavings || 0) >= 100000;

    if (earned) {
      const newBadges = { ...badges, [key]: Date.now() };
      set({ badges: newBadges });
      await AsyncStorage.setItem(KEYS.badges, JSON.stringify(newBadges));
    }
  },

  getLastActivity: async () => {
    const raw = await AsyncStorage.getItem(KEYS.lastActivityAt);
    return raw ? JSON.parse(raw) : null;
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

  logMassageIncome: async (record) => {
    const id = 'massage_inc_' + Date.now();
    const newRecord = { ...record, id, createdAt: Date.now() };
    const updated = [...get().massageIncome, newRecord];
    const { accounts, transactions } = get();
    const dest = record.destinationAccount || 'cash';
    const prevSavings = accounts.entSavings || 0;
    const updatedAccounts = { ...accounts, [dest]: (accounts[dest] || 0) + (record.amountCents || 0) };
    // Mirror transaction so it appears in Personal Recent Activity
    const mirrorTx = {
      id: 'massage_mirror_' + id,
      accountKey: dest,
      amountCents: record.amountCents || 0,
      category: 'income',
      description: 'Massage Income',
      source: 'massage',
      sourceId: id,
      timestamp: record.date || Date.now(),
    };
    const updatedTransactions = [...transactions, mirrorTx];
    set({ massageIncome: updated, accounts: updatedAccounts, transactions: updatedTransactions });
    await Promise.all([
      AsyncStorage.setItem(KEYS.MASSAGE_INCOME, JSON.stringify(updated)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
    ]);
    get().awardXP(10);
    get().checkAndAwardBadge('massage_income');
    // Savings milestone check (if destination was entSavings)
    if (dest === 'entSavings') {
      const newSavings = updatedAccounts.entSavings || 0;
      const prevThousands = Math.floor(prevSavings / 100000);
      const newThousands = Math.floor(newSavings / 100000);
      if (newThousands > prevThousands && newSavings >= 100000) {
        const cfg = notificationsConfig.savingsMilestone;
        const amt = `$${(newThousands).toLocaleString()},000`;
        scheduleLocalNotification('savings_milestone', cfg.title, cfg.body.replace('{amount}', amt), 5);
        get().checkAndAwardBadge('comma_club');
      }
    }
    get().recomputeVariance();
  },

  editMassageIncome: async (id, updates) => {
    const existing = get().massageIncome.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const { accounts, transactions } = get();
    let updatedAccounts = { ...accounts };
    // Reverse old credit
    const oldDest = existing.destinationAccount || 'cash';
    updatedAccounts[oldDest] = (updatedAccounts[oldDest] || 0) - existing.amountCents;
    // Apply new credit
    const newDest = updates.destinationAccount || oldDest;
    const newAmt = updates.amountCents !== undefined ? updates.amountCents : existing.amountCents;
    updatedAccounts[newDest] = (updatedAccounts[newDest] || 0) + newAmt;
    const updated = get().massageIncome.map(r => r.id === id ? { ...r, ...updates } : r);
    // Update mirror transaction
    const updatedTransactions = transactions.map(t =>
      t.sourceId === id && t.source === 'massage'
        ? { ...t, accountKey: newDest, amountCents: newAmt, timestamp: updates.date || t.timestamp }
        : t
    );
    set({ massageIncome: updated, accounts: updatedAccounts, transactions: updatedTransactions });
    await Promise.all([
      AsyncStorage.setItem(KEYS.MASSAGE_INCOME, JSON.stringify(updated)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
    ]);
    get().recomputeVariance();
  },

  deleteMassageIncome: async (id) => {
    const existing = get().massageIncome.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const { accounts, transactions } = get();
    const dest = existing.destinationAccount || 'cash';
    const updatedAccounts = { ...accounts, [dest]: (accounts[dest] || 0) - existing.amountCents };
    const updated = get().massageIncome.map(r => r.id === id ? { ...r, deleted: true } : r);
    // Soft-delete mirror transaction (balance already reversed above)
    const updatedTransactions = transactions.map(t =>
      t.sourceId === id && t.source === 'massage' ? { ...t, deleted: true } : t
    );
    set({ massageIncome: updated, accounts: updatedAccounts, transactions: updatedTransactions });
    await Promise.all([
      AsyncStorage.setItem(KEYS.MASSAGE_INCOME, JSON.stringify(updated)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
    ]);
    get().recomputeVariance();
  },

  logMassageExpense: async (record) => {
    const id = 'massage_exp_' + Date.now();
    const newRecord = { ...record, id, createdAt: Date.now() };
    const updated = [...get().massageExpenses, newRecord];
    set({ massageExpenses: updated });
    await AsyncStorage.setItem(KEYS.MASSAGE_EXPENSES, JSON.stringify(updated));
    get().awardXP(3);
    get().recomputeVariance();
  },

  editMassageExpense: async (id, updates) => {
    const updated = get().massageExpenses.map((r) => r.id === id ? { ...r, ...updates } : r);
    set({ massageExpenses: updated });
    await AsyncStorage.setItem(KEYS.MASSAGE_EXPENSES, JSON.stringify(updated));
    get().recomputeVariance();
  },

  deleteMassageExpense: async (id) => {
    const updated = get().massageExpenses.map((r) => r.id === id ? { ...r, deleted: true } : r);
    set({ massageExpenses: updated });
    await AsyncStorage.setItem(KEYS.MASSAGE_EXPENSES, JSON.stringify(updated));
    get().recomputeVariance();
  },

  logCleaningExpense: async (record) => {
    const id = 'clean_exp_' + Date.now();
    const newRecord = { ...record, id, createdAt: Date.now() };
    const updated = [...get().cleaningExpenses, newRecord];
    set({ cleaningExpenses: updated });
    await AsyncStorage.setItem(KEYS.CLEANING_EXPENSES, JSON.stringify(updated));
    get().awardXP(3);
    get().checkAndAwardBadge('llc_launched');
    get().recomputeVariance();
  },

  editCleaningExpense: async (id, updates) => {
    const updated = get().cleaningExpenses.map((r) => r.id === id ? { ...r, ...updates } : r);
    set({ cleaningExpenses: updated });
    await AsyncStorage.setItem(KEYS.CLEANING_EXPENSES, JSON.stringify(updated));
    get().recomputeVariance();
  },

  deleteCleaningExpense: async (id) => {
    const updated = get().cleaningExpenses.map((r) => r.id === id ? { ...r, deleted: true } : r);
    set({ cleaningExpenses: updated });
    await AsyncStorage.setItem(KEYS.CLEANING_EXPENSES, JSON.stringify(updated));
    get().recomputeVariance();
  },

  logCleaningMileage: async (record) => {
    const id = 'clean_mile_' + Date.now();
    const newRecord = { ...record, id, createdAt: Date.now() };
    const updated = [...get().cleaningMileage, newRecord];
    set({ cleaningMileage: updated });
    await AsyncStorage.setItem(KEYS.CLEANING_MILEAGE, JSON.stringify(updated));
    get().awardXP(2);
    get().recomputeVariance();
  },

  editCleaningMileage: async (id, updates) => {
    const updated = get().cleaningMileage.map((r) => r.id === id ? { ...r, ...updates } : r);
    set({ cleaningMileage: updated });
    await AsyncStorage.setItem(KEYS.CLEANING_MILEAGE, JSON.stringify(updated));
    get().recomputeVariance();
  },

  deleteCleaningMileage: async (id) => {
    const updated = get().cleaningMileage.map((r) => r.id === id ? { ...r, deleted: true } : r);
    set({ cleaningMileage: updated });
    await AsyncStorage.setItem(KEYS.CLEANING_MILEAGE, JSON.stringify(updated));
    get().recomputeVariance();
  },

  logCleaningIncome: async (record) => {
    const id = 'cleaning_inc_' + Date.now();
    const newRecord = { ...record, id, createdAt: Date.now() };
    const updated = [...get().cleaningIncome, newRecord];
    const { accounts } = get();
    const updatedAccounts = { ...accounts, cleaningChecking: (accounts.cleaningChecking || 0) + (record.amountCents || 0) };
    set({ cleaningIncome: updated, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.cleaningIncome, JSON.stringify(updated)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    get().awardXP(10);
    get().recomputeVariance();
  },

  editCleaningIncome: async (id, updates) => {
    const existing = get().cleaningIncome.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const { accounts } = get();
    const oldAmt = existing.amountCents || 0;
    const newAmt = updates.amountCents !== undefined ? updates.amountCents : oldAmt;
    const updatedAccounts = {
      ...accounts,
      cleaningChecking: (accounts.cleaningChecking || 0) - oldAmt + newAmt,
    };
    const updated = get().cleaningIncome.map(r => r.id === id ? { ...r, ...updates } : r);
    set({ cleaningIncome: updated, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.cleaningIncome, JSON.stringify(updated)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    get().recomputeVariance();
  },

  deleteCleaningIncome: async (id) => {
    const existing = get().cleaningIncome.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const { accounts } = get();
    const updatedAccounts = {
      ...accounts,
      cleaningChecking: (accounts.cleaningChecking || 0) - (existing.amountCents || 0),
    };
    const updated = get().cleaningIncome.map(r => r.id === id ? { ...r, deleted: true } : r);
    set({ cleaningIncome: updated, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.cleaningIncome, JSON.stringify(updated)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    get().recomputeVariance();
  },

  generatePostPaydayActions: async () => {
    const { novaConfig } = get();
    const now = Date.now();
    const expiryMs = ((novaConfig?.postPaydayExpiryHours ?? 12) * 60 * 60 * 1000);
    const toggles = novaConfig?.postPaydayActionToggles ?? { venmo: true, savings: true };
    const actions = [];
    if (toggles.venmo !== false) {
      actions.push({
        id: 'ppd_venmo_' + now,
        type: 'venmo_move',
        label: 'Move money to Venmo',
        completed: false,
        completedAt: null,
        createdAt: now,
        expiresAt: now + expiryMs,
      });
    }
    if (toggles.savings !== false) {
      actions.push({
        id: 'ppd_savings_' + now,
        type: 'savings_move',
        label: 'Move money to Savings',
        completed: false,
        completedAt: null,
        createdAt: now,
        expiresAt: now + expiryMs,
      });
    }
    set({ postPaydayActions: actions });
    await AsyncStorage.setItem(KEYS.postPaydayActions, JSON.stringify(actions));
  },

  completePostPaydayAction: async (id) => {
    const updated = get().postPaydayActions.map(a =>
      a.id === id ? { ...a, completed: true, completedAt: Date.now() } : a
    );
    set({ postPaydayActions: updated });
    await AsyncStorage.setItem(KEYS.postPaydayActions, JSON.stringify(updated));
    get().awardXP(15);
  },

  dismissPostPaydayAction: async (id) => {
    const updated = get().postPaydayActions.map(a =>
      a.id === id ? { ...a, completed: true, completedAt: Date.now() } : a
    );
    set({ postPaydayActions: updated });
    await AsyncStorage.setItem(KEYS.postPaydayActions, JSON.stringify(updated));
  },

  pruneExpiredPostPaydayActions: async () => {
    const now = Date.now();
    const filtered = get().postPaydayActions.filter(a => now <= a.expiresAt);
    set({ postPaydayActions: filtered });
    await AsyncStorage.setItem(KEYS.postPaydayActions, JSON.stringify(filtered));
  },

  updateNovaConfig: async (updates) => {
    const merged = { ...get().novaConfig, ...updates };
    set({ novaConfig: merged });
    await AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(merged));
  },
}));

export default useStore;
