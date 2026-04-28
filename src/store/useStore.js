import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    partnerDepositReceived: false,
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
    ]);

    set({
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
    });
  },

  setOnboardingComplete: async () => {
    set({ onboardingComplete: true });
    await AsyncStorage.setItem(KEYS.onboardingComplete, JSON.stringify(true));
  },

  updateAccountBalance: async (key, cents) => {
    const accounts = { ...get().accounts, [key]: Math.floor(cents) };
    set({ accounts, lastActivityAt: Date.now() });
    await AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accounts));
    await AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(Date.now()));
  },

  logTransaction: async (tx) => {
    const transactions = [...get().transactions, { ...tx, id: Date.now().toString(), timestamp: Date.now() }];
    set({ transactions, lastActivityAt: Date.now() });
    await AsyncStorage.setItem(KEYS.transactions, JSON.stringify(transactions));
    await AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(Date.now()));
    get().awardXP(10);
    get().checkAndAwardBadge('firstLog');
  },

  confirmBalance: async () => {
    const now = Date.now();
    const lastConfirmDate = get().lastConfirmDate;
    const isSameDay = lastConfirmDate
      ? new Date(lastConfirmDate).toDateString() === new Date(now).toDateString()
      : false;

    const newStreak = isSameDay ? get().confirmStreak : get().confirmStreak + 1;

    set({ lastActivityAt: now, lastConfirmDate: now, confirmStreak: newStreak });
    await AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now));
    await AsyncStorage.setItem(KEYS.lastConfirmDate, JSON.stringify(now));
    await AsyncStorage.setItem(KEYS.confirmStreak, JSON.stringify(newStreak));

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
