import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMonthsClamped, getCurrentWeekStart, isSameDay } from '../utils/dates';
import { CASH_FLOW_FORECAST_CARD_ID, computeProfileVariance } from '../utils/forecasting';
import {
  getDominantVarianceState,
  getNovaFaceForState,
  getNovaStatePayload,
  pickNovaResponse,
} from '../utils/novaStateEngine';
import { scheduleLocalNotification } from '../utils/notifications';
import notificationsConfig from '../config/notifications.config';
import { XP_EVENTS, XP_CATEGORIES } from '../config/xp.config';
import { evaluateBadges, diffBadgeState } from '../utils/badgeEngine';
import {
  AUTO_ACTIVE_SPENDING_CATEGORIES,
  CATEGORY_BILLS,
  CATEGORY_GROCERIES,
  CATEGORY_SUBSCRIPTIONS,
  CATEGORY_UNCATEGORIZED,
  canonicalCategoryLabel,
  categoryKey,
  isAutoActiveSpendingCategory,
  isKnownPresetSpendingCategory,
} from '../utils/spendingCategories';
import {
  getReceiptAttachments,
  normalizeReceiptAttachments,
  withReceiptAttachments,
} from '../utils/receiptFiles';
import { buildCategoryRulesFromRows } from '../utils/statementImport';
import {
  SAVINGS_GOALS_CARD_ID,
  normalizeCardOrderIds,
  normalizeSavingsGoal,
  normalizeSavingsGoals,
} from '../utils/savingsGoals';
import {
  getNextRecurringDate,
  localDateKey,
  normalizeRecurringTransaction,
} from '../utils/recurringTransactions';
import {
  normalizeReconciliationRecord,
  sortReconciliations,
} from '../utils/reconciliation';

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
  groceryHistory: 'nova_v2_grocery_history',
  personalGroceryBudget: 'nova_v2_personal_grocery_budget',
  personalGroceryHistory: 'nova_v2_personal_grocery_history',
  personalGroceryEntries: 'nova_v2_personal_grocery_entries',
  transactions: 'nova_v2_transactions',
  recurringTransactions: 'nova_v2_recurring_transactions',
  irsRatePerMile: 'nova_v2_irsRatePerMile',
  xpTotal: 'nova_v2_xpTotal',
  xpHistory: 'nova_v2_xp_history',
  badges: 'nova_v2_badges',
  confirmStreak: 'nova_v2_confirmStreak',
  lastConfirmDate: 'nova_v2_lastConfirmDate',
  currentFlavorText: 'nova_v2_currentFlavorText',
  currentNovaState: 'nova_v2_currentNovaState',
  currentNovaFace: 'nova_v2_currentNovaFace',
  lastNovaStateAt: 'nova_v2_lastNovaStateAt',
  lastActivityAt: 'nova_v2_lastActivityAt',
  autoExportSchedule: 'nova_v2_autoExportSchedule',
  schemaVersion: 'nova_v2_schemaVersion',
  VARIANCE_CONFIG: 'nova_v2_variance_config',
  LAST_CYCLE_RESET_MONTH: 'nova_v2_last_cycle_reset_month',
  groceryEntries: 'nova_v2_grocery_entries',
  groceryStreakWeeks: 'nova_v2_grocery_streak_weeks',
  genericBusinessIncome: 'nova_v2_generic_business_income',
  genericBusinessExpenses: 'nova_v2_generic_business_expenses',
  genericBusinessMileage: 'nova_v2_generic_business_mileage',
  postPaydayActions: 'nova_v2_post_payday_actions',
  novaConfig: 'nova_v2_config',
  groceryDisciplineStreak: 'nova_v2_grocery_discipline_streak',
  accountRegistry: 'nova_v2_account_registry',
  businesses: 'nova_v2_businesses',
  spendingBuckets: 'nova_v2_spending_buckets',
  dashboardCardOrder: 'nova_v2_dashboard_card_order',
  personalCardOrder: 'nova_v2_personal_card_order',
  householdCardOrder: 'nova_v2_household_card_order',
  businessCardOrder: 'nova_v2_business_card_order',
  dashboardHiddenCards: 'nova_v2_dashboard_hidden_cards',
  personalHiddenCards: 'nova_v2_personal_hidden_cards',
  householdHiddenCards: 'nova_v2_household_hidden_cards',
  businessHiddenCards: 'nova_v2_business_hidden_cards',
  groceryReserveOn: 'nova_v2_grocery_reserve_on',
  importCategoryRules: 'nova_v2_import_category_rules',
  reconciliationHistory: 'nova_v2_account_reconciliations',
  actionCounts: 'nova_v2_action_counts',
  streakData: 'nova_v2_streak_data',
  badgeState: 'nova_v2_badge_state',
  pendingUnlocks: 'nova_v2_pending_unlocks',
};

const SCHEDULED_BILL_CATEGORY = CATEGORY_BILLS;
const RECEIPT_CARD_ID = 'receipt_attachments';
const EXPORT_CONFIG_KEY = 'nova_v2_export_config';

function requestAutoExportForChange(amountCents = 0) {
  AsyncStorage.getItem(EXPORT_CONFIG_KEY).then(raw => {
    if (!raw) return;
    const cfg = JSON.parse(raw);
    const schedule = cfg.schedule || 'off';
    if (schedule !== 'realtime' && !(schedule === 'significant' && Math.abs(amountCents) >= 10000)) return;
    import('../hooks/useExport').then(m => {
      m.useExport().checkAndRunAutoExport();
    });
  }).catch(() => {});
}

const DEFAULT_PERSONAL_CARD_ORDER = [
  'variance',
  CASH_FLOW_FORECAST_CARD_ID,
  'spending_chart',
  'spending_categories',
  'accounts',
  'pay_cycle',
  SAVINGS_GOALS_CARD_ID,
  'bills',
  'grocery',
  RECEIPT_CARD_ID,
  'recent_activity',
];

const PERSONAL_CARD_IDS = new Set(DEFAULT_PERSONAL_CARD_ORDER);

const DEFAULT_HOUSEHOLD_CARD_ORDER = [
  'variance',
  CASH_FLOW_FORECAST_CARD_ID,
  'spending_chart',
  'spending_categories',
  'joint_balance',
  'scheduled_income',
  SAVINGS_GOALS_CARD_ID,
  'grocery',
  'bills',
  RECEIPT_CARD_ID,
  'recent_activity',
];

const HOUSEHOLD_CARD_IDS = new Set(DEFAULT_HOUSEHOLD_CARD_ORDER);

const DEFAULT_BUSINESS_CARD_ORDER = [
  'variance',
  'spending_chart',
  'spending_categories',
  SAVINGS_GOALS_CARD_ID,
  'business_balance',
  'tax_summary',
  RECEIPT_CARD_ID,
  'income',
  'expenses',
  'mileage',
];

const BUSINESS_CARD_IDS = new Set(DEFAULT_BUSINESS_CARD_ORDER);

const DEFAULT_DASHBOARD_CARD_ORDER = [
  'variance',
  CASH_FLOW_FORECAST_CARD_ID,
  'charts',
  SAVINGS_GOALS_CARD_ID,
  'quick_actions',
  'badges',
  'recent_activity',
];

const DASHBOARD_CARD_IDS = new Set(DEFAULT_DASHBOARD_CARD_ORDER);

function getActiveAccountKeyForRole(state, role, fallback = null) {
  const account = (state.accountRegistry || []).find(a => a.isActive !== false && a.role === role);
  if (account) return account.legacyKey || account.id;
  if (fallback && Object.prototype.hasOwnProperty.call(state.accounts || {}, fallback)) return fallback;
  return null;
}

function getFirstActiveAccountKey(state, role = null) {
  const account = (state.accountRegistry || []).find(a => a.isActive !== false && (!role || a.role === role));
  if (account) return account.legacyKey || account.id;
  const keys = Object.keys(state.accounts || {});
  return keys.length > 0 ? keys[0] : null;
}

function getGroceryAccountKey(state) {
  const userMode = state.novaConfig?.userMode;
  if (userMode === 'solo') return getActiveAccountKeyForRole(state, 'personal') || getFirstActiveAccountKey(state);
  return getActiveAccountKeyForRole(state, 'household') || getFirstActiveAccountKey(state);
}

const GROCERY_SCOPE_CONFIG = {
  household: {
    budgetKey: 'groceryBudget',
    historyKey: 'groceryHistory',
    entriesKey: 'groceryEntries',
    budgetStorageKey: KEYS.groceryBudget,
    historyStorageKey: KEYS.groceryHistory,
    entriesStorageKey: KEYS.groceryEntries,
    accountRole: 'household',
    label: 'Household',
  },
  personal: {
    budgetKey: 'personalGroceryBudget',
    historyKey: 'personalGroceryHistory',
    entriesKey: 'personalGroceryEntries',
    budgetStorageKey: KEYS.personalGroceryBudget,
    historyStorageKey: KEYS.personalGroceryHistory,
    entriesStorageKey: KEYS.personalGroceryEntries,
    accountRole: 'personal',
    label: 'Personal',
  },
};

function normalizeGroceryScope(scope, state = {}) {
  if (scope === 'personal' || scope === 'household') return scope;
  return state.novaConfig?.userMode === 'solo' ? 'personal' : 'household';
}

function getGroceryScopeConfig(scope, state = {}) {
  return GROCERY_SCOPE_CONFIG[normalizeGroceryScope(scope, state)] || GROCERY_SCOPE_CONFIG.household;
}

function getGroceryAccountKeyForScope(state, scope) {
  const cfg = getGroceryScopeConfig(scope, state);
  return getActiveAccountKeyForRole(state, cfg.accountRole) || getGroceryAccountKey(state);
}

function getGroceryLookupScopes(scope, state = {}) {
  if (scope === 'personal' || scope === 'household') return [scope];
  const defaultScope = normalizeGroceryScope(scope, state);
  return [defaultScope, ...['household', 'personal'].filter(item => item !== defaultScope)];
}

function getScopedGroceryState(state, scope) {
  const normalizedScope = normalizeGroceryScope(scope, state);
  const cfg = getGroceryScopeConfig(normalizedScope, state);
  return {
    scope: normalizedScope,
    cfg,
    budget: { ...initialState.groceryBudget, ...(state[cfg.budgetKey] || {}) },
    history: Array.isArray(state[cfg.historyKey]) ? state[cfg.historyKey] : [],
    entries: Array.isArray(state[cfg.entriesKey]) ? state[cfg.entriesKey] : [],
  };
}

function findGroceryEntryById(state, entryId, scope) {
  for (const lookupScope of getGroceryLookupScopes(scope, state)) {
    const groceryState = getScopedGroceryState(state, lookupScope);
    const entry = groceryState.entries.find(e => e.id === entryId && !e.deleted);
    if (entry) return { ...groceryState, entry };
  }
  return null;
}

function findGroceryEntryForTransaction(state, tx, expectedAmountCents = null) {
  const lookupScopes = getGroceryLookupScopes(tx?.groceryScope, state);
  for (const scope of lookupScopes) {
    const groceryState = getScopedGroceryState(state, scope);
    const entry = groceryState.entries.find(e =>
      !e.deleted &&
      (
        e.transactionId === tx?.id ||
        e.id === tx?.sourceId ||
        (
          Math.abs((e.timestamp || 0) - (tx?.timestamp || 0)) < 5000 &&
          (expectedAmountCents == null || e.amountCents === Math.abs(expectedAmountCents))
        )
      )
    );
    if (entry) return { ...groceryState, entry };
  }
  return null;
}

function getSavingsAccountKeys(state) {
  const savings = (state.accountRegistry || [])
    .filter(a => a.isActive !== false && a.type === 'savings')
    .map(a => a.legacyKey || a.id);
  if (savings.length > 0) return savings;
  return Object.prototype.hasOwnProperty.call(state.accounts || {}, 'entSavings') ? ['entSavings'] : [];
}

function getAccountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

function isTransferTransaction(tx) {
  return tx?.source === 'transfer' || tx?.sourceType === 'account_transfer' || !!tx?.transferGroupId;
}

function receiptFieldsForRecord(record) {
  const attachments = getReceiptAttachments(record);
  return attachments.length > 0 ? withReceiptAttachments({}, attachments) : {};
}

function updateRecordReceipts(records = [], sourceId, txId, attachments = []) {
  let changed = false;
  const updated = (records || []).map(record => {
    if (record?.id === sourceId || record?.transactionId === txId) {
      changed = true;
      return withReceiptAttachments(record, attachments);
    }
    return record;
  });
  return changed ? updated : null;
}

function getAccountRoleForKey(state, key) {
  const account = (state.accountRegistry || []).find(item =>
    item && item.isActive !== false && (item.id === key || item.legacyKey === key)
  );
  return account?.role || null;
}

function mergeImportCategoryRules(current = [], incoming = []) {
  const merged = new Map();
  (current || []).forEach(rule => {
    if (rule?.pattern && rule?.category) merged.set(rule.pattern, rule);
  });
  (incoming || []).forEach(rule => {
    if (!rule?.pattern || !rule?.category) return;
    const existing = merged.get(rule.pattern);
    merged.set(rule.pattern, {
      ...existing,
      ...rule,
      count: (existing?.count || 0) + (rule.count || 1),
      updatedAt: rule.updatedAt || Date.now(),
    });
  });
  return Array.from(merged.values()).slice(-500);
}

function getAccountDisplayName(state, key) {
  const account = (state.accountRegistry || []).find(a =>
    a && (a.id === key || a.legacyKey === key)
  );
  return account ? (account.name || account.id) : key;
}

function accountKeyExists(state, key) {
  if (!key) return false;
  if (Object.prototype.hasOwnProperty.call(state.accounts || {}, key)) return true;
  return (state.accountRegistry || []).some(account =>
    account && account.isActive !== false && (account.id === key || account.legacyKey === key)
  );
}

function getBusinessAccountKey(state, businessId, fallback = null) {
  const business = (state.businesses || []).find(b => b.id === businessId);
  const preferred = business?.defaultAccountKey || business?.accountKey || fallback;
  if (accountKeyExists(state, preferred)) return preferred;
  const businessAccount = (state.accountRegistry || []).find(a => a.isActive !== false && a.role === 'business');
  if (businessAccount) return getAccountKey(businessAccount);
  return getFirstActiveAccountKey(state);
}

function getBusinessName(state, businessId) {
  const business = (state.businesses || []).find(b => b.id === businessId);
  return business?.name || 'Business';
}

function getRecordDateMs(record) {
  const raw = record?.timestamp ?? record?.date ?? record?.createdAt ?? Date.now();
  if (typeof raw === 'number') return raw;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function recalcCurrentGrocerySpend(entries, currentWeekStart = getCurrentWeekStart()) {
  return (entries || [])
    .filter(e => !e.deleted && e.weekStartDate === currentWeekStart)
    .reduce((sum, e) => sum + (e.amountCents || 0), 0);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getLocalCycleId(value = Date.now()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getNextCycleId(cycleId) {
  const [year, month] = String(cycleId).split('-').map(Number);
  const next = new Date(year, month, 1, 12, 0, 0, 0);
  return getLocalCycleId(next.getTime());
}

function getBillExpectedAmountCents(bill) {
  return Math.floor(bill?.amountCents ?? bill?.amount ?? 0);
}

function getBillAmountType(bill) {
  if (bill?.amountType === 'static' || bill?.isStaticAmount === true) return 'static';
  return 'dynamic';
}

function getBillItemType(input = {}, defaultType = 'bill') {
  const raw = String(
    input.billType ||
    input.kind ||
    input.itemType ||
    input.scheduledItemType ||
    input.category ||
    defaultType ||
    'bill'
  ).toLowerCase();
  return raw.includes('subscription') ? 'subscription' : 'bill';
}

function getBillSpendingCategory(bill = {}) {
  return getBillItemType(bill) === 'subscription' ? CATEGORY_SUBSCRIPTIONS : CATEGORY_BILLS;
}

function isStaticBill(bill) {
  return getBillAmountType(bill) === 'static';
}

function isBillAutoPostEnabled(bill) {
  if (!isStaticBill(bill)) return false;
  if (bill?.autoPostEnabled !== undefined) return bill.autoPostEnabled === true;
  if (bill?.isAutoPost !== undefined) return bill.isAutoPost === true;
  if (bill?.isAutoDraft !== undefined) return bill.isAutoDraft !== false;
  return true;
}

function getBillDueDateForCycle(bill, cycleId) {
  const [year, month] = String(cycleId).split('-').map(Number);
  if (!year || !month) return null;
  const dueDay = Math.max(1, Math.min(31, parseInt(bill?.expectedDay || bill?.dueDay || 1, 10) || 1));
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(dueDay, lastDay), 0, 0, 0, 0).getTime();
}

function normalizeBillForSave(input = {}, fallbackAccountKey = null, existing = null, defaultBillType = 'bill') {
  const expectedDay = Math.max(1, Math.min(31, parseInt(input.expectedDay || input.dueDay || existing?.expectedDay || existing?.dueDay || 1, 10) || 1));
  const amountType = input.amountType === 'static' ||
    input.isStaticAmount === true ||
    (input.amountType === undefined && input.isStaticAmount === undefined && getBillAmountType(existing) === 'static')
    ? 'static'
    : 'dynamic';
  const billType = getBillItemType({ ...existing, ...input }, defaultBillType);
  const explicitAutoPost = input.autoPostEnabled ?? input.isAutoPost ?? input.isAutoDraft;
  const existingAutoPost = existing?.autoPostEnabled ?? existing?.isAutoPost ?? existing?.isAutoDraft;
  const autoPostEnabled = amountType === 'static'
    ? (explicitAutoPost !== undefined ? explicitAutoPost === true : existingAutoPost !== undefined ? existingAutoPost !== false : true)
    : false;
  const now = Date.now();
  const currentCycleId = getLocalCycleId(now);
  const currentDueDate = getBillDueDateForCycle({ ...existing, ...input, expectedDay }, currentCycleId);
  const defaultStaticStart = currentDueDate && currentDueDate < now ? getNextCycleId(currentCycleId) : currentCycleId;
  const staticAutoPostStartMonth = amountType === 'static'
    ? (input.staticAutoPostStartMonth || existing?.staticAutoPostStartMonth || defaultStaticStart)
    : null;
  return {
    ...(existing || {}),
    ...input,
    amountCents: Math.floor(input.amountCents ?? existing?.amountCents ?? 0),
    expectedDay,
    dueDay: expectedDay,
    amountType,
    billType,
    kind: billType,
    category: billType === 'subscription' ? CATEGORY_SUBSCRIPTIONS : CATEGORY_BILLS,
    isStaticAmount: amountType === 'static',
    autoPostEnabled,
    isAutoPost: autoPostEnabled,
    isAutoDraft: autoPostEnabled,
    staticAutoPostStartMonth,
    defaultAccountKey: input.defaultAccountKey || input.accountKey || existing?.defaultAccountKey || fallbackAccountKey || null,
  };
}

function buildGroceryCloseoutRecord(weekStartDate, limitCents, spendCents, closedAt = Date.now()) {
  const varianceCents = Math.floor(limitCents || 0) - Math.floor(spendCents || 0);
  return {
    id: `grocery_week_${weekStartDate}`,
    weekStartDate,
    weekEndDate: weekStartDate + WEEK_MS - 1,
    limitCents: Math.floor(limitCents || 0),
    spendCents: Math.floor(spendCents || 0),
    varianceCents,
    status: varianceCents > 0 ? 'under' : varianceCents < 0 ? 'over' : 'even',
    closedAt,
  };
}

function updateClosedGroceryWeek(history = [], entries = [], groceryBudget = {}, weekStartDate = null) {
  if (!weekStartDate) return history;
  const existing = (history || []).find(record => record.weekStartDate === weekStartDate);
  if (!existing) return history;
  const limitCents = existing.limitCents || groceryBudget.weeklyLimit || 0;
  const spendCents = recalcCurrentGrocerySpend(entries, weekStartDate);
  const updated = buildGroceryCloseoutRecord(weekStartDate, limitCents, spendCents, existing.closedAt || Date.now());
  return (history || []).map(record => record.weekStartDate === weekStartDate ? { ...record, ...updated } : record);
}

const initialState = {
  onboardingComplete: false,
  accounts: {},
  accountFloors: { others: 0 },
  householdBills: [],
  personalBills: [],
  billOverrides: {},
  incomeEvents: {
    paycheckAmount: 0,
    paycheckFrequency: 'biweekly',
    nextPaycheckDate: null,
    scheduledIncomeEvents: [],
    partnerDepositAmount: 0,
    partnerDepositExpected: null,
    partnerDepositLastReceivedMonth: null,
  },
  distribution: {},
  groceryBudget: { weeklyLimit: 0, currentWeekSpend: 0, weekStartDate: null, lastClosedWeek: null },
  groceryHistory: [],
  groceryEntries: [],
  personalGroceryBudget: { weeklyLimit: 0, currentWeekSpend: 0, weekStartDate: null, lastClosedWeek: null },
  personalGroceryHistory: [],
  personalGroceryEntries: [],
  transactions: [],
  recurringTransactions: [],
  genericBusinessIncome: [],
  genericBusinessExpenses: [],
  genericBusinessMileage: [],
  irsRatePerMile: 70,
  xpTotal: 0,
  xpHistory: [],
  badges: {},
  confirmStreak: 0,
  lastConfirmDate: null,
  currentFlavorText: '',
  currentNovaState: 'neutral',
  currentNovaFace: 'neutral',
  lastNovaStateAt: null,
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
  novaConfig: {
    postPaydayExpiryHours: 12,
    postPaydayActionToggles: {},
    postPaydayActionAccountIds: [],
    balanceConfirmNudgeHours: 48,
    paycheckSplits: [],
    savingsGoal: { key: null, targetCents: 0, label: null, accountId: null },
    savingsGoals: [],
    cashFlowForecastHorizonDays: 30,
    widgetSettings: {
      accountKey: null,
      profile: 'personal',
      showSpendingLeft: true,
      showNextBill: true,
      showSavingsGoal: true,
    },
    appLock: {
      enabled: false,
      pinEnabled: false,
      pinLength: 4,
      pinSalt: null,
      pinHash: null,
      biometricEnabled: false,
      lockAfterMs: 0,
      lastChangedAt: null,
    },
    onboardingComplete: false,
    userMode: null,
    entrepreneurMode: false,
    guidedTourEnabled: true,
    tourDismissedCues: [],
    manualSetupRequested: false,
    setupCompletedAt: null,
  },
  groceryDisciplineStreak: 0,
  accountRegistry: [],
  businesses: [],
  spendingBuckets: [],
  dashboardCardOrder: DEFAULT_DASHBOARD_CARD_ORDER,
  personalCardOrder: DEFAULT_PERSONAL_CARD_ORDER,
  householdCardOrder: DEFAULT_HOUSEHOLD_CARD_ORDER,
  businessCardOrder: DEFAULT_BUSINESS_CARD_ORDER,
  dashboardHiddenCards: [],
  personalHiddenCards: [RECEIPT_CARD_ID],
  householdHiddenCards: [RECEIPT_CARD_ID],
  businessHiddenCards: [],
  groceryReserveOn: true,
  importCategoryRules: [],
  reconciliationHistory: [],
  badgeState: {},
  pendingUnlocks: [],
  actionCounts: {
    paycheckConfirmedSameDay: 0,
    paycheckConfirmedTotal: 0,
    billsPaidOnTime: 0,
    billsPaidLate: 0,
    groceryEntriesLogged: 0,
    weeksUnderBudget: 0,
    balanceConfirmations: 0,
    savingsDeposits: 0,
    businessIncomeTransactions: 0,
    businessExpenseTransactions: 0,
    businessMileageTransactions: 0,
    businessTransactions: 0,
    cyclesCompleted: 0,
    yellowToGreenRecoveries: 0,
    greenCycleEnds: 0,
    // BILL SLAYER V3: consecutive months where every bill was paid on time
    consecutiveOnTimeBillMonths: 0,
    lastBillCheckMonth: null,   // 'YYYY-MM' — month we last evaluated
    hadLateBillInMonth: false,  // reset at each new month
    // LEDGER KEEPER V3: distinct calendar weeks with >= 1 balance confirmation
    confirmationWeekStarts: [],  // array of week-start ms timestamps (deduped)
    // ENTREPRENEUR V3: months with >= 1 business income AND >= 1 business expense
    completePLMonths: 0,
    lastCompletePLMonth: null,      // 'YYYY-MM' — most recent month counted
    lastBusinessIncomeMonth: null,  // 'YYYY-MM'
    lastBusinessExpenseMonth: null, // 'YYYY-MM'
    // NOVA AGENT V3: weeks with XP in 3+ distinct categories
    // { weekStartMs: ['income', 'bills', ...] } — capped to last 130 weeks
    weeklyXPCategories: {},
    // Stage 3 additions
    xpByCategory: {
      income: 0, bills: 0, savings: 0, business: 0, balance: 0, transactions: 0, onboarding: 0,
    },
    totalBusinessIncomeCents: 0,   // ENTREPRENEUR badge V2
    currentCycleXP: 0,             // XP earned in the current pay cycle (reset each checkCycleReset)
    bestCycleXP: 0,                // highest single-cycle XP ever (CYCLE CLOSER badge V2)
    totalActiveDays: 0,            // distinct calendar days with any XP activity (NOVA AGENT badge V2)
    lastActiveDayStart: null,      // ms timestamp of midnight for last seen day
    crossCategoryWeeksTotal: 0,    // monotone count of weeks where 3+ XP categories appeared (NOVA AGENT badge V3)
    lastCrossCategoryWeekKey: null,// String(weekStartMs) of the last week counted, prevents double-counting
  },
  streakData: {
    weeklyActive: {
      current: 0,
      best: 0,
      lastActiveWeekStart: null, // ms timestamp of last week's Sunday midnight
    },
    paydayStreak: {
      current: 0,              // consecutive confirmed paychecks (on-time OR late)
      consecutiveOnTime: 0,    // V3 for Payday Oracle badge (on-time only, ≤24hr)
      consecutiveMisses: 0,    // consecutive missed paychecks (>48hr); 2 = reset
      // recentPaychecks: [ { timestamp, confirmType: 'on_time'|'late'|'missed', usedGrace: bool } ]
      // rolling last-6, used to compute graceUsedInWindow
      recentPaychecks: [],
    },
    groceryStreak: {
      current: 0,
      best: 0,
      consecutiveOverBudget: 0,     // consecutive weeks >10% over limit; 2 = reset
      lastEvaluatedWeekStart: null, // ms — prevents double-evaluation at month/week boundary
    },
  },
};

const HOUR_MS = 60 * 60 * 1000;

function classifyPaycheckConfirmation(nowMs, expectedDateMs) {
  if (!expectedDateMs) return 'on_time';
  const msLate = nowMs - expectedDateMs;
  if (msLate <= 24 * HOUR_MS) return 'on_time';
  if (msLate <= 48 * HOUR_MS) return 'late';
  return 'missed';
}

function buildPaydayProgress(prevActionCounts, prevStreakData, confirmType, timestamp) {
  const prevAC = { ...initialState.actionCounts, ...(prevActionCounts || {}) };
  const prevSD = {
    ...initialState.streakData,
    ...(prevStreakData || {}),
    paydayStreak: {
      ...initialState.streakData.paydayStreak,
      ...((prevStreakData || {}).paydayStreak || {}),
    },
  };
  const ps = prevSD.paydayStreak;
  const recentWindow = (ps.recentPaychecks || []).slice(-6);
  const graceUsedInWindow = recentWindow.filter(p => p.usedGrace).length;

  let newCurrent = ps.current || 0;
  let newConsecutiveOnTime = ps.consecutiveOnTime || 0;
  let newConsecutiveMisses = ps.consecutiveMisses || 0;
  let usedGrace = false;

  if (confirmType === 'on_time') {
    newCurrent += 1;
    newConsecutiveOnTime += 1;
    newConsecutiveMisses = 0;
  } else if (confirmType === 'late') {
    newCurrent += 1;
    newConsecutiveOnTime = 0;
    newConsecutiveMisses = 0;
  } else if (graceUsedInWindow < 1) {
    usedGrace = true;
    newConsecutiveMisses = 0;
  } else {
    newConsecutiveMisses += 1;
    if (newConsecutiveMisses >= 2) {
      newCurrent = 0;
      newConsecutiveOnTime = 0;
      newConsecutiveMisses = 0;
    }
  }

  const recentPaychecks = [
    ...recentWindow,
    { timestamp, confirmType, usedGrace },
  ].slice(-6);

  return {
    actionCounts: {
      ...prevAC,
      paycheckConfirmedTotal: (prevAC.paycheckConfirmedTotal || 0) + 1,
      paycheckConfirmedSameDay: (prevAC.paycheckConfirmedSameDay || 0) + (confirmType === 'on_time' ? 1 : 0),
    },
    streakData: {
      ...prevSD,
      paydayStreak: {
        ...ps,
        current: newCurrent,
        consecutiveOnTime: newConsecutiveOnTime,
        consecutiveMisses: newConsecutiveMisses,
        recentPaychecks,
      },
    },
  };
}

async function loadKey(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function upgradeBillIfNeeded(bill, defaultAccountKey, defaultBillType = 'bill') {
  if (bill.expectedDay !== undefined) {
    const billType = getBillItemType(bill, defaultBillType);
    const amountType = getBillAmountType(bill);
    const autoPostEnabled = amountType === 'static'
      ? (
        bill.autoPostEnabled !== undefined
          ? bill.autoPostEnabled === true
          : bill.isAutoPost !== undefined
            ? bill.isAutoPost === true
            : bill.isAutoDraft !== undefined
              ? bill.isAutoDraft !== false
              : true
      )
      : false;
    return {
      ...bill,
      amountType,
      isStaticAmount: amountType === 'static',
      autoPostEnabled,
      isAutoPost: autoPostEnabled,
      isAutoDraft: autoPostEnabled,
      billType,
      kind: billType,
      category: billType === 'subscription' ? CATEGORY_SUBSCRIPTIONS : CATEGORY_BILLS,
    };
  }
  const billType = getBillItemType(bill, defaultBillType);
  return {
    ...bill,
    expectedDay: bill.dueDay,
    amountType: 'dynamic',
    billType,
    kind: billType,
    category: billType === 'subscription' ? CATEGORY_SUBSCRIPTIONS : CATEGORY_BILLS,
    isStaticAmount: false,
    autoPostEnabled: false,
    isAutoPost: false,
    isAutoDraft: false,
    isActive: bill.isActive !== undefined ? bill.isActive : true,
    lastPaidDate: bill.lastPaidDate || null,
    lastPaidAmountCents: bill.lastPaidAmountCents || null,
    lastPaidMonth: bill.lastPaidMonth || null,
    defaultAccountKey: bill.defaultAccountKey || defaultAccountKey,
    createdAt: bill.createdAt || Date.now(),
  };
}

function upgradeBucketIfNeeded(bucket) {
  const { type, canonicalLabel, ...rest } = bucket || {};
  const name = canonicalCategoryLabel(rest.name || rest.label || type || canonicalLabel || 'Category');
  const scope = rest.scope || rest.profile || 'all';
  return {
    ...rest,
    id: rest.id || `bucket_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    label: name,
    scope,
    profile: rest.profile || (scope === 'all' ? null : scope),
    isActive: rest.isActive !== false,
  };
}

function auditSpendingBucketsForDefaults(buckets = []) {
  const now = Date.now();
  const byKey = new Map();

  (buckets || []).forEach((bucket) => {
    const upgraded = upgradeBucketIfNeeded(bucket);
    const name = canonicalCategoryLabel(upgraded.name || upgraded.label);
    const scope = upgraded.scope || upgraded.profile || 'all';
    const auditedBefore = upgraded.categoryDefaultsAudited === true;
    const isStatic = isAutoActiveSpendingCategory(name);
    const isLegacyStaticGrocery = categoryKey(name) === categoryKey(CATEGORY_GROCERIES) &&
      String(upgraded.id || '').startsWith('bucket_static_');
    const shouldDeactivate = isLegacyStaticGrocery || (!auditedBefore && !isStatic && isKnownPresetSpendingCategory(name));
    const audited = {
      ...upgraded,
      name,
      label: name,
      scope,
      profile: upgraded.profile || (scope === 'all' ? null : scope),
      isActive: shouldDeactivate ? false : auditedBefore ? upgraded.isActive !== false : upgraded.isActive !== false,
      categoryDefaultsAudited: true,
    };
    const key = `${scope}:${categoryKey(name)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, audited);
    } else {
      byKey.set(key, {
        ...existing,
        isActive: existing.isActive !== false || audited.isActive !== false,
        categoryDefaultsAudited: true,
      });
    }
  });

  AUTO_ACTIVE_SPENDING_CATEGORIES.forEach((name) => {
    const key = `all:${categoryKey(name)}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: `bucket_static_${categoryKey(name).replace(/[^a-z0-9]+/g, '_')}`,
        name,
        label: name,
        scope: 'all',
        profile: null,
        isActive: true,
        categoryDefaultsAudited: true,
        createdAt: now,
      });
    }
  });

  return Array.from(byKey.values());
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
      groceryHistory,
      personalGroceryBudget,
      personalGroceryHistory,
      transactions,
      recurringTransactions,
      irsRatePerMile,
      xpTotal,
      xpHistory,
      badges,
      confirmStreak,
      lastConfirmDate,
      currentFlavorText,
      currentNovaState,
      currentNovaFace,
      lastNovaStateAt,
      lastActivityAt,
      autoExportSchedule,
      schemaVersion,
      varianceConfig,
      lastCycleResetMonth,
      groceryEntries,
      personalGroceryEntries,
      groceryStreakWeeks,
      genericBusinessIncome,
      genericBusinessExpenses,
      genericBusinessMileage,
      postPaydayActions,
      novaConfig,
      groceryDisciplineStreak,
      accountRegistry,
      businesses,
      spendingBuckets,
      dashboardCardOrder,
      personalCardOrder,
      householdCardOrder,
      businessCardOrder,
      dashboardHiddenCards,
      personalHiddenCards,
      householdHiddenCards,
      businessHiddenCards,
      groceryReserveOn,
      importCategoryRules,
      reconciliationHistory,
      actionCounts,
      streakData,
      badgeState,
      pendingUnlocks,
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
      loadKey(KEYS.groceryHistory, initialState.groceryHistory),
      loadKey(KEYS.personalGroceryBudget, initialState.personalGroceryBudget),
      loadKey(KEYS.personalGroceryHistory, initialState.personalGroceryHistory),
      loadKey(KEYS.transactions, initialState.transactions),
      loadKey(KEYS.recurringTransactions, initialState.recurringTransactions),
      loadKey(KEYS.irsRatePerMile, initialState.irsRatePerMile),
      loadKey(KEYS.xpTotal, initialState.xpTotal),
      loadKey(KEYS.xpHistory, initialState.xpHistory),
      loadKey(KEYS.badges, initialState.badges),
      loadKey(KEYS.confirmStreak, initialState.confirmStreak),
      loadKey(KEYS.lastConfirmDate, initialState.lastConfirmDate),
      loadKey(KEYS.currentFlavorText, initialState.currentFlavorText),
      loadKey(KEYS.currentNovaState, initialState.currentNovaState),
      loadKey(KEYS.currentNovaFace, initialState.currentNovaFace),
      loadKey(KEYS.lastNovaStateAt, initialState.lastNovaStateAt),
      loadKey(KEYS.lastActivityAt, initialState.lastActivityAt),
      loadKey(KEYS.autoExportSchedule, initialState.autoExportSchedule),
      loadKey(KEYS.schemaVersion, initialState.schemaVersion),
      loadKey(KEYS.VARIANCE_CONFIG, initialState.varianceConfig),
      loadKey(KEYS.LAST_CYCLE_RESET_MONTH, initialState.lastCycleResetMonth),
      loadKey(KEYS.groceryEntries, initialState.groceryEntries),
      loadKey(KEYS.personalGroceryEntries, initialState.personalGroceryEntries),
      loadKey(KEYS.groceryStreakWeeks, initialState.groceryStreakWeeks),
      loadKey(KEYS.genericBusinessIncome, initialState.genericBusinessIncome),
      loadKey(KEYS.genericBusinessExpenses, initialState.genericBusinessExpenses),
      loadKey(KEYS.genericBusinessMileage, initialState.genericBusinessMileage),
      loadKey(KEYS.postPaydayActions, initialState.postPaydayActions),
      loadKey(KEYS.novaConfig, initialState.novaConfig),
      loadKey(KEYS.groceryDisciplineStreak, initialState.groceryDisciplineStreak),
      loadKey(KEYS.accountRegistry, initialState.accountRegistry),
      loadKey(KEYS.businesses, initialState.businesses),
      loadKey(KEYS.spendingBuckets, initialState.spendingBuckets),
      loadKey(KEYS.dashboardCardOrder, initialState.dashboardCardOrder),
      loadKey(KEYS.personalCardOrder, initialState.personalCardOrder),
      loadKey(KEYS.householdCardOrder, initialState.householdCardOrder),
      loadKey(KEYS.businessCardOrder, initialState.businessCardOrder),
      loadKey(KEYS.dashboardHiddenCards, initialState.dashboardHiddenCards),
      loadKey(KEYS.personalHiddenCards, initialState.personalHiddenCards),
      loadKey(KEYS.householdHiddenCards, initialState.householdHiddenCards),
      loadKey(KEYS.businessHiddenCards, initialState.businessHiddenCards),
      loadKey(KEYS.groceryReserveOn, initialState.groceryReserveOn),
      loadKey(KEYS.importCategoryRules, initialState.importCategoryRules),
      loadKey(KEYS.reconciliationHistory, initialState.reconciliationHistory),
      loadKey(KEYS.actionCounts, initialState.actionCounts),
      loadKey(KEYS.streakData, initialState.streakData),
      loadKey(KEYS.badgeState, initialState.badgeState),
      loadKey(KEYS.pendingUnlocks, initialState.pendingUnlocks),
    ]);

    // Migrate old partnerDepositReceived boolean to partnerDepositLastReceivedMonth
    const migratedIncomeEvents = { ...initialState.incomeEvents, ...incomeEvents };
    if ('partnerDepositReceived' in migratedIncomeEvents) {
      delete migratedIncomeEvents.partnerDepositReceived;
    }
    if (!('partnerDepositLastReceivedMonth' in migratedIncomeEvents)) {
      migratedIncomeEvents.partnerDepositLastReceivedMonth = null;
    }
    if (!Array.isArray(migratedIncomeEvents.scheduledIncomeEvents)) {
      migratedIncomeEvents.scheduledIncomeEvents = [];
    }
    const legacyPartnerAmount = migratedIncomeEvents.partnerDepositAmountCents ?? migratedIncomeEvents.partnerDepositAmount ?? 0;
    if (
      legacyPartnerAmount > 0 &&
      migratedIncomeEvents.scheduledIncomeEvents.length === 0 &&
      !migratedIncomeEvents.partnerDepositMigrated
    ) {
      migratedIncomeEvents.scheduledIncomeEvents = [{
        id: `income_partner_migrated_${Date.now()}`,
        label: 'Imported contribution',
        amountCents: legacyPartnerAmount,
        frequency: 'monthly',
        dayOfMonth: 31,
        accountKey: null,
        isActive: true,
        lastReceivedCycle: migratedIncomeEvents.partnerDepositLastReceivedMonth || null,
        createdAt: Date.now(),
      }];
      migratedIncomeEvents.partnerDepositMigrated = true;
    }

    // Migrate bills to V1.2 schema (idempotent — no-op for already-upgraded bills)
    const upgradedHouseholdBills = householdBills.map(b => upgradeBillIfNeeded(b, 'jointChecking', 'bill'));
    const upgradedPersonalBills = personalBills.map(b => upgradeBillIfNeeded(b, 'entChecking', 'subscription'));
    const upgradedSpendingBuckets = auditSpendingBucketsForDefaults(spendingBuckets || []);
    const resolvedDashboardCardOrder = (() => {
      if (!Array.isArray(dashboardCardOrder) || dashboardCardOrder.length === 0) return DEFAULT_DASHBOARD_CARD_ORDER;
      const rest = normalizeCardOrderIds(dashboardCardOrder).filter((id) => DASHBOARD_CARD_IDS.has(id));
      const missing = DEFAULT_DASHBOARD_CARD_ORDER.filter((id) => !rest.includes(id));
      return [...rest, ...missing];
    })();
    const resolvedPersonalCardOrder = (() => {
      if (!Array.isArray(personalCardOrder) || personalCardOrder.length === 0) return DEFAULT_PERSONAL_CARD_ORDER;
      const rest = normalizeCardOrderIds(personalCardOrder).filter((id) => PERSONAL_CARD_IDS.has(id));
      const missing = DEFAULT_PERSONAL_CARD_ORDER.filter((id) => !rest.includes(id));
      return [...rest, ...missing];
    })();
    const resolvedHouseholdCardOrder = (() => {
      if (!Array.isArray(householdCardOrder) || householdCardOrder.length === 0) return DEFAULT_HOUSEHOLD_CARD_ORDER;
      const rest = normalizeCardOrderIds(householdCardOrder).filter((id) => HOUSEHOLD_CARD_IDS.has(id));
      const missing = DEFAULT_HOUSEHOLD_CARD_ORDER.filter((id) => !rest.includes(id));
      return [...rest, ...missing];
    })();
    const resolvedBusinessCardOrder = (() => {
      if (!Array.isArray(businessCardOrder) || businessCardOrder.length === 0) return DEFAULT_BUSINESS_CARD_ORDER;
      const rest = normalizeCardOrderIds(businessCardOrder).filter((id) => BUSINESS_CARD_IDS.has(id));
      const missing = DEFAULT_BUSINESS_CARD_ORDER.filter((id) => !rest.includes(id));
      return [...rest, ...missing];
    })();

    // Merge novaConfig with defaults so new fields are always present
    const resolvedSavingsGoals = normalizeSavingsGoals(novaConfig?.savingsGoals, novaConfig?.savingsGoal);
    const mergedNovaConfig = {
      ...initialState.novaConfig,
      ...novaConfig,
      savingsGoals: resolvedSavingsGoals,
      savingsGoal: resolvedSavingsGoals[0] || initialState.novaConfig.savingsGoal,
      widgetSettings: {
        ...initialState.novaConfig.widgetSettings,
        ...(novaConfig?.widgetSettings || {}),
      },
      appLock: {
        ...initialState.novaConfig.appLock,
        ...(novaConfig?.appLock || {}),
      },
    };
    const resolvedDashboardHiddenCards = Array.isArray(dashboardHiddenCards) ? dashboardHiddenCards : initialState.dashboardHiddenCards;
    let resolvedPersonalHiddenCards = Array.isArray(personalHiddenCards) ? personalHiddenCards : initialState.personalHiddenCards;
    let resolvedHouseholdHiddenCards = Array.isArray(householdHiddenCards) ? householdHiddenCards : initialState.householdHiddenCards;
    const resolvedBusinessHiddenCards = Array.isArray(businessHiddenCards) ? businessHiddenCards : initialState.businessHiddenCards;
    if (!mergedNovaConfig.receiptCardsSeeded) {
      resolvedPersonalHiddenCards = [...new Set([...resolvedPersonalHiddenCards, RECEIPT_CARD_ID])];
      resolvedHouseholdHiddenCards = [...new Set([...resolvedHouseholdHiddenCards, RECEIPT_CARD_ID])];
      mergedNovaConfig.receiptCardsSeeded = true;
    }
    const resolvedGroceryBudget = { ...initialState.groceryBudget, ...(groceryBudget || {}) };
    const resolvedGroceryHistory = Array.isArray(groceryHistory) ? groceryHistory : [];
    const resolvedGroceryEntries = Array.isArray(groceryEntries) ? groceryEntries : [];
    const loadedPersonalGroceryBudget = { ...initialState.personalGroceryBudget, ...(personalGroceryBudget || {}) };
    const loadedPersonalGroceryHistory = Array.isArray(personalGroceryHistory) ? personalGroceryHistory : [];
    const loadedPersonalGroceryEntries = Array.isArray(personalGroceryEntries) ? personalGroceryEntries : [];
    const hasLoadedPersonalGrocery = (loadedPersonalGroceryBudget.weeklyLimit || 0) > 0
      || loadedPersonalGroceryEntries.length > 0
      || loadedPersonalGroceryHistory.length > 0;
    const shouldSeedPersonalGrocery = mergedNovaConfig.userMode === 'solo'
      && !hasLoadedPersonalGrocery
      && ((resolvedGroceryBudget.weeklyLimit || 0) > 0 || resolvedGroceryEntries.length > 0 || resolvedGroceryHistory.length > 0);
    const resolvedPersonalGroceryBudget = shouldSeedPersonalGrocery ? resolvedGroceryBudget : loadedPersonalGroceryBudget;
    const resolvedPersonalGroceryHistory = shouldSeedPersonalGrocery ? resolvedGroceryHistory : loadedPersonalGroceryHistory;
    const resolvedPersonalGroceryEntries = shouldSeedPersonalGrocery
      ? resolvedGroceryEntries.map(entry => ({ ...entry, scope: 'personal' }))
      : loadedPersonalGroceryEntries;

    // Registry migration — runs once for legacy users who completed onboarding before the registry existed.
    // Guard: only run when onboarding is already complete (existing user) and registry is empty.
    // New wizard users have onboardingComplete=false at initStore time, so this never fires for them.
    // registrySeeded prevents re-firing if a wizard user skipped accounts (leaving registry empty).
    let finalAccountRegistry = Array.isArray(accountRegistry) ? accountRegistry : [];
    let finalBusinesses = Array.isArray(businesses) ? businesses : [];
    let finalGenericBusinessIncome = Array.isArray(genericBusinessIncome) ? genericBusinessIncome : [];
    let finalGenericBusinessExpenses = Array.isArray(genericBusinessExpenses) ? genericBusinessExpenses : [];
    let finalGenericBusinessMileage = Array.isArray(genericBusinessMileage) ? genericBusinessMileage : [];

    if (finalAccountRegistry.length === 0 && onboardingComplete && !mergedNovaConfig.registrySeeded) {
      const legacyAccountKeys = ['jointChecking', 'entChecking', 'entSavings', 'venmo', 'cash'];
      const hasLegacyAccountData = legacyAccountKeys.some(key => Object.prototype.hasOwnProperty.call(accounts || {}, key));
      if (hasLegacyAccountData) {
        const mNow = Date.now();
        finalAccountRegistry = [
          { id: 'acc_joint_checking',    legacyKey: 'jointChecking',    name: 'Joint Checking',    type: 'checking', role: 'household', isActive: true, createdAt: mNow },
          { id: 'acc_ent_checking',      legacyKey: 'entChecking',      name: 'Primary Checking',  type: 'checking', role: 'personal',  isActive: true, createdAt: mNow },
          { id: 'acc_ent_savings',       legacyKey: 'entSavings',       name: 'Savings',           type: 'savings',  role: 'personal',  isActive: true, createdAt: mNow },
          { id: 'acc_venmo',             legacyKey: 'venmo',            name: 'Digital Wallet',    type: 'digital',  role: 'personal',  isActive: true, createdAt: mNow },
          { id: 'acc_cash',              legacyKey: 'cash',             name: 'Cash',              type: 'cash',     role: 'personal',  isActive: true, createdAt: mNow },
        ];
        mergedNovaConfig.userMode = mergedNovaConfig.userMode || 'partnered';
        await AsyncStorage.setItem(KEYS.accountRegistry, JSON.stringify(finalAccountRegistry));
      }
      mergedNovaConfig.registrySeeded = true;
      await AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(mergedNovaConfig));
    }

    if (finalBusinesses.length === 0 && onboardingComplete && !mergedNovaConfig.businessRegistrySeeded) {
      finalBusinesses = [];
      mergedNovaConfig.businessRegistrySeeded = true;
      await Promise.all([
        AsyncStorage.setItem(KEYS.businesses, JSON.stringify(finalBusinesses)),
        AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(finalGenericBusinessIncome)),
        AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(finalGenericBusinessExpenses)),
        AsyncStorage.setItem(KEYS.genericBusinessMileage, JSON.stringify(finalGenericBusinessMileage)),
        AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(mergedNovaConfig)),
      ]);
    }

    set({
      onboardingComplete,
      accounts,
      accountFloors,
      householdBills: upgradedHouseholdBills,
      personalBills: upgradedPersonalBills,
      billOverrides,
      incomeEvents: migratedIncomeEvents,
      distribution,
      groceryBudget: resolvedGroceryBudget,
      groceryHistory: resolvedGroceryHistory,
      groceryEntries: resolvedGroceryEntries,
      personalGroceryBudget: resolvedPersonalGroceryBudget,
      personalGroceryHistory: resolvedPersonalGroceryHistory,
      personalGroceryEntries: resolvedPersonalGroceryEntries,
      transactions,
      recurringTransactions: Array.isArray(recurringTransactions)
        ? recurringTransactions.map(item => normalizeRecurringTransaction(item, item))
        : [],
      irsRatePerMile,
      xpTotal,
      xpHistory: Array.isArray(xpHistory) ? xpHistory : [],
      badges,
      confirmStreak,
      lastConfirmDate,
      currentFlavorText,
      currentNovaState,
      currentNovaFace,
      lastNovaStateAt,
      lastActivityAt,
      autoExportSchedule,
      schemaVersion,
      varianceConfig,
      lastCycleResetMonth,
      groceryStreakWeeks,
      genericBusinessIncome: finalGenericBusinessIncome,
      genericBusinessExpenses: finalGenericBusinessExpenses,
      genericBusinessMileage: finalGenericBusinessMileage,
      postPaydayActions,
      novaConfig: mergedNovaConfig,
      groceryDisciplineStreak,
      accountRegistry: finalAccountRegistry,
      businesses: finalBusinesses,
      spendingBuckets: upgradedSpendingBuckets,
      dashboardCardOrder: resolvedDashboardCardOrder,
      personalCardOrder: resolvedPersonalCardOrder,
      householdCardOrder: resolvedHouseholdCardOrder,
      businessCardOrder: resolvedBusinessCardOrder,
      dashboardHiddenCards: normalizeCardOrderIds(resolvedDashboardHiddenCards).filter((id) => DASHBOARD_CARD_IDS.has(id)),
      personalHiddenCards: normalizeCardOrderIds(resolvedPersonalHiddenCards).filter((id) => PERSONAL_CARD_IDS.has(id)),
      householdHiddenCards: normalizeCardOrderIds(resolvedHouseholdHiddenCards).filter((id) => HOUSEHOLD_CARD_IDS.has(id)),
      businessHiddenCards: normalizeCardOrderIds(resolvedBusinessHiddenCards).filter((id) => BUSINESS_CARD_IDS.has(id)),
      groceryReserveOn: typeof groceryReserveOn === 'boolean' ? groceryReserveOn : true,
      importCategoryRules: Array.isArray(importCategoryRules) ? importCategoryRules : [],
      reconciliationHistory: sortReconciliations(
        Array.isArray(reconciliationHistory)
          ? reconciliationHistory.map(item => normalizeReconciliationRecord(item, item))
          : [],
      ),
      actionCounts: {
        ...initialState.actionCounts,
        ...(actionCounts || {}),
        xpByCategory: { ...initialState.actionCounts.xpByCategory, ...((actionCounts || {}).xpByCategory || {}) },
      },
      streakData: {
        weeklyActive: { ...initialState.streakData.weeklyActive, ...(streakData?.weeklyActive || {}) },
        paydayStreak: { ...initialState.streakData.paydayStreak, ...(streakData?.paydayStreak || {}) },
        groceryStreak: { ...initialState.streakData.groceryStreak, ...(streakData?.groceryStreak || {}) },
      },
      badgeState: typeof badgeState === 'object' && badgeState ? badgeState : {},
      pendingUnlocks: Array.isArray(pendingUnlocks) ? pendingUnlocks : [],
    });
    await Promise.all([
      AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(upgradedHouseholdBills)),
      AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(upgradedPersonalBills)),
      AsyncStorage.setItem(KEYS.recurringTransactions, JSON.stringify(Array.isArray(recurringTransactions)
        ? recurringTransactions.map(item => normalizeRecurringTransaction(item, item))
        : [])),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(migratedIncomeEvents)),
      AsyncStorage.setItem(KEYS.spendingBuckets, JSON.stringify(upgradedSpendingBuckets)),
      AsyncStorage.setItem(KEYS.dashboardCardOrder, JSON.stringify(resolvedDashboardCardOrder)),
      AsyncStorage.setItem(KEYS.personalCardOrder, JSON.stringify(resolvedPersonalCardOrder)),
      AsyncStorage.setItem(KEYS.householdCardOrder, JSON.stringify(resolvedHouseholdCardOrder)),
      AsyncStorage.setItem(KEYS.businessCardOrder, JSON.stringify(resolvedBusinessCardOrder)),
      AsyncStorage.setItem(KEYS.dashboardHiddenCards, JSON.stringify(normalizeCardOrderIds(resolvedDashboardHiddenCards).filter((id) => DASHBOARD_CARD_IDS.has(id)))),
      AsyncStorage.setItem(KEYS.personalHiddenCards, JSON.stringify(normalizeCardOrderIds(resolvedPersonalHiddenCards).filter((id) => PERSONAL_CARD_IDS.has(id)))),
      AsyncStorage.setItem(KEYS.householdHiddenCards, JSON.stringify(normalizeCardOrderIds(resolvedHouseholdHiddenCards).filter((id) => HOUSEHOLD_CARD_IDS.has(id)))),
      AsyncStorage.setItem(KEYS.businessHiddenCards, JSON.stringify(normalizeCardOrderIds(resolvedBusinessHiddenCards).filter((id) => BUSINESS_CARD_IDS.has(id)))),
      AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(mergedNovaConfig)),
      AsyncStorage.setItem(KEYS.importCategoryRules, JSON.stringify(Array.isArray(importCategoryRules) ? importCategoryRules : [])),
      AsyncStorage.setItem(KEYS.reconciliationHistory, JSON.stringify(sortReconciliations(
        Array.isArray(reconciliationHistory)
          ? reconciliationHistory.map(item => normalizeReconciliationRecord(item, item))
          : [],
      ))),
      AsyncStorage.setItem(KEYS.personalGroceryBudget, JSON.stringify(resolvedPersonalGroceryBudget)),
      AsyncStorage.setItem(KEYS.personalGroceryHistory, JSON.stringify(resolvedPersonalGroceryHistory)),
      AsyncStorage.setItem(KEYS.personalGroceryEntries, JSON.stringify(resolvedPersonalGroceryEntries)),
    ]);
  },

  setOnboardingComplete: async () => {
    set({ onboardingComplete: true });
    await AsyncStorage.setItem(KEYS.onboardingComplete, JSON.stringify(true));
    get().awardXP('ONBOARDING_COMPLETE');
    get().rotateFlavorTextForEvent('onboarding_complete');
  },

  updateAccountBalance: async (key, cents) => {
    const state = get();
    const previousBalanceCents = state.accounts[key] || 0;
    const nextBalanceCents = Math.floor(cents);
    const savingsKeys = getSavingsAccountKeys(state);
    const accounts = { ...state.accounts, [key]: nextBalanceCents };
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
    const balanceDeltaCents = nextBalanceCents - previousBalanceCents;
    const balanceEventType = savingsKeys.includes(key) && balanceDeltaCents < 0
      ? 'savings_withdrawal'
      : savingsKeys.includes(key) && balanceDeltaCents > 0
        ? 'savings_deposit'
        : balanceDeltaCents >= 0
          ? 'balance_adjustment_up'
          : 'balance_adjustment_down';
    get().rotateFlavorTextForEvent(balanceEventType, {
      accountKey: key,
      previousBalanceCents,
      nextBalanceCents,
      amountCents: balanceDeltaCents,
      isSavingsAccount: savingsKeys.includes(key),
      isSavingsWithdrawal: savingsKeys.includes(key) && nextBalanceCents < previousBalanceCents,
    });
  },

  reconcileAccount: async ({
    accountKey,
    asOfDate,
    bankBalanceCents,
    note = '',
    updateBalance = false,
  } = {}) => {
    const state = get();
    if (!accountKey || !Object.prototype.hasOwnProperty.call(state.accounts || {}, accountKey)) {
      throw new Error('Choose an account to reconcile.');
    }
    const now = Date.now();
    const account = (state.accountRegistry || []).find(item => item && (item.id === accountKey || item.legacyKey === accountKey));
    const novaBalanceCents = Math.trunc(Number(state.accounts?.[accountKey] || 0));
    const cleanBankBalanceCents = Math.trunc(Number(bankBalanceCents || 0));
    const differenceCents = cleanBankBalanceCents - novaBalanceCents;
    const adjustedBalance = !!updateBalance && differenceCents !== 0;
    const record = normalizeReconciliationRecord({
      accountKey,
      accountName: account?.name || accountKey,
      accountRole: account?.role || null,
      asOfDate,
      bankBalanceCents: cleanBankBalanceCents,
      novaBalanceCents,
      differenceCents,
      adjustedBalance,
      resultingBalanceCents: adjustedBalance ? cleanBankBalanceCents : novaBalanceCents,
      note,
      reconciledAt: now,
    });
    const reconciliationHistory = sortReconciliations([record, ...(state.reconciliationHistory || [])]);
    const accounts = adjustedBalance
      ? { ...state.accounts, [accountKey]: cleanBankBalanceCents }
      : state.accounts;
    set({ reconciliationHistory, accounts, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.reconciliationHistory, JSON.stringify(reconciliationHistory)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
      ...(adjustedBalance ? [AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accounts))] : []),
    ]);
    if (adjustedBalance) {
      get().checkAndAwardBadge('comma_club');
      get().recomputeVariance();
    }
    get().rotateFlavorTextForEvent?.('settings_saved');
    return record;
  },

  logTransaction: async ({
    accountKey,
    amountCents,
    category,
    description,
    paymentMethod,
    timestamp,
    source,
    sourceType,
    sourceId,
    businessId,
    groceryScope,
    receiptAttachments,
    splitGroupId,
    splitPart,
    splitTotalParts,
    splitTotalCents,
    splitParentDescription,
  }) => {
    const { accounts, transactions } = get();
    const now = Date.now();
    const amt = Math.floor(amountCents);
    const previousBalanceCents = accountKey ? (accounts[accountKey] || 0) : 0;
    const nextBalanceCents = previousBalanceCents + amt;
    const savingsKeys = getSavingsAccountKeys(get());
    const receiptFields = receiptFieldsForRecord({ receiptAttachments });
    const newTx = {
      id: now.toString() + Math.random().toString(36).slice(2, 6),
      accountKey,
      amountCents: amt,
      category,
      description,
      paymentMethod,
      timestamp: timestamp || now,
      source,
      sourceType,
      sourceId,
      businessId,
      groceryScope,
      splitGroupId,
      splitPart,
      splitTotalParts,
      splitTotalCents,
      splitParentDescription,
      previousBalanceCents,
      nextBalanceCents,
      ...receiptFields,
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
    get().awardXP('ADD_TRANSACTION');
    get().checkAndAwardBadge('first_log');
    get().checkAndAwardBadge('comma_club');
    // Auto-complete post-payday actions when matching transfer is logged
    if (amt > 0) {
      const openActions = (get().postPaydayActions || []).filter(a => !a.completed && Date.now() < a.expiresAt);
      for (const action of openActions) {
        if (action.type === 'income_split_confirm' && action.accountKey === accountKey) {
          get().completePostPaydayAction(action.id);
        }
      }
    }
    requestAutoExportForChange(amt);
    get().recomputeVariance();
    const groceryState = getScopedGroceryState(get(), groceryScope);
    const scopedGroceryBudget = groceryState.budget || {};
    const normalizedCategory = String(category || '').trim().toLowerCase();
    const transactionEventType = savingsKeys.includes(accountKey) && amt < 0
      ? 'savings_withdrawal'
      : savingsKeys.includes(accountKey) && amt > 0
        ? 'savings_deposit'
        : sourceType === 'grocery_spend'
          ? 'grocery_logged'
          : !normalizedCategory || normalizedCategory === 'uncategorized'
            ? 'transaction_uncategorized'
            : amt > 0
              ? 'transaction_income'
              : Math.abs(amt) >= 10000
                ? 'transaction_large_expense'
                : Math.abs(amt) <= 1000
                  ? 'transaction_tiny_expense'
                  : 'transaction_expense';
    get().rotateFlavorTextForEvent(transactionEventType, {
      accountKey,
      amountCents: amt,
      category,
      previousBalanceCents,
      nextBalanceCents,
      isSavingsAccount: savingsKeys.includes(accountKey),
      isSavingsWithdrawal: savingsKeys.includes(accountKey) && amt < 0,
      groceryLimitExceeded: String(category || '').toLowerCase() === 'grocery'
        && scopedGroceryBudget.weeklyLimit > 0
        && (scopedGroceryBudget.currentWeekSpend || 0) > scopedGroceryBudget.weeklyLimit,
    });
    return newTx;
  },

  addRecurringTransaction: async (input = {}) => {
    const item = normalizeRecurringTransaction(input);
    if (!item.title || !item.accountKey || item.amountCents <= 0) return null;
    const recurringTransactions = [...(get().recurringTransactions || []), item];
    set({ recurringTransactions });
    await AsyncStorage.setItem(KEYS.recurringTransactions, JSON.stringify(recurringTransactions));
    return item;
  },

  editRecurringTransaction: async (id, updates = {}) => {
    const current = get().recurringTransactions || [];
    const existing = current.find(item => item.id === id);
    if (!existing) return null;
    const updated = normalizeRecurringTransaction({ ...existing, ...updates, id }, existing);
    if (!updated.title || !updated.accountKey || updated.amountCents <= 0) return null;
    const recurringTransactions = current.map(item => item.id === id ? updated : item);
    set({ recurringTransactions });
    await AsyncStorage.setItem(KEYS.recurringTransactions, JSON.stringify(recurringTransactions));
    return updated;
  },

  deleteRecurringTransaction: async (id) => {
    const recurringTransactions = (get().recurringTransactions || []).map(item =>
      item.id === id ? { ...item, isActive: false, deleted: true, updatedAt: Date.now() } : item
    );
    set({ recurringTransactions });
    await AsyncStorage.setItem(KEYS.recurringTransactions, JSON.stringify(recurringTransactions));
  },

  completeRecurringTransaction: async (id, options = {}) => {
    const current = get().recurringTransactions || [];
    const item = current.find(entry => entry.id === id && !entry.deleted);
    if (!item) return null;
    const completedDate = options.completedDate || item.nextDueDate || Date.now();
    const completedMs = getRecordDateMs({ date: completedDate });
    let tx = null;

    if (options.logTransaction !== false) {
      const amountCents = Math.max(0, Math.floor(options.amountCents ?? item.amountCents ?? 0));
      const signedAmountCents = item.direction === 'income' ? amountCents : -amountCents;
      if (item.accountKey && amountCents > 0) {
        tx = await get().logTransaction({
          accountKey: options.accountKey || item.accountKey,
          amountCents: signedAmountCents,
          category: options.category || item.category || (item.direction === 'income' ? 'Income' : CATEGORY_UNCATEGORIZED),
          description: options.description || item.title,
          timestamp: completedMs,
          source: 'recurring_transaction',
          sourceType: 'recurring_transaction',
          sourceId: item.id,
        });
      }
    }

    const latest = get().recurringTransactions || [];
    const nextDueDate = localDateKey(getNextRecurringDate(item, completedMs));
    const recurringTransactions = latest.map(entry => entry.id === id ? {
      ...entry,
      nextDueDate,
      lastCompletedAt: Date.now(),
      lastCompletedDate: localDateKey(completedMs),
      lastCompletedTransactionId: tx?.id || entry.lastCompletedTransactionId || null,
      updatedAt: Date.now(),
    } : entry);
    set({ recurringTransactions });
    await AsyncStorage.setItem(KEYS.recurringTransactions, JSON.stringify(recurringTransactions));
    return tx;
  },

  addReceiptAttachmentToTransaction: async (txId, attachment) => {
    const state = get();
    const { transactions, genericBusinessIncome, genericBusinessExpenses } = state;
    const tx = (transactions || []).find(t => t.id === txId && !t.deleted);
    if (!tx || !attachment) return null;
    const attachments = normalizeReceiptAttachments([...getReceiptAttachments(tx), attachment]);
    const updatedTransactions = (transactions || []).map(item =>
      item.id === txId ? withReceiptAttachments(item, attachments) : item
    );
    const nextState = { transactions: updatedTransactions };
    const saves = [AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions))];

    if (tx.source === 'business' || tx.businessId) {
      const updatedIncome = updateRecordReceipts(genericBusinessIncome, tx.sourceId, tx.id, attachments);
      const updatedExpenses = updateRecordReceipts(genericBusinessExpenses, tx.sourceId, tx.id, attachments);
      if (updatedIncome) {
        nextState.genericBusinessIncome = updatedIncome;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(updatedIncome)));
      }
      if (updatedExpenses) {
        nextState.genericBusinessExpenses = updatedExpenses;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(updatedExpenses)));
      }
    }

    set(nextState);
    await Promise.all(saves);
    requestAutoExportForChange();
    return updatedTransactions.find(item => item.id === txId) || null;
  },

  removeReceiptAttachmentFromTransaction: async (txId, attachmentId) => {
    const state = get();
    const { transactions, genericBusinessIncome, genericBusinessExpenses } = state;
    const tx = (transactions || []).find(t => t.id === txId && !t.deleted);
    if (!tx || !attachmentId) return null;
    const attachments = getReceiptAttachments(tx).filter(item =>
      item.id !== attachmentId && item.uri !== attachmentId && item.fileName !== attachmentId
    );
    const updatedTransactions = (transactions || []).map(item =>
      item.id === txId ? withReceiptAttachments(item, attachments) : item
    );
    const nextState = { transactions: updatedTransactions };
    const saves = [AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions))];

    if (tx.source === 'business' || tx.businessId) {
      const updatedIncome = updateRecordReceipts(genericBusinessIncome, tx.sourceId, tx.id, attachments);
      const updatedExpenses = updateRecordReceipts(genericBusinessExpenses, tx.sourceId, tx.id, attachments);
      if (updatedIncome) {
        nextState.genericBusinessIncome = updatedIncome;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(updatedIncome)));
      }
      if (updatedExpenses) {
        nextState.genericBusinessExpenses = updatedExpenses;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(updatedExpenses)));
      }
    }

    set(nextState);
    await Promise.all(saves);
    requestAutoExportForChange();
    return updatedTransactions.find(item => item.id === txId) || null;
  },

  upsertImportCategoryRules: async (rules = []) => {
    const importCategoryRules = mergeImportCategoryRules(get().importCategoryRules, rules);
    set({ importCategoryRules });
    await AsyncStorage.setItem(KEYS.importCategoryRules, JSON.stringify(importCategoryRules));
    return importCategoryRules;
  },

  importStatementTransactions: async ({
    accountKey,
    rows = [],
    fileName = '',
    format = 'statement',
    learnRules = true,
  } = {}) => {
    const state = get();
    if (!accountKey || !accountKeyExists(state, accountKey)) return { imported: 0 };
    const cleanRows = (rows || [])
      .filter(row => row && !row.deleted && !row.duplicate && row.amountCents && row.timestamp)
      .map(row => ({
        ...row,
        category: canonicalCategoryLabel(row.category || CATEGORY_UNCATEGORIZED),
        description: String(row.description || row.rawDescription || 'Imported transaction').trim() || 'Imported transaction',
      }));
    if (cleanRows.length === 0) return { imported: 0 };

    const now = Date.now();
    const sortedRows = [...cleanRows].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    let nextBalance = state.accounts[accountKey] || 0;
    const newTransactions = sortedRows.map((row, index) => {
      const previousBalanceCents = nextBalance;
      nextBalance += Math.trunc(row.amountCents || 0);
      return {
        id: `statement_${now}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        accountKey,
        amountCents: Math.trunc(row.amountCents || 0),
        category: row.category,
        description: row.description,
        paymentMethod: row.transactionType || null,
        timestamp: row.timestamp,
        source: 'statement_import',
        sourceType: `statement_${row.format || format}`,
        sourceId: row.externalId || row.importFingerprint || null,
        previousBalanceCents,
        nextBalanceCents: nextBalance,
        importFileName: fileName,
        importFormat: row.format || format,
        importExternalId: row.externalId || null,
        importFingerprint: row.importFingerprint || null,
        importRawDescription: row.rawDescription || row.description,
        importMemo: row.memo || null,
        importPayee: row.payee || null,
        importCheckNumber: row.checkNumber || null,
        importSuggestedByRule: row.suggestedByRule || null,
        statementBalanceCents: row.balanceCents ?? null,
        importedAt: now,
      };
    });

    const updatedAccounts = { ...state.accounts, [accountKey]: nextBalance };
    const accountRole = getAccountRoleForKey(state, accountKey);
    const bucketScope = accountRole || 'personal';
    const existingCategoryKeys = new Set((state.spendingBuckets || []).map(bucket =>
      `${bucket.scope || bucket.profile || 'all'}:${categoryKey(bucket.name || bucket.label)}`
    ));
    const newBuckets = [];
    sortedRows.forEach(row => {
      const label = canonicalCategoryLabel(row.category || CATEGORY_UNCATEGORIZED);
      const key = categoryKey(label);
      if (!key || key === categoryKey(CATEGORY_UNCATEGORIZED) || key === 'income') return;
      const scopedKey = `${bucketScope}:${key}`;
      const allKey = `all:${key}`;
      if (existingCategoryKeys.has(scopedKey) || existingCategoryKeys.has(allKey)) return;
      existingCategoryKeys.add(scopedKey);
      newBuckets.push({
        id: `bucket_import_${key}_${now}_${newBuckets.length}`,
        name: label,
        label,
        scope: bucketScope,
        profile: bucketScope,
        isActive: true,
        categoryDefaultsAudited: true,
        createdAt: now,
      });
    });

    const transactions = [...(state.transactions || []), ...newTransactions];
    const spendingBuckets = newBuckets.length > 0
      ? [...(state.spendingBuckets || []), ...newBuckets]
      : state.spendingBuckets;
    let importCategoryRules = state.importCategoryRules || [];
    if (learnRules) {
      importCategoryRules = mergeImportCategoryRules(importCategoryRules, buildCategoryRulesFromRows(sortedRows));
    }

    set({
      accounts: updatedAccounts,
      transactions,
      spendingBuckets,
      importCategoryRules,
      lastActivityAt: now,
    });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(transactions)),
      AsyncStorage.setItem(KEYS.spendingBuckets, JSON.stringify(spendingBuckets)),
      AsyncStorage.setItem(KEYS.importCategoryRules, JSON.stringify(importCategoryRules)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().checkSpendingFloors();
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('import_complete', { importedCount: newTransactions.length });
    return { imported: newTransactions.length, skipped: (rows || []).length - newTransactions.length };
  },

  rotateFlavorTextForEvent: (eventType, context = {}) => {
    const payload = getNovaStatePayload(eventType, get(), context);
    get().setNovaState(payload);
  },

  distributePaycheck: async (grossAmountCents, splitOverrides) => {
    const { accounts, incomeEvents, transactions, novaConfig } = get();
    const now = Date.now();
    const gross = Math.floor(grossAmountCents);
    const previousMaxBalanceCents = Math.max(...Object.values(accounts).map(v => v || 0), 0);
    let accts = { ...accounts };
    const newTxs = [];
    let idx = 0;
    const mkId = () => `${now}_${++idx}`;

    const splits = splitOverrides || novaConfig?.paycheckSplits;

    if (splits && splits.length > 0) {
      for (const split of splits) {
        const amt = Math.floor(split.amountCents || 0);
        if (amt === 0) continue;
        const accountKey = split.accountKey || split.accountId;
        if (!accountKey) continue;
        split.accountKey = accountKey;
        accts[accountKey] = (accts[accountKey] || 0) + amt;
        newTxs.push({ id: mkId(), accountKey: split.accountKey, amountCents: amt, category: 'Income', description: `Income - ${split.label}`, timestamp: now });
      }
    } else {
      const fallbackAccountKey = getActiveAccountKeyForRole(get(), 'personal') || getFirstActiveAccountKey(get());
      if (!fallbackAccountKey) return;
      accts[fallbackAccountKey] = (accts[fallbackAccountKey] || 0) + gross;
      newTxs.push({ id: mkId(), accountKey: fallbackAccountKey, amountCents: gross, category: 'Income', description: 'Primary income', timestamp: now });
    }

    // Advance nextPaycheckDate by the correct frequency interval
    const currentNext = incomeEvents.nextPaycheckDate;
    const freq = incomeEvents.payFrequency || incomeEvents.paycheckFrequency || 'biweekly';
    let nextPaycheckDate;
    if (!currentNext || freq === 'unscheduled') {
      nextPaycheckDate = currentNext;
    } else if (freq === 'weekly') {
      nextPaycheckDate = currentNext + 7 * 24 * 60 * 60 * 1000;
    } else if (freq === 'monthly') {
      nextPaycheckDate = addMonthsClamped(currentNext, 1);
    } else {
      nextPaycheckDate = currentNext + 14 * 24 * 60 * 60 * 1000;
    }

    const updatedIncomeEvents = { ...incomeEvents, paycheckAmount: gross, paycheckAmountCents: gross, nextPaycheckDate };
    const updatedTransactions = [...transactions, ...newTxs];
    const nextMaxBalanceCents = Math.max(...Object.values(accts).map(v => v || 0), 0);

    set({ accounts: accts, transactions: updatedTransactions, incomeEvents: updatedIncomeEvents, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);

    const confirmType = classifyPaycheckConfirmation(now, currentNext);
    await get().awardXP(confirmType === 'on_time' ? 'PAYCHECK_CONFIRMED_SAME_DAY' : 'PAYCHECK_CONFIRMED');
    const { actionCounts: updatedActionCounts, streakData: updatedStreakData } = buildPaydayProgress(
      get().actionCounts,
      get().streakData,
      confirmType,
      now,
    );
    set({ actionCounts: updatedActionCounts, streakData: updatedStreakData });
    await Promise.all([
      AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedActionCounts)),
      AsyncStorage.setItem(KEYS.streakData, JSON.stringify(updatedStreakData)),
    ]);

    get().checkAndAwardBadge('comma_club');
    // Savings milestone check after paycheck distribution
    const savingsKeys = getSavingsAccountKeys(get());
    const prevSavingsMax = Math.max(...savingsKeys.map(key => accounts[key] || 0), 0);
    const newSavingsMax = Math.max(...savingsKeys.map(key => accts[key] || 0), 0);
    const prevSavingsThousands = Math.floor(prevSavingsMax / 100000);
    const newSavingsThousands = Math.floor(newSavingsMax / 100000);
    if (newSavingsThousands > prevSavingsThousands && newSavingsMax >= 100000) {
      const cfg = notificationsConfig.savingsMilestone;
      const amt = `$${newSavingsThousands.toLocaleString()},000`;
      scheduleLocalNotification('savings_milestone', cfg.title, cfg.body.replace('{amount}', amt), 5);
    }
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('rollover', {
      amountCents: gross,
      category: 'Income',
      previousBalanceCents: previousMaxBalanceCents,
      nextBalanceCents: nextMaxBalanceCents,
    });
    get().generatePostPaydayActions();
  },

  upsertScheduledIncomeEvent: async (event) => {
    const now = Date.now();
    const amountCents = Math.floor(event.amountCents || 0);
    const frequency = event.frequency || 'monthly';
    const dayOfMonth = Math.max(1, Math.min(31, parseInt(event.dayOfMonth, 10) || 1));
    const normalized = {
      ...event,
      id: event.id || `income_${now}`,
      label: String(event.label || 'Income').trim() || 'Income',
      amountCents,
      frequency,
      dayOfMonth,
      accountKey: event.accountKey || null,
      isActive: event.isActive !== false,
      createdAt: event.createdAt || now,
      updatedAt: now,
    };
    const incomeEvents = get().incomeEvents || {};
    const scheduled = Array.isArray(incomeEvents.scheduledIncomeEvents) ? incomeEvents.scheduledIncomeEvents : [];
    const exists = scheduled.some(item => item.id === normalized.id);
    const scheduledIncomeEvents = exists
      ? scheduled.map(item => item.id === normalized.id ? normalized : item)
      : [...scheduled, normalized];
    const updatedIncomeEvents = { ...incomeEvents, scheduledIncomeEvents };
    set({ incomeEvents: updatedIncomeEvents });
    await AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents));
    get().recomputeVariance();
  },

  removeScheduledIncomeEvent: async (id) => {
    const incomeEvents = get().incomeEvents || {};
    const scheduled = Array.isArray(incomeEvents.scheduledIncomeEvents) ? incomeEvents.scheduledIncomeEvents : [];
    const scheduledIncomeEvents = scheduled.map(event => event.id === id ? { ...event, isActive: false } : event);
    const updatedIncomeEvents = { ...incomeEvents, scheduledIncomeEvents };
    set({ incomeEvents: updatedIncomeEvents });
    await AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents));
    get().recomputeVariance();
  },

  recordScheduledIncomeEvent: async (eventId, amountOverrideCents = null) => {
    const { accounts, incomeEvents, transactions } = get();
    const scheduled = Array.isArray(incomeEvents?.scheduledIncomeEvents) ? incomeEvents.scheduledIncomeEvents : [];
    const event = scheduled.find(item => item.id === eventId && item.isActive !== false);
    if (!event) return;
    const now = Date.now();
    const amt = Math.floor(amountOverrideCents ?? event.amountCents ?? 0);
    if (amt <= 0) return;
    const currentDate = new Date();
    const currentCycle = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const accountKey = event.accountKey
      || getActiveAccountKeyForRole(get(), 'household')
      || getActiveAccountKeyForRole(get(), 'personal')
      || getFirstActiveAccountKey(get());
    if (!accountKey) return;
    const previousBalanceCents = accounts[accountKey] || 0;
    const nextBalanceCents = previousBalanceCents + amt;
    const updatedAccounts = { ...accounts, [accountKey]: nextBalanceCents };
    const newTx = {
      id: `${now}_${Math.random().toString(36).slice(2, 6)}`,
      accountKey,
      amountCents: amt,
      category: 'Income',
      description: event.label || 'Scheduled income',
      timestamp: now,
      previousBalanceCents,
      nextBalanceCents,
    };
    const updatedScheduled = scheduled.map(item => {
      if (item.id !== event.id) return item;
      let nextDate = item.nextDate || null;
      if (nextDate) {
        if (item.frequency === 'weekly') nextDate += 7 * 24 * 60 * 60 * 1000;
        else if (item.frequency === 'biweekly') nextDate += 14 * 24 * 60 * 60 * 1000;
        else if (item.frequency === 'monthly') nextDate = addMonthsClamped(nextDate, 1);
      }
      return {
        ...item,
        amountCents: amt,
        accountKey,
        nextDate,
        lastReceivedAt: now,
        lastReceivedCycle: currentCycle,
      };
    });
    const updatedTransactions = [...transactions, newTx];
    const updatedIncomeEvents = { ...incomeEvents, scheduledIncomeEvents: updatedScheduled };
    set({ accounts: updatedAccounts, transactions: updatedTransactions, incomeEvents: updatedIncomeEvents, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(updatedIncomeEvents)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    // Classify confirmation timing and award XP
    const confirmType = classifyPaycheckConfirmation(now, event.nextDate);
    await get().awardXP(confirmType === 'on_time' ? 'PAYCHECK_CONFIRMED_SAME_DAY' : 'PAYCHECK_CONFIRMED');

    // Update action counters and payday streak
    const prevAC = get().actionCounts;
    const prevSD = get().streakData;
    const ps = prevSD.paydayStreak;
    const recentWindow = (ps.recentPaychecks || []).slice(-6);
    const graceUsedInWindow = recentWindow.filter(p => p.usedGrace).length;

    let newCurrent = ps.current;
    let newConsecutiveOnTime = ps.consecutiveOnTime;
    let newConsecutiveMisses = ps.consecutiveMisses || 0;
    let usedGrace = false;

    if (confirmType === 'on_time') {
      newCurrent += 1;
      newConsecutiveOnTime += 1;
      newConsecutiveMisses = 0;
    } else if (confirmType === 'late') {
      newCurrent += 1;
      newConsecutiveOnTime = 0;
      newConsecutiveMisses = 0;
    } else {
      // missed — try grace
      if (graceUsedInWindow < 1) {
        usedGrace = true;
        // streak holds, misses reset
        newConsecutiveMisses = 0;
      } else {
        newConsecutiveMisses += 1;
        if (newConsecutiveMisses >= 2) {
          newCurrent = 0;
          newConsecutiveOnTime = 0;
          newConsecutiveMisses = 0;
        }
      }
    }

    const paycheckEntry = { timestamp: now, confirmType, usedGrace };
    const recentPaychecks = [...recentWindow, paycheckEntry].slice(-6);

    const updatedActionCounts = {
      ...prevAC,
      paycheckConfirmedTotal: prevAC.paycheckConfirmedTotal + 1,
      paycheckConfirmedSameDay: prevAC.paycheckConfirmedSameDay + (confirmType === 'on_time' ? 1 : 0),
    };
    const updatedStreakData = {
      ...prevSD,
      paydayStreak: {
        ...ps,
        current: newCurrent,
        consecutiveOnTime: newConsecutiveOnTime,
        consecutiveMisses: newConsecutiveMisses,
        recentPaychecks,
      },
    };
    set({ actionCounts: updatedActionCounts, streakData: updatedStreakData });
    await Promise.all([
      AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedActionCounts)),
      AsyncStorage.setItem(KEYS.streakData, JSON.stringify(updatedStreakData)),
    ]);

    get().recomputeVariance();
    get().rotateFlavorTextForEvent('scheduled_income', {
      accountKey,
      amountCents: amt,
      category: 'Income',
      previousBalanceCents,
      nextBalanceCents: updatedAccounts[accountKey] || 0,
    });
  },

  recordPartnerDeposit: async (amountCents) => {
    const { accounts, incomeEvents, transactions } = get();
    const now = Date.now();
    const amt = Math.floor(amountCents);
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const accountKey = getActiveAccountKeyForRole(get(), 'household') || getFirstActiveAccountKey(get());
    if (!accountKey) return;
    const previousBalanceCents = accounts[accountKey] || 0;

    const updatedAccounts = { ...accounts, [accountKey]: (accounts[accountKey] || 0) + amt };
    const newTx = {
      id: now.toString(),
      accountKey,
      amountCents: amt,
      category: 'Income',
      description: 'Imported contribution',
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
    get().awardXP('PARTNER_DEPOSIT_LOGGED');
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('partner_deposit', {
      accountKey,
      amountCents: amt,
      category: 'Income',
      previousBalanceCents,
      nextBalanceCents: updatedAccounts[accountKey] || 0,
    });
  },

  addHouseholdBill: async (input) => {
    const bill = normalizeBillForSave({
      ...input,
      id: `bill_${Date.now()}`,
      name: input.name,
      isActive: true,
      lastPaidDate: null,
      lastPaidAmountCents: null,
      lastPaidMonth: null,
      createdAt: Date.now(),
    }, getActiveAccountKeyForRole(get(), 'household'), null, 'bill');
    const householdBills = [...get().householdBills, bill];
    set({ householdBills });
    await AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(householdBills));
    get().recomputeVariance();
  },

  addPersonalBill: async (input) => {
    const bill = normalizeBillForSave({
      ...input,
      id: `bill_${Date.now()}`,
      name: input.name,
      isActive: true,
      lastPaidDate: null,
      lastPaidAmountCents: null,
      lastPaidMonth: null,
      createdAt: Date.now(),
    }, getActiveAccountKeyForRole(get(), 'personal'), null, 'subscription');
    const personalBills = [...get().personalBills, bill];
    set({ personalBills });
    await AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(personalBills));
    get().recomputeVariance();
  },

  markBillPaid: async (billId, { paidDate, paidAmountCents, accountKey, notes, autoPosted = false }) => {
    const { billOverrides, accounts, transactions, householdBills, personalBills } = get();
    const now = Date.now();

    const allBills = [...householdBills, ...personalBills];
    const bill = allBills.find(b => b.id === billId);
    if (!bill) return;

    const billProfile = (householdBills || []).some(b => b.id === billId)
      ? 'household'
      : (personalBills || []).some(b => b.id === billId)
        ? 'personal'
        : null;
    const profileAccountKey = billProfile ? getActiveAccountKeyForRole(get(), billProfile) : null;
    const resolvedAccountKey = accountKey || bill.defaultAccountKey || bill.accountKey || profileAccountKey || getFirstActiveAccountKey(get());
    if (!resolvedAccountKey) return;

    const paidDateObj = new Date(paidDate);
    const paidMonth = `${paidDateObj.getFullYear()}-${String(paidDateObj.getMonth() + 1).padStart(2, '0')}`;
    const billCategory = getBillSpendingCategory(bill) || SCHEDULED_BILL_CATEGORY;
    if (billOverrides[billId]?.lastPaidMonth === paidMonth || bill.lastPaidMonth === paidMonth) {
      get().rotateFlavorTextForEvent('bill_paid_on_time', {
        accountKey: resolvedAccountKey,
        amountCents: -Math.max(Math.floor(paidAmountCents || 0), getBillExpectedAmountCents(bill)),
        category: billCategory,
        alreadyPaid: true,
        autoPosted: billOverrides[billId]?.autoPosted || bill.lastPaidSource === 'auto_static',
      });
      return { alreadyPaid: true };
    }

    const amt = Math.floor(paidAmountCents);
    if (amt <= 0) return;
    const previousBalanceCents = accounts[resolvedAccountKey] || 0;
    const nextBalanceCents = previousBalanceCents - amt;
    const savingsKeys = getSavingsAccountKeys(get());

    const updatedOverrides = { ...billOverrides, [billId]: { lastPaidMonth: paidMonth, lastPaidAmountCents: amt, autoPosted } };
    const updatedAccounts = { ...accounts, [resolvedAccountKey]: nextBalanceCents };
    const newTx = {
      id: now.toString() + Math.random().toString(36).slice(2, 6),
      accountKey: resolvedAccountKey,
      amountCents: -amt,
      category: billCategory,
      description: notes ? `Bill: ${bill.name} - ${notes}` : `Bill: ${bill.name}`,
      timestamp: paidDate,
      profile: billProfile || undefined,
      source: 'bill',
      sourceType: 'bill_payment',
      sourceId: billId,
      autoPosted,
      previousBalanceCents,
      nextBalanceCents,
    };

    const updateBillInArray = (arr) =>
      arr.map(b => b.id === billId
        ? { ...b, lastPaidDate: paidDate, lastPaidAmountCents: amt, lastPaidMonth: paidMonth, lastPaidSource: autoPosted ? 'auto_static' : 'manual' }
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
    const billDueDay = bill.dueDay || bill.expectedDay || 31;
    const paidOnTime = paidDateObj.getDate() <= billDueDay;
    get().awardXP(paidOnTime ? 'BILL_PAID_ON_TIME' : 'BILL_PAID_LATE');

    // Update bill action counters + consecutive on-time month tracking
    const prevAC = get().actionCounts;
    const currentMonthKey = paidMonth; // 'YYYY-MM' computed above
    let { consecutiveOnTimeBillMonths, lastBillCheckMonth, hadLateBillInMonth } = prevAC;
    // Crossed into a new month — evaluate the month that just closed
    if (lastBillCheckMonth && lastBillCheckMonth !== currentMonthKey) {
      if (!hadLateBillInMonth) {
        consecutiveOnTimeBillMonths += 1;
      } else {
        consecutiveOnTimeBillMonths = 0;
      }
      hadLateBillInMonth = false;
    }
    if (!paidOnTime) hadLateBillInMonth = true;
    const updatedAC = {
      ...prevAC,
      billsPaidOnTime: prevAC.billsPaidOnTime + (paidOnTime ? 1 : 0),
      billsPaidLate: prevAC.billsPaidLate + (paidOnTime ? 0 : 1),
      consecutiveOnTimeBillMonths,
      lastBillCheckMonth: currentMonthKey,
      hadLateBillInMonth,
    };
    set({ actionCounts: updatedAC });
    AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)).catch(() => {});

    get().checkSpendingFloors();
    get().recomputeVariance();
    if ((get().warnings || []).length === 0) {
      get().rotateFlavorTextForEvent(paidOnTime ? 'bill_paid_on_time' : 'bill_paid_late', {
        accountKey: resolvedAccountKey,
        amountCents: -amt,
        category: billCategory,
        previousBalanceCents,
        nextBalanceCents,
        isSavingsAccount: savingsKeys.includes(resolvedAccountKey),
        isSavingsWithdrawal: savingsKeys.includes(resolvedAccountKey),
      });
    }
  },

  editBill: async (billId, updates) => {
    const { householdBills, personalBills } = get();
    const applyUpdate = (arr) =>
      arr.map(b => b.id === billId ? normalizeBillForSave(updates, b.defaultAccountKey || b.accountKey || null, b, b.billType || b.kind || 'bill') : b);
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

  processAutoPostBills: async () => {
    const state = get();
    const now = Date.now();
    const currentCycleId = getLocalCycleId(now);
    const allBills = [
      ...(state.householdBills || []).map(bill => ({ bill, profile: 'household' })),
      ...(state.personalBills || []).map(bill => ({ bill, profile: 'personal' })),
    ].filter(({ bill }) => bill && bill.isActive !== false && bill.deleted !== true && isBillAutoPostEnabled(bill));

    for (const { bill, profile } of allBills) {
      const expectedAmount = getBillExpectedAmountCents(bill);
      if (expectedAmount <= 0) continue;
      if (bill.staticAutoPostStartMonth && bill.staticAutoPostStartMonth > currentCycleId) continue;
      if (state.billOverrides?.[bill.id]?.lastPaidMonth === currentCycleId || bill.lastPaidMonth === currentCycleId) continue;
      const dueDate = getBillDueDateForCycle(bill, currentCycleId);
      if (!dueDate || dueDate > now) continue;
      const accountKey = bill.defaultAccountKey || bill.accountKey || getActiveAccountKeyForRole(get(), profile) || getFirstActiveAccountKey(get());
      if (!accountKey) continue;
      await get().markBillPaid(bill.id, {
        paidDate: dueDate,
        paidAmountCents: expectedAmount,
        accountKey,
        notes: 'Auto-posted scheduled item',
        autoPosted: true,
      });
    }
  },

  transferBetweenAccounts: async ({
    fromAccountKey,
    toAccountKey,
    amountCents,
    description,
    timestamp,
  }) => {
    const state = get();
    const fromKey = fromAccountKey;
    const toKey = toAccountKey;
    const amt = Math.floor(amountCents || 0);
    if (!fromKey || !toKey || fromKey === toKey || amt <= 0) return null;
    if (!accountKeyExists(state, fromKey) || !accountKeyExists(state, toKey)) return null;

    const { accounts, transactions } = state;
    const now = Date.now();
    const txTime = timestamp || now;
    const transferGroupId = `transfer_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const debitId = `${transferGroupId}_out`;
    const creditId = `${transferGroupId}_in`;
    const fromName = getAccountDisplayName(state, fromKey);
    const toName = getAccountDisplayName(state, toKey);
    const cleanDescription = String(description || '').trim();
    const debitDescription = cleanDescription || `Transfer to ${toName}`;
    const creditDescription = cleanDescription || `Transfer from ${fromName}`;
    const fromPreviousBalanceCents = accounts[fromKey] || 0;
    const fromNextBalanceCents = fromPreviousBalanceCents - amt;
    const toPreviousBalanceCents = accounts[toKey] || 0;
    const toNextBalanceCents = toPreviousBalanceCents + amt;

    const debitTx = {
      id: debitId,
      accountKey: fromKey,
      amountCents: -amt,
      category: 'transfer',
      description: debitDescription,
      timestamp: txTime,
      source: 'transfer',
      sourceType: 'account_transfer',
      sourceId: transferGroupId,
      transferGroupId,
      transferCounterpartId: creditId,
      counterpartyAccountKey: toKey,
      previousBalanceCents: fromPreviousBalanceCents,
      nextBalanceCents: fromNextBalanceCents,
    };
    const creditTx = {
      id: creditId,
      accountKey: toKey,
      amountCents: amt,
      category: 'transfer',
      description: creditDescription,
      timestamp: txTime,
      source: 'transfer',
      sourceType: 'account_transfer',
      sourceId: transferGroupId,
      transferGroupId,
      transferCounterpartId: debitId,
      counterpartyAccountKey: fromKey,
      previousBalanceCents: toPreviousBalanceCents,
      nextBalanceCents: toNextBalanceCents,
    };

    const updatedAccounts = {
      ...accounts,
      [fromKey]: fromNextBalanceCents,
      [toKey]: toNextBalanceCents,
    };
    const updatedTransactions = [...transactions, debitTx, creditTx];

    set({ accounts: updatedAccounts, transactions: updatedTransactions, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);

    get().checkSpendingFloors();
    get().recomputeVariance();
    const savingsKeys = getSavingsAccountKeys(get());
    get().rotateFlavorTextForEvent(
      savingsKeys.includes(toKey) ? 'savings_deposit' : 'transfer',
      {
      accountKey: fromKey,
      amountCents: -amt,
      category: 'transfer',
      previousBalanceCents: fromPreviousBalanceCents,
      nextBalanceCents: fromNextBalanceCents,
      isSavingsAccount: savingsKeys.includes(fromKey) || savingsKeys.includes(toKey),
    });
    return { debitTx, creditTx };
  },

  editTransferTransaction: async (txId, updates = {}) => {
    const { transactions, accounts } = get();
    const tx = transactions.find(t => t.id === txId && !t.deleted);
    if (!tx || !isTransferTransaction(tx)) return;
    const transferGroupId = tx.transferGroupId || tx.sourceId;
    const pair = transactions.filter(t =>
      !t.deleted &&
      (
        (transferGroupId && (t.transferGroupId === transferGroupId || t.sourceId === transferGroupId)) ||
        t.id === tx.transferCounterpartId ||
        t.transferCounterpartId === tx.id
      )
    );
    const debitTx = pair.find(t => (t.amountCents || 0) < 0);
    const creditTx = pair.find(t => (t.amountCents || 0) > 0);
    if (!debitTx || !creditTx) return;

    const amt = Math.floor(Math.abs(updates.amountCents ?? tx.amountCents ?? debitTx.amountCents));
    if (amt <= 0) return;
    const fromKey = updates.fromAccountKey || (tx.id === debitTx.id ? updates.accountKey : null) || debitTx.accountKey;
    const toKey = updates.toAccountKey || (tx.id === creditTx.id ? updates.accountKey : null) || creditTx.accountKey;
    if (!fromKey || !toKey || fromKey === toKey) return;
    const state = get();
    if (!accountKeyExists(state, fromKey) || !accountKeyExists(state, toKey)) return;

    const now = Date.now();
    let updatedAccounts = { ...accounts };
    pair.forEach(item => {
      if (item.accountKey) {
        updatedAccounts[item.accountKey] = (updatedAccounts[item.accountKey] || 0) - (item.amountCents || 0);
      }
    });

    const fromPreviousBalanceCents = updatedAccounts[fromKey] || 0;
    updatedAccounts[fromKey] = fromPreviousBalanceCents - amt;
    const fromNextBalanceCents = updatedAccounts[fromKey];
    const toPreviousBalanceCents = updatedAccounts[toKey] || 0;
    updatedAccounts[toKey] = toPreviousBalanceCents + amt;
    const toNextBalanceCents = updatedAccounts[toKey];

    const sharedDescription = updates.description !== undefined
      ? String(updates.description || '').trim()
      : null;
    const fromName = getAccountDisplayName(state, fromKey);
    const toName = getAccountDisplayName(state, toKey);
    const txTime = updates.timestamp || tx.timestamp || Date.now();
    const nextDebit = {
      ...debitTx,
      accountKey: fromKey,
      amountCents: -amt,
      category: 'transfer',
      description: sharedDescription || debitTx.description || `Transfer to ${toName}`,
      timestamp: txTime,
      source: 'transfer',
      sourceType: 'account_transfer',
      sourceId: debitTx.sourceId || debitTx.transferGroupId,
      transferGroupId: debitTx.transferGroupId || debitTx.sourceId,
      transferCounterpartId: creditTx.id,
      counterpartyAccountKey: toKey,
      previousBalanceCents: fromPreviousBalanceCents,
      nextBalanceCents: fromNextBalanceCents,
    };
    const nextCredit = {
      ...creditTx,
      accountKey: toKey,
      amountCents: amt,
      category: 'transfer',
      description: sharedDescription || creditTx.description || `Transfer from ${fromName}`,
      timestamp: txTime,
      source: 'transfer',
      sourceType: 'account_transfer',
      sourceId: creditTx.sourceId || creditTx.transferGroupId,
      transferGroupId: creditTx.transferGroupId || creditTx.sourceId,
      transferCounterpartId: debitTx.id,
      counterpartyAccountKey: fromKey,
      previousBalanceCents: toPreviousBalanceCents,
      nextBalanceCents: toNextBalanceCents,
    };
    const updatedTransactions = transactions.map(item => {
      if (item.id === debitTx.id) return nextDebit;
      if (item.id === creditTx.id) return nextCredit;
      return item;
    });

    set({ transactions: updatedTransactions, accounts: updatedAccounts, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().checkSpendingFloors();
    get().recomputeVariance();
  },

  deleteTransferPair: async (txId) => {
    const { transactions, accounts } = get();
    const tx = transactions.find(t => t.id === txId && !t.deleted);
    if (!tx || !isTransferTransaction(tx)) return;
    const transferGroupId = tx.transferGroupId || tx.sourceId;
    const pairIds = new Set([tx.id, tx.transferCounterpartId].filter(Boolean));
    const updatedTransactions = transactions.map(item => {
      const sameGroup = transferGroupId && (item.transferGroupId === transferGroupId || item.sourceId === transferGroupId);
      if (!item.deleted && (sameGroup || pairIds.has(item.id) || item.transferCounterpartId === tx.id)) {
        pairIds.add(item.id);
        return { ...item, deleted: true };
      }
      return item;
    });
    let updatedAccounts = { ...accounts };
    transactions.forEach(item => {
      if (pairIds.has(item.id) && !item.deleted && item.accountKey) {
        updatedAccounts[item.accountKey] = (updatedAccounts[item.accountKey] || 0) - (item.amountCents || 0);
      }
    });
    const now = Date.now();
    set({ transactions: updatedTransactions, accounts: updatedAccounts, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().checkSpendingFloors();
    get().recomputeVariance();
  },

  editTransaction: async (txId, updates) => {
    const {
      transactions,
      accounts,
      householdBills,
      personalBills,
      billOverrides,
      genericBusinessIncome,
      genericBusinessExpenses,
    } = get();
    const tx = transactions.find(t => t.id === txId && !t.deleted);
    if (!tx) return;
    if (isTransferTransaction(tx)) {
      await get().editTransferTransaction(txId, updates);
      return;
    }
    const oldAmt = tx.amountCents;
    const newAmt = updates.amountCents !== undefined ? Math.floor(updates.amountCents) : oldAmt;
    if (newAmt === 0) return;
    const oldAccountKey = tx.accountKey;
    const newAccountKey = updates.accountKey || oldAccountKey;
    let updatedAccounts = { ...accounts };
    let balanceMetadata = {};

    if (oldAccountKey === newAccountKey) {
      const delta = newAmt - oldAmt;
      if (delta !== 0 && oldAccountKey) {
        updatedAccounts[oldAccountKey] = (updatedAccounts[oldAccountKey] || 0) + delta;
      }
      balanceMetadata = {
        previousBalanceCents: tx.previousBalanceCents,
        nextBalanceCents: tx.nextBalanceCents == null ? tx.nextBalanceCents : tx.nextBalanceCents + delta,
      };
    } else {
      if (oldAccountKey) updatedAccounts[oldAccountKey] = (updatedAccounts[oldAccountKey] || 0) - oldAmt;
      if (newAccountKey) updatedAccounts[newAccountKey] = (updatedAccounts[newAccountKey] || 0) + newAmt;
      const previousBalanceCents = newAccountKey ? (accounts[newAccountKey] || 0) : 0;
      balanceMetadata = {
        previousBalanceCents,
        nextBalanceCents: previousBalanceCents + newAmt,
      };
    }

    const updatedTx = { ...tx, ...updates, accountKey: newAccountKey, amountCents: newAmt, ...balanceMetadata };
    const updatedTransactions = transactions.map(t => t.id === txId ? updatedTx : t);
    const nextState = { transactions: updatedTransactions, accounts: updatedAccounts };
    const saves = [
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ];

    if (tx.source === 'bill' && tx.sourceId) {
      const paidMs = updates.timestamp || tx.timestamp || Date.now();
      const paidDateObj = new Date(paidMs);
      const paidMonth = `${paidDateObj.getFullYear()}-${String(paidDateObj.getMonth() + 1).padStart(2, '0')}`;
      const syncBills = (arr) => arr.map(b => b.id === tx.sourceId
        ? {
          ...b,
          defaultAccountKey: newAccountKey || b.defaultAccountKey,
          lastPaidDate: paidMs,
          lastPaidAmountCents: Math.abs(newAmt),
          lastPaidMonth: paidMonth,
        }
        : b
      );
      const updatedHouseholdBills = syncBills(householdBills);
      const updatedPersonalBills = syncBills(personalBills);
      const updatedOverrides = { ...billOverrides, [tx.sourceId]: { lastPaidMonth: paidMonth } };
      nextState.householdBills = updatedHouseholdBills;
      nextState.personalBills = updatedPersonalBills;
      nextState.billOverrides = updatedOverrides;
      saves.push(
        AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(updatedHouseholdBills)),
        AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(updatedPersonalBills)),
        AsyncStorage.setItem(KEYS.billOverrides, JSON.stringify(updatedOverrides)),
      );
    }

    if (tx.source === 'business' && tx.sourceId) {
      if (tx.sourceType === 'business_income') {
        const updatedIncome = (genericBusinessIncome || []).map(r =>
          r.id === tx.sourceId ? { ...r, amountCents: Math.abs(newAmt), accountKey: newAccountKey, transactionId: tx.id } : r
        );
        nextState.genericBusinessIncome = updatedIncome;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(updatedIncome)));
      } else if (tx.sourceType === 'business_expense') {
        const updatedExpenses = (genericBusinessExpenses || []).map(r =>
          r.id === tx.sourceId ? { ...r, amountCents: Math.abs(newAmt), accountKey: newAccountKey, transactionId: tx.id } : r
        );
        nextState.genericBusinessExpenses = updatedExpenses;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(updatedExpenses)));
      }
    }

    set(nextState);
    await Promise.all(saves);

    if (String(tx.category || '').toLowerCase() === 'grocery' || tx.source === 'grocery') {
      const match = findGroceryEntryForTransaction(get(), tx, oldAmt);
      const currentWeekStart = getCurrentWeekStart();
      if (match) {
        const updatedEntries = match.entries.map(e =>
          e.id === match.entry.id ? { ...e, amountCents: Math.abs(newAmt), transactionId: tx.id, scope: match.scope } : e
        );
        const currentWeekSpend = recalcCurrentGrocerySpend(updatedEntries, currentWeekStart);
        const updatedHistory = updateClosedGroceryWeek(match.history, updatedEntries, match.budget, match.entry.weekStartDate);
        const updatedBudget = { ...match.budget, currentWeekSpend };
        set({ [match.cfg.entriesKey]: updatedEntries, [match.cfg.budgetKey]: updatedBudget, [match.cfg.historyKey]: updatedHistory });
        await Promise.all([
          AsyncStorage.setItem(match.cfg.entriesStorageKey, JSON.stringify(updatedEntries)),
          AsyncStorage.setItem(match.cfg.budgetStorageKey, JSON.stringify(updatedBudget)),
          AsyncStorage.setItem(match.cfg.historyStorageKey, JSON.stringify(updatedHistory)),
        ]);
      }
    }

    get().recomputeVariance();
  },

  deleteTransaction: async (txId) => {
    const {
      transactions,
      accounts,
      householdBills,
      personalBills,
      billOverrides,
      genericBusinessIncome,
      genericBusinessExpenses,
    } = get();
    const tx = transactions.find(t => t.id === txId && !t.deleted);
    if (!tx) return;
    if (isTransferTransaction(tx)) {
      await get().deleteTransferPair(txId);
      return;
    }
    const updatedTransactions = transactions.map(t =>
      t.id === txId ? { ...t, deleted: true } : t
    );
    const updatedAccounts = tx.accountKey
      ? { ...accounts, [tx.accountKey]: (accounts[tx.accountKey] || 0) - tx.amountCents }
      : accounts;
    const nextState = { transactions: updatedTransactions, accounts: updatedAccounts };
    const saves = [
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ];

    if (tx.source === 'bill' && tx.sourceId) {
      const resetBills = (arr) => arr.map(b => b.id === tx.sourceId
        ? { ...b, lastPaidDate: null, lastPaidAmountCents: null, lastPaidMonth: null }
        : b
      );
      const updatedHouseholdBills = resetBills(householdBills);
      const updatedPersonalBills = resetBills(personalBills);
      const updatedOverrides = { ...billOverrides };
      delete updatedOverrides[tx.sourceId];
      nextState.householdBills = updatedHouseholdBills;
      nextState.personalBills = updatedPersonalBills;
      nextState.billOverrides = updatedOverrides;
      saves.push(
        AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(updatedHouseholdBills)),
        AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(updatedPersonalBills)),
        AsyncStorage.setItem(KEYS.billOverrides, JSON.stringify(updatedOverrides)),
      );
    }

    if (tx.source === 'business' && tx.sourceId) {
      if (tx.sourceType === 'business_income') {
        const updatedIncome = (genericBusinessIncome || []).map(r =>
          r.id === tx.sourceId ? { ...r, deleted: true } : r
        );
        nextState.genericBusinessIncome = updatedIncome;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(updatedIncome)));
      } else if (tx.sourceType === 'business_expense') {
        const updatedExpenses = (genericBusinessExpenses || []).map(r =>
          r.id === tx.sourceId ? { ...r, deleted: true } : r
        );
        nextState.genericBusinessExpenses = updatedExpenses;
        saves.push(AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(updatedExpenses)));
      }
    }

    set(nextState);
    await Promise.all(saves);

    if (String(tx.category || '').toLowerCase() === 'grocery' || tx.source === 'grocery') {
      const match = findGroceryEntryForTransaction(get(), tx, tx.amountCents);
      const currentWeekStart = getCurrentWeekStart();
      if (match) {
        const updatedEntries = match.entries.map(e =>
          e.id === match.entry.id ? { ...e, deleted: true, scope: match.scope } : e
        );
        const currentWeekSpend = recalcCurrentGrocerySpend(updatedEntries, currentWeekStart);
        const updatedHistory = updateClosedGroceryWeek(match.history, updatedEntries, match.budget, match.entry.weekStartDate);
        const updatedBudget = { ...match.budget, currentWeekSpend };
        set({ [match.cfg.entriesKey]: updatedEntries, [match.cfg.budgetKey]: updatedBudget, [match.cfg.historyKey]: updatedHistory });
        await Promise.all([
          AsyncStorage.setItem(match.cfg.entriesStorageKey, JSON.stringify(updatedEntries)),
          AsyncStorage.setItem(match.cfg.budgetStorageKey, JSON.stringify(updatedBudget)),
          AsyncStorage.setItem(match.cfg.historyStorageKey, JSON.stringify(updatedHistory)),
        ]);
      }
    }

    get().recomputeVariance();
  },

  closeGroceryWeeks: async (scopeArg) => {
    const { scope, cfg, budget, entries, history } = getScopedGroceryState(get(), scopeArg);
    const currentWeekStart = getCurrentWeekStart();
    const weeklyLimit = Math.floor(budget.weeklyLimit || 0);
    const storedWeekStart = budget.weekStartDate || currentWeekStart;

    if (!storedWeekStart || storedWeekStart >= currentWeekStart) {
      const currentWeekSpend = recalcCurrentGrocerySpend(entries, currentWeekStart);
      const syncedBudget = { ...budget, currentWeekSpend, weekStartDate: currentWeekStart };
      if (syncedBudget.currentWeekSpend !== budget.currentWeekSpend || syncedBudget.weekStartDate !== budget.weekStartDate) {
        set({ [cfg.budgetKey]: syncedBudget });
        await AsyncStorage.setItem(cfg.budgetStorageKey, JSON.stringify(syncedBudget));
      }
      return;
    }

    const existingWeeks = new Set((history || []).map(record => record.weekStartDate));
    const newRecords = [];
    let cursor = storedWeekStart;
    let safety = 0;
    while (cursor < currentWeekStart && safety < 26) {
      if (weeklyLimit > 0 && !existingWeeks.has(cursor)) {
        const spendCents = recalcCurrentGrocerySpend(entries, cursor);
        const record = { ...buildGroceryCloseoutRecord(cursor, weeklyLimit, spendCents), scope };
        newRecords.push(record);
        await get().updateGroceryStreak(record.spendCents, record.limitCents, record.weekStartDate);
      }
      cursor += WEEK_MS;
      safety += 1;
    }

    const updatedHistory = [...(history || []), ...newRecords]
      .sort((a, b) => (b.weekStartDate || 0) - (a.weekStartDate || 0))
      .slice(0, 104);
    const currentWeekSpend = recalcCurrentGrocerySpend(entries, currentWeekStart);
    const updatedBudget = {
      ...budget,
      currentWeekSpend,
      weekStartDate: currentWeekStart,
      lastClosedWeek: newRecords[newRecords.length - 1] || budget.lastClosedWeek || null,
    };
    set({ [cfg.budgetKey]: updatedBudget, [cfg.historyKey]: updatedHistory });
    await Promise.all([
      AsyncStorage.setItem(cfg.budgetStorageKey, JSON.stringify(updatedBudget)),
      AsyncStorage.setItem(cfg.historyStorageKey, JSON.stringify(updatedHistory)),
    ]);
    if (newRecords.length > 0) get().recomputeVariance();
  },

  updateGroceryBudget: async ({ weeklyLimitCents, scope } = {}) => {
    await get().closeGroceryWeeks(scope);
    const groceryState = getScopedGroceryState(get(), scope);
    const currentWeekStart = getCurrentWeekStart();
    const updatedBudget = {
      ...groceryState.budget,
      weeklyLimit: Math.floor(weeklyLimitCents),
      currentWeekSpend: recalcCurrentGrocerySpend(groceryState.entries, currentWeekStart),
      weekStartDate: currentWeekStart,
    };
    set({ [groceryState.cfg.budgetKey]: updatedBudget });
    await AsyncStorage.setItem(groceryState.cfg.budgetStorageKey, JSON.stringify(updatedBudget));
    get().recomputeVariance();
  },

  updateGroceryStreak: async (spend, limit, weekStartMs) => {
    if (!limit || limit <= 0 || !weekStartMs) return;
    const prevSD = get().streakData;
    const gs = prevSD.groceryStreak;
    if (gs.lastEvaluatedWeekStart === weekStartMs) return;

    const overAmount = spend - limit;
    const graceZone = limit * 0.1;

    let newCurrent = gs.current;
    let newBest = gs.best;
    let newConsecutiveOverBudget = gs.consecutiveOverBudget || 0;
    let weeksUnderBudgetDelta = 0;

    if (spend <= limit) {
      newCurrent += 1;
      newBest = Math.max(newBest, newCurrent);
      newConsecutiveOverBudget = 0;
      weeksUnderBudgetDelta = 1;
    } else if (overAmount <= graceZone) {
      // Within 10% over — hold, no change
      newConsecutiveOverBudget = 0;
    } else {
      newConsecutiveOverBudget += 1;
      if (newConsecutiveOverBudget >= 2) {
        newCurrent = 0;
        newConsecutiveOverBudget = 0;
      }
    }

    const updatedSD = {
      ...prevSD,
      groceryStreak: {
        current: newCurrent,
        best: newBest,
        consecutiveOverBudget: newConsecutiveOverBudget,
        lastEvaluatedWeekStart: weekStartMs,
      },
    };
    const prevAC = get().actionCounts;
    const updatedAC = { ...prevAC, weeksUnderBudget: prevAC.weeksUnderBudget + weeksUnderBudgetDelta };
    set({ streakData: updatedSD, actionCounts: updatedAC });
    await Promise.all([
      AsyncStorage.setItem(KEYS.streakData, JSON.stringify(updatedSD)),
      AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)),
    ]);
  },

  logGrocerySpend: async (amountCents, scopeArg) => {
    const scope = normalizeGroceryScope(scopeArg, get());
    await get().closeGroceryWeeks(scope);
    const { cfg, budget, entries } = getScopedGroceryState(get(), scope);
    const currentWeekStart = getCurrentWeekStart();
    const now = Date.now();
    const amt = Math.floor(amountCents);
    const entryId = `grocery_${now}`;

    const prevSpend = budget.currentWeekSpend || 0;
    const updatedBudget = {
      ...budget,
      currentWeekSpend: prevSpend + amt,
      weekStartDate: currentWeekStart,
    };

    const tx = await get().logTransaction({
      accountKey: getGroceryAccountKeyForScope(get(), scope),
      amountCents: -amt,
      category: 'Grocery',
      description: `${cfg.label} grocery spend`,
      source: 'grocery',
      sourceType: 'grocery_spend',
      sourceId: entryId,
      groceryScope: scope,
      timestamp: now,
    });

    const newEntry = {
      id: entryId,
      transactionId: tx?.id || null,
      amountCents: amt,
      description: '',
      timestamp: now,
      weekStartDate: currentWeekStart,
      scope,
      deleted: false,
    };
    const updatedEntries = [...entries, newEntry];

    set({ [cfg.budgetKey]: updatedBudget, [cfg.entriesKey]: updatedEntries });
    await Promise.all([
      AsyncStorage.setItem(cfg.budgetStorageKey, JSON.stringify(updatedBudget)),
      AsyncStorage.setItem(cfg.entriesStorageKey, JSON.stringify(updatedEntries)),
    ]);

    if (updatedBudget.weeklyLimit > 0 && updatedBudget.currentWeekSpend > updatedBudget.weeklyLimit) {
      get().rotateFlavorTextForEvent('grocery_warning');
    }
    const prevAC = get().actionCounts;
    const updatedAC = { ...prevAC, groceryEntriesLogged: prevAC.groceryEntriesLogged + 1 };
    set({ actionCounts: updatedAC });
    AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)).catch(() => {});
    get().recomputeVariance();
  },

  editGroceryEntry: async (entryId, updates, scopeArg) => {
    const state = get();
    const match = findGroceryEntryById(state, entryId, scopeArg);
    const { transactions, accounts } = state;
    const currentWeekStart = getCurrentWeekStart();
    if (!match) return;
    const existing = match.entry;
    const newAmount = Math.floor(updates.amountCents ?? existing.amountCents);
    if (newAmount <= 0) return;
    const matchedTx = transactions.find(t =>
      !t.deleted &&
      (
        t.id === existing.transactionId ||
        (t.source === 'grocery' && t.sourceId === existing.id) ||
        (
          String(t.category || '').toLowerCase() === 'grocery' &&
          Math.abs((t.timestamp || 0) - (existing.timestamp || 0)) < 5000 &&
          Math.abs(t.amountCents || 0) === Math.abs(existing.amountCents || 0)
        )
      )
    );
    const updatedEntries = match.entries.map(e =>
      e.id === entryId ? { ...e, ...updates, amountCents: newAmount, transactionId: matchedTx?.id || e.transactionId || null, scope: match.scope } : e
    );
    let updatedTransactions = transactions;
    let updatedAccounts = accounts;
    if (matchedTx) {
      const nextTxAmount = matchedTx.amountCents < 0 ? -newAmount : newAmount;
      const delta = nextTxAmount - (matchedTx.amountCents || 0);
      updatedTransactions = transactions.map(t =>
        t.id === matchedTx.id
          ? { ...t, amountCents: nextTxAmount, groceryScope: match.scope, previousBalanceCents: t.previousBalanceCents, nextBalanceCents: t.nextBalanceCents == null ? t.nextBalanceCents : t.nextBalanceCents + delta }
          : t
      );
      updatedAccounts = matchedTx.accountKey
        ? { ...accounts, [matchedTx.accountKey]: (accounts[matchedTx.accountKey] || 0) + delta }
        : accounts;
    }
    const currentWeekSpend = recalcCurrentGrocerySpend(updatedEntries, currentWeekStart);
    const updatedHistory = updateClosedGroceryWeek(match.history, updatedEntries, match.budget, existing.weekStartDate);
    const updatedBudget = { ...match.budget, currentWeekSpend };
    set({ [match.cfg.entriesKey]: updatedEntries, [match.cfg.budgetKey]: updatedBudget, [match.cfg.historyKey]: updatedHistory, transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(match.cfg.entriesStorageKey, JSON.stringify(updatedEntries)),
      AsyncStorage.setItem(match.cfg.budgetStorageKey, JSON.stringify(updatedBudget)),
      AsyncStorage.setItem(match.cfg.historyStorageKey, JSON.stringify(updatedHistory)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    get().recomputeVariance();
  },

  deleteGroceryEntry: async (entryId, scopeArg) => {
    const state = get();
    const match = findGroceryEntryById(state, entryId, scopeArg);
    const { transactions, accounts } = state;
    const currentWeekStart = getCurrentWeekStart();
    if (!match) return;
    const existing = match.entry;
    const matchedTx = transactions.find(t =>
      !t.deleted &&
      (
        t.id === existing.transactionId ||
        (t.source === 'grocery' && t.sourceId === existing.id) ||
        (
          String(t.category || '').toLowerCase() === 'grocery' &&
          Math.abs((t.timestamp || 0) - (existing.timestamp || 0)) < 5000 &&
          Math.abs(t.amountCents || 0) === Math.abs(existing.amountCents || 0)
        )
      )
    );
    const updatedEntries = match.entries.map(e =>
      e.id === entryId ? { ...e, deleted: true, scope: match.scope } : e
    );
    const updatedTransactions = matchedTx
      ? transactions.map(t => t.id === matchedTx.id ? { ...t, deleted: true, groceryScope: match.scope } : t)
      : transactions;
    const updatedAccounts = matchedTx?.accountKey
      ? { ...accounts, [matchedTx.accountKey]: (accounts[matchedTx.accountKey] || 0) - (matchedTx.amountCents || 0) }
      : accounts;
    const currentWeekSpend = recalcCurrentGrocerySpend(updatedEntries, currentWeekStart);
    const updatedHistory = updateClosedGroceryWeek(match.history, updatedEntries, match.budget, existing.weekStartDate);
    const updatedBudget = { ...match.budget, currentWeekSpend };
    set({ [match.cfg.entriesKey]: updatedEntries, [match.cfg.budgetKey]: updatedBudget, [match.cfg.historyKey]: updatedHistory, transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(match.cfg.entriesStorageKey, JSON.stringify(updatedEntries)),
      AsyncStorage.setItem(match.cfg.budgetStorageKey, JSON.stringify(updatedBudget)),
      AsyncStorage.setItem(match.cfg.historyStorageKey, JSON.stringify(updatedHistory)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
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

    get().awardXP('CONFIRM_BALANCE');
    // Update balance confirmation counters
    const prevAC = get().actionCounts;
    const weekStart = getCurrentWeekStart();
    const prevWeekStarts = Array.isArray(prevAC.confirmationWeekStarts) ? prevAC.confirmationWeekStarts : [];
    const confirmationWeekStarts = prevWeekStarts.includes(weekStart)
      ? prevWeekStarts
      : [...prevWeekStarts, weekStart];
    const updatedAC = {
      ...prevAC,
      balanceConfirmations: prevAC.balanceConfirmations + 1,
      confirmationWeekStarts,
    };
    set({ actionCounts: updatedAC });
    AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)).catch(() => {});
    get().checkAndAwardBadge('balance_confirmed');
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('confirm_balance');
  },

  setFlavorText: async (text) => {
    set({ currentFlavorText: text });
    await AsyncStorage.setItem(KEYS.currentFlavorText, JSON.stringify(text));
  },

  setNovaState: async ({ stateKey, faceKey, text, timestamp }) => {
    const lastNovaStateAt = timestamp || Date.now();
    set({
      currentNovaState: stateKey || 'neutral',
      currentNovaFace: faceKey || 'neutral',
      currentFlavorText: text || '',
      lastNovaStateAt,
    });
    await Promise.all([
      AsyncStorage.setItem(KEYS.currentNovaState, JSON.stringify(stateKey || 'neutral')),
      AsyncStorage.setItem(KEYS.currentNovaFace, JSON.stringify(faceKey || 'neutral')),
      AsyncStorage.setItem(KEYS.currentFlavorText, JSON.stringify(text || '')),
      AsyncStorage.setItem(KEYS.lastNovaStateAt, JSON.stringify(lastNovaStateAt)),
    ]);
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
        recurringTransactions: [],
        groceryBudget: profile === 'personal' ? state.personalGroceryBudget : state.groceryBudget,
        varianceConfig: state.varianceConfig[profile],
        genericBusinessIncome: state.genericBusinessIncome,
        genericBusinessExpenses: state.genericBusinessExpenses,
        accountRegistry: state.accountRegistry,
        userMode: state.novaConfig?.userMode ?? null,
        novaConfig: state.novaConfig,
        includeGroceryReserve: state.groceryReserveOn !== false,
        now,
      });
    }

    const dominantNovaState = getDominantVarianceState(newCache);
    const varianceDrivenStates = new Set(['neutral', 'green', 'yellow', 'red']);
    const nextState = { varianceCache: { ...newCache } };

    const riskStateActive = dominantNovaState === 'red' || dominantNovaState === 'yellow';
    if (
      dominantNovaState !== state.currentNovaState &&
      (riskStateActive || varianceDrivenStates.has(state.currentNovaState || 'neutral'))
    ) {
      const statusEventType = dominantNovaState === 'red'
        ? 'red_status'
        : dominantNovaState === 'yellow'
          ? 'yellow_status'
          : dominantNovaState === 'green'
            ? 'green_status'
            : 'variance_change';
      const statusResponse = pickNovaResponse(dominantNovaState, {
        eventType: statusEventType,
        snapshot: state,
        avoidText: state.currentFlavorText,
        avoidFaceKey: state.currentNovaFace,
      });
      nextState.currentNovaState = dominantNovaState;
      nextState.currentNovaFace = statusResponse.faceKey || getNovaFaceForState(dominantNovaState, { eventType: statusEventType });
      nextState.currentFlavorText = statusResponse.text;
      nextState.lastNovaStateAt = now;

      // Track yellow→green recoveries for VARIANCE ANALYST badge
      if (state.currentNovaState === 'yellow' && dominantNovaState === 'green') {
        const prevAC = state.actionCounts || {};
        const updatedAC = { ...prevAC, yellowToGreenRecoveries: (prevAC.yellowToGreenRecoveries || 0) + 1 };
        nextState.actionCounts = updatedAC;
        AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)).catch(() => {});
      }

      Promise.all([
        AsyncStorage.setItem(KEYS.currentNovaState, JSON.stringify(nextState.currentNovaState)),
        AsyncStorage.setItem(KEYS.currentNovaFace, JSON.stringify(nextState.currentNovaFace)),
        AsyncStorage.setItem(KEYS.currentFlavorText, JSON.stringify(nextState.currentFlavorText)),
        AsyncStorage.setItem(KEYS.lastNovaStateAt, JSON.stringify(nextState.lastNovaStateAt)),
      ]).catch(() => {});
    }

    // Badge evaluation — runs after every recompute
    const postActionCounts = nextState.actionCounts || state.actionCounts;
    const newBadgeState = evaluateBadges({
      actionCounts: postActionCounts,
      xpTotal: state.xpTotal,
      streakData: state.streakData,
      accounts: state.accounts,
      novaConfig: state.novaConfig,
      incomeEvents: state.incomeEvents,
      accountRegistry: state.accountRegistry,
      entrepreneurMode: state.novaConfig?.entrepreneurMode || false,
    });

    // Detect newly unlocked tiers and queue them for the unlock toast (Stage 5)
    const newUnlocks = diffBadgeState(state.badgeState, newBadgeState);
    if (newUnlocks.length > 0) {
      const pendingUnlocks = [
        ...(state.pendingUnlocks || []),
        ...newUnlocks.map(u => ({ ...u, unlockedAt: now })),
      ];
      nextState.pendingUnlocks = pendingUnlocks;
      AsyncStorage.setItem(KEYS.pendingUnlocks, JSON.stringify(pendingUnlocks)).catch(() => {});

      if (!riskStateActive) {
        const badgeSnapshot = {
          ...state,
          badgeState: newBadgeState,
          pendingUnlocks,
        };
        const latestUnlock = newUnlocks[newUnlocks.length - 1] || {};
        const badgeEventType = latestUnlock.tier ? `badge_${latestUnlock.tier}` : 'badge_unlock';
        const badgeResponse = pickNovaResponse('badge_unlock', {
          eventType: badgeEventType,
          snapshot: badgeSnapshot,
          avoidText: state.currentFlavorText,
          avoidFaceKey: state.currentNovaFace,
        });
        nextState.currentNovaState = 'badge_unlock';
        nextState.currentNovaFace = badgeResponse.faceKey || getNovaFaceForState('badge_unlock', { eventType: badgeEventType });
        nextState.currentFlavorText = badgeResponse.text;
        nextState.lastNovaStateAt = now;
        Promise.all([
          AsyncStorage.setItem(KEYS.currentNovaState, JSON.stringify(nextState.currentNovaState)),
          AsyncStorage.setItem(KEYS.currentNovaFace, JSON.stringify(nextState.currentNovaFace)),
          AsyncStorage.setItem(KEYS.currentFlavorText, JSON.stringify(nextState.currentFlavorText)),
          AsyncStorage.setItem(KEYS.lastNovaStateAt, JSON.stringify(nextState.lastNovaStateAt)),
        ]).catch(() => {});
      }
    }

    nextState.badgeState = newBadgeState;
    AsyncStorage.setItem(KEYS.badgeState, JSON.stringify(newBadgeState)).catch(() => {});

    set(nextState);
  },

  resetStore: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const novaKeys = allKeys.filter(k => k.startsWith('nova_v2_'));
      if (novaKeys.length > 0) await AsyncStorage.multiRemove(novaKeys);
    } catch (e) {}
    set({ ...initialState });
  },

  dismissPendingUnlock: async (unlockedAt = null) => {
    const queue = get().pendingUnlocks || [];
    const remaining = unlockedAt
      ? queue.filter(unlock => unlock.unlockedAt !== unlockedAt)
      : queue.slice(1);
    set({ pendingUnlocks: remaining });
    await AsyncStorage.setItem(KEYS.pendingUnlocks, JSON.stringify(remaining));
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

  setGroceryReserveOn: async (value) => {
    set({ groceryReserveOn: value });
    await AsyncStorage.setItem(KEYS.groceryReserveOn, JSON.stringify(value));
    get().recomputeVariance();
    get().rotateFlavorTextForEvent(value ? 'reserve_on' : 'reserve_off');
  },

  // Shared helper for all business transaction types — increments counts and tracks P&L month
  incrementBusinessCount: (type, amountCents = 0) => {
    const prevAC = get().actionCounts;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let { lastBusinessIncomeMonth, lastBusinessExpenseMonth, completePLMonths, lastCompletePLMonth } = prevAC;

    const isIncome = type === 'income';
    const isExpense = type === 'expense';
    if (isIncome) lastBusinessIncomeMonth = monthKey;
    if (isExpense) lastBusinessExpenseMonth = monthKey;

    // If we now have both income and expense in the same month and haven't counted it yet
    if (lastBusinessIncomeMonth === monthKey && lastBusinessExpenseMonth === monthKey && lastCompletePLMonth !== monthKey) {
      completePLMonths += 1;
      lastCompletePLMonth = monthKey;
    }

    const updatedAC = {
      ...prevAC,
      businessTransactions: prevAC.businessTransactions + 1,
      businessIncomeTransactions: prevAC.businessIncomeTransactions + (isIncome ? 1 : 0),
      businessExpenseTransactions: prevAC.businessExpenseTransactions + (isExpense ? 1 : 0),
      businessMileageTransactions: prevAC.businessMileageTransactions + (type === 'mileage' ? 1 : 0),
      totalBusinessIncomeCents: (prevAC.totalBusinessIncomeCents || 0) + (isIncome ? Math.max(0, amountCents) : 0),
      lastBusinessIncomeMonth,
      lastBusinessExpenseMonth,
      completePLMonths,
      lastCompletePLMonth,
    };
    set({ actionCounts: updatedAC });
    AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)).catch(() => {});
  },

  checkCycleReset: async () => {
    await get().closeGroceryWeeks('household');
    await get().closeGroceryWeeks('personal');
    await get().processAutoPostBills();
    const now = new Date();
    const currentCycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const state = get();
    const { budget: groceryBudget } = getScopedGroceryState(state);
    const { lastCycleResetMonth, groceryStreakWeeks, householdBills, personalBills } = state;
    if (currentCycleId !== lastCycleResetMonth) {
      // Check scheduled income events for the closing cycle.
      const { incomeEvents } = get();
      const scheduledIncomeEvents = Array.isArray(incomeEvents?.scheduledIncomeEvents)
        ? incomeEvents.scheduledIncomeEvents
        : [];
      const missedScheduledIncome = scheduledIncomeEvents.some(event =>
        event?.isActive !== false &&
        event.frequency === 'monthly' &&
        (event.amountCents || 0) > 0 &&
        event.lastReceivedCycle !== lastCycleResetMonth
      );
      if (lastCycleResetMonth && missedScheduledIncome) {
        const cfg = notificationsConfig.scheduledIncomeMissed || notificationsConfig.partnerDepositMissed;
        scheduleLocalNotification('scheduled_income_missed', cfg.title, cfg.body, 5);
      }

      // Delegate grocery streak evaluation to updateGroceryStreak (handles dedup, grace zone, weeksUnderBudget)
      if (groceryBudget?.weeklyLimit > 0 && groceryBudget.weekStartDate) {
        await get().updateGroceryStreak(groceryBudget.currentWeekSpend || 0, groceryBudget.weeklyLimit, groceryBudget.weekStartDate);
      }

      // Legacy discipline streak (used by flat badge system)
      let newStreakWeeks = groceryStreakWeeks;
      let newDisciplineStreak = get().groceryDisciplineStreak || 0;
      if (groceryBudget?.weeklyLimit > 0) {
        if ((groceryBudget.currentWeekSpend || 0) <= groceryBudget.weeklyLimit) {
          newStreakWeeks += 1;
          newDisciplineStreak += 1;
        } else {
          newStreakWeeks = 0;
          newDisciplineStreak = 0;
        }
      }
      if (newDisciplineStreak >= 4) {
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

      // Update action counters at cycle boundary
      const prevAC = get().actionCounts;
      let { consecutiveOnTimeBillMonths, lastBillCheckMonth, hadLateBillInMonth } = prevAC;
      // Evaluate the closing month's bill timeliness if we haven't already
      if (closingCycleId && lastBillCheckMonth !== currentCycleId) {
        if (!hadLateBillInMonth) {
          consecutiveOnTimeBillMonths += 1;
        } else {
          consecutiveOnTimeBillMonths = 0;
        }
        hadLateBillInMonth = false;
      }
      // CYCLE CLOSER: track best cycle XP and green cycle endings
      const closingCycleXP = prevAC.currentCycleXP || 0;
      const closingNovaState = get().currentNovaState;
      const cycleEndedGreen = closingNovaState === 'green';
      const updatedAC = {
        ...prevAC,
        cyclesCompleted: prevAC.cyclesCompleted + 1,
        consecutiveOnTimeBillMonths,
        lastBillCheckMonth: currentCycleId,
        hadLateBillInMonth,
        bestCycleXP: Math.max(prevAC.bestCycleXP || 0, closingCycleXP),
        currentCycleXP: 0,
        greenCycleEnds: (prevAC.greenCycleEnds || 0) + (cycleEndedGreen ? 1 : 0),
      };

      set({ lastCycleResetMonth: currentCycleId, groceryStreakWeeks: newStreakWeeks, groceryDisciplineStreak: newDisciplineStreak, actionCounts: updatedAC });
      await Promise.all([
        AsyncStorage.setItem(KEYS.LAST_CYCLE_RESET_MONTH, JSON.stringify(currentCycleId)),
        AsyncStorage.setItem(KEYS.groceryStreakWeeks, JSON.stringify(newStreakWeeks)),
        AsyncStorage.setItem(KEYS.groceryDisciplineStreak, JSON.stringify(newDisciplineStreak)),
        AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)),
      ]);
      get().recomputeVariance();
      const closedCleanWeek = groceryBudget?.weeklyLimit > 0 && (groceryBudget.currentWeekSpend || 0) <= groceryBudget.weeklyLimit;
      get().rotateFlavorTextForEvent('cycle_reset', { zeroWaste: closedCleanWeek });
    }
  },

  awardXP: async (eventType) => {
    const xp = XP_EVENTS[eventType];
    if (!xp) return;
    const now = Date.now();
    const cutoff = now - 90 * 24 * 60 * 60 * 1000;
    const entry = { eventType, xp, timestamp: now };
    const xpHistory = [...(get().xpHistory || []).filter(e => e.timestamp >= cutoff), entry];
    const xpTotal = get().xpTotal + xp;

    // Track per-category XP, active days, cycle XP, and cross-category weeks
    const category = XP_CATEGORIES[eventType];
    const weekStartMs = getCurrentWeekStart(now);
    const weekKey = String(weekStartMs);
    const prevCounts = get().actionCounts;

    // xpByCategory — persistent running totals per category
    const prevCat = prevCounts.xpByCategory || {};
    const xpByCategory = { ...prevCat, [category]: (prevCat[category] || 0) + xp };

    // currentCycleXP
    const currentCycleXP = (prevCounts.currentCycleXP || 0) + xp;

    // totalActiveDays — increment when we first see a new calendar day
    const todayStart = (() => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    const isNewDay = prevCounts.lastActiveDayStart !== todayStart;
    const totalActiveDays = (prevCounts.totalActiveDays || 0) + (isNewDay ? 1 : 0);
    const lastActiveDayStart = todayStart;

    // weeklyXPCategories — rolling 130-week window
    const prevWeeklyXP = prevCounts.weeklyXPCategories || {};
    const weekCategories = prevWeeklyXP[weekKey] ? [...prevWeeklyXP[weekKey]] : [];
    if (category && !weekCategories.includes(category)) weekCategories.push(category);
    const cutoffWeekMs = weekStartMs - 130 * 7 * 24 * 60 * 60 * 1000;
    const trimmedWeeklyXP = {};
    for (const k of Object.keys(prevWeeklyXP)) {
      if (Number(k) >= cutoffWeekMs) trimmedWeeklyXP[k] = prevWeeklyXP[k];
    }
    trimmedWeeklyXP[weekKey] = weekCategories;

    // crossCategoryWeeksTotal — increment the FIRST time this week hits 3+ categories
    const prevCCTotal = prevCounts.crossCategoryWeeksTotal || 0;
    const prevCCWeek = prevCounts.lastCrossCategoryWeekKey;
    const justCrossed = weekCategories.length >= 3 && prevCCWeek !== weekKey;
    const crossCategoryWeeksTotal = justCrossed ? prevCCTotal + 1 : prevCCTotal;
    const lastCrossCategoryWeekKey = justCrossed ? weekKey : prevCCWeek;

    const actionCounts = {
      ...prevCounts,
      xpByCategory,
      currentCycleXP,
      totalActiveDays,
      lastActiveDayStart,
      weeklyXPCategories: trimmedWeeklyXP,
      crossCategoryWeeksTotal,
      lastCrossCategoryWeekKey,
    };

    set({ xpTotal, xpHistory, actionCounts });
    get().weeklyActiveCheck(weekStartMs);
    await Promise.all([
      AsyncStorage.setItem(KEYS.xpTotal, JSON.stringify(xpTotal)),
      AsyncStorage.setItem(KEYS.xpHistory, JSON.stringify(xpHistory)),
      AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(actionCounts)),
    ]);
  },

  weeklyActiveCheck: (weekStartMs) => {
    const { streakData } = get();
    const wa = streakData.weeklyActive;
    if (wa.lastActiveWeekStart === weekStartMs) return; // already counted this week
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const isConsecutive = wa.lastActiveWeekStart === weekStartMs - WEEK_MS;
    const newCurrent = isConsecutive ? wa.current + 1 : 1;
    const newBest = Math.max(wa.best, newCurrent);
    const updated = {
      ...streakData,
      weeklyActive: { current: newCurrent, best: newBest, lastActiveWeekStart: weekStartMs },
    };
    set({ streakData: updated });
    AsyncStorage.setItem(KEYS.streakData, JSON.stringify(updated)).catch(() => {});
  },

  checkAndAwardBadge: async (key) => {
    const badges = get().badges;
    if (badges[key]) return;
    const { confirmStreak, transactions, genericBusinessIncome, genericBusinessExpenses, accounts } = get();

    let earned = false;
    if (key === 'first_log') earned = (transactions || []).filter(t => !t.deleted).length >= 1;
    if (key === 'rollover_king') earned = true; // only called when rollover actually fires
    if (key === 'balance_confirmed') earned = confirmStreak >= 7;
    if (key === 'llc_launched') earned = (genericBusinessExpenses || []).filter(r => !r.deleted).length >= 1;
    if (key === 'business_income') earned = (genericBusinessIncome || []).filter(r => !r.deleted).length >= 1;
    if (key === 'comma_club') earned = getSavingsAccountKeys(get()).some(accountKey => (accounts[accountKey] || 0) >= 100000);
    if (key === 'grocery_discipline') earned = true; // only called when discipline streak threshold met
    if (key === 'cycle_complete') earned = true; // only called when all bills confirmed paid

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

  generatePostPaydayActions: async () => {
    const { novaConfig, accountRegistry } = get();
    const now = Date.now();
    const expiryMs = ((novaConfig?.postPaydayExpiryHours ?? 12) * 60 * 60 * 1000);
    const splits = (novaConfig?.paycheckSplits || []).filter(split => (split.amountCents || 0) > 0);
    const configured = Array.isArray(novaConfig?.postPaydayActionAccountIds) ? novaConfig.postPaydayActionAccountIds : [];
    const splitAccountIds = splits.map(split => split.accountId || split.accountKey).filter(Boolean);
    const actionAccountIds = [...new Set((configured.length > 0 ? configured : splitAccountIds).filter(Boolean))];
    const getAccountName = (accountKey) => {
      const account = (accountRegistry || []).find(a => (a.legacyKey || a.id) === accountKey || a.id === accountKey);
      return account ? (account.name || account.id) : accountKey;
    };
    const actions = actionAccountIds.map(accountKey => ({
      id: `ppd_split_${accountKey}_${now}`,
      type: 'income_split_confirm',
      accountKey,
      label: `Confirm ${getAccountName(accountKey)} allocation`,
      completed: false,
      completedAt: null,
      createdAt: now,
      expiresAt: now + expiryMs,
    }));
    set({ postPaydayActions: actions });
    await AsyncStorage.setItem(KEYS.postPaydayActions, JSON.stringify(actions));
  },

  completePostPaydayAction: async (id) => {
    const updated = get().postPaydayActions.map(a =>
      a.id === id ? { ...a, completed: true, completedAt: Date.now() } : a
    );
    set({ postPaydayActions: updated });
    await AsyncStorage.setItem(KEYS.postPaydayActions, JSON.stringify(updated));
    get().awardXP('POST_PAYDAY_ACTION_COMPLETED');
    const prevAC = get().actionCounts;
    const updatedAC = { ...prevAC, savingsDeposits: prevAC.savingsDeposits + 1 };
    set({ actionCounts: updatedAC });
    AsyncStorage.setItem(KEYS.actionCounts, JSON.stringify(updatedAC)).catch(() => {});
    get().rotateFlavorTextForEvent('post_payday_action');
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

  updateSavingsGoal: async (goal) => {
    const savingsGoal = goal ? normalizeSavingsGoal(goal) : initialState.novaConfig.savingsGoal;
    const savingsGoals = savingsGoal.targetCents > 0 ? [savingsGoal] : [];
    const novaConfig = { ...get().novaConfig, savingsGoal, savingsGoals };
    set({ novaConfig });
    await AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(novaConfig));
  },

  upsertSavingsGoal: async (goal) => {
    const currentGoals = normalizeSavingsGoals(get().novaConfig?.savingsGoals, get().novaConfig?.savingsGoal);
    const normalized = normalizeSavingsGoal(goal);
    const exists = currentGoals.some(item => item.id === normalized.id);
    const savingsGoals = exists
      ? currentGoals.map(item => item.id === normalized.id ? { ...item, ...normalized, updatedAt: Date.now() } : item)
      : [...currentGoals, normalized];
    const novaConfig = {
      ...get().novaConfig,
      savingsGoals,
      savingsGoal: savingsGoals[0] || initialState.novaConfig.savingsGoal,
    };
    set({ novaConfig });
    await AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(novaConfig));
    return normalized;
  },

  deleteSavingsGoal: async (id) => {
    const savingsGoals = normalizeSavingsGoals(get().novaConfig?.savingsGoals, get().novaConfig?.savingsGoal)
      .filter(goal => goal.id !== id);
    const novaConfig = {
      ...get().novaConfig,
      savingsGoals,
      savingsGoal: savingsGoals[0] || initialState.novaConfig.savingsGoal,
    };
    set({ novaConfig });
    await AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(novaConfig));
  },

  // Account registry
  addAccount: async (account) => {
    const id = account.id || `acc_${Date.now()}`;
    const newEntry = { ...account, id, isActive: true, createdAt: Date.now() };
    const registry = [...get().accountRegistry, newEntry];
    const key = newEntry.legacyKey || id;
    const accounts = { ...get().accounts };
    if (accounts[key] === undefined) accounts[key] = newEntry.initialBalanceCents || 0;
    set({ accountRegistry: registry, accounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.accountRegistry, JSON.stringify(registry)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accounts)),
    ]);
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('account_added');
  },

  editAccount: async (id, updates) => {
    const registry = get().accountRegistry.map(a => a.id === id ? { ...a, ...updates } : a);
    set({ accountRegistry: registry });
    await AsyncStorage.setItem(KEYS.accountRegistry, JSON.stringify(registry));
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('settings_saved');
  },

  archiveAccount: async (id) => {
    const registry = get().accountRegistry.map(a => a.id === id ? { ...a, isActive: false } : a);
    set({ accountRegistry: registry });
    await AsyncStorage.setItem(KEYS.accountRegistry, JSON.stringify(registry));
    get().recomputeVariance();
  },

  getAccountById: (id) => get().accountRegistry.find(a => a.id === id) || null,

  logGenericBusinessIncome: async (businessId, record) => {
    const { accounts, transactions } = get();
    const id = record.id || `biz_inc_${Date.now()}`;
    const now = Date.now();
    const accountKey = record.accountKey || record.destinationAccountKey || getBusinessAccountKey(get(), businessId);
    const amountCents = Math.floor(record.amountCents || 0);
    if (!accountKey || amountCents <= 0) return;
    const businessName = getBusinessName(get(), businessId);
    const timestamp = getRecordDateMs(record);
    const previousBalanceCents = accounts[accountKey] || 0;
    const nextBalanceCents = previousBalanceCents + amountCents;
    const receiptFields = receiptFieldsForRecord(record);
    const newTx = {
      id: `biz_tx_${id}_${now}`,
      accountKey,
      amountCents,
      category: record.category || 'business_income',
      description: `${businessName}: ${record.clientName || record.description || 'Business income'}`,
      paymentMethod: record.paymentMethod,
      timestamp,
      source: 'business',
      sourceType: 'business_income',
      sourceId: id,
      businessId,
      splitGroupId: record.splitGroupId,
      splitPart: record.splitPart,
      splitTotalParts: record.splitTotalParts,
      splitTotalCents: record.splitTotalCents,
      splitParentDescription: record.splitParentDescription,
      previousBalanceCents,
      nextBalanceCents,
      ...receiptFields,
    };
    const newRecord = {
      ...record,
      id,
      businessId,
      accountKey,
      transactionId: newTx.id,
      amountCents,
      createdAt: now,
      deleted: false,
      ...receiptFields,
    };
    const genericBusinessIncome = [...get().genericBusinessIncome, newRecord];
    const updatedAccounts = { ...accounts, [accountKey]: nextBalanceCents };
    const updatedTransactions = [...transactions, newTx];
    set({ genericBusinessIncome, accounts: updatedAccounts, transactions: updatedTransactions, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(genericBusinessIncome)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().awardXP('BUSINESS_INCOME_LOGGED');
    get().incrementBusinessCount('income', amountCents);
    get().checkAndAwardBadge('business_income');
    requestAutoExportForChange(amountCents);
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('business_income', {
      accountKey,
      amountCents,
      category: 'income',
      previousBalanceCents,
      nextBalanceCents,
    });
  },

  logGenericBusinessExpense: async (businessId, record) => {
    const { accounts, transactions } = get();
    const id = record.id || `biz_exp_${Date.now()}`;
    const now = Date.now();
    const accountKey = record.accountKey || record.paidFromAccountKey || getBusinessAccountKey(get(), businessId);
    const amountCents = Math.floor(record.amountCents || 0);
    if (!accountKey || amountCents <= 0) return;
    const businessName = getBusinessName(get(), businessId);
    const timestamp = getRecordDateMs(record);
    const previousBalanceCents = accounts[accountKey] || 0;
    const signedAmountCents = -amountCents;
    const nextBalanceCents = previousBalanceCents + signedAmountCents;
    const receiptFields = receiptFieldsForRecord(record);
    const newTx = {
      id: `biz_tx_${id}_${now}`,
      accountKey,
      amountCents: signedAmountCents,
      category: record.category || 'business_expense',
      description: `${businessName}: ${record.description || record.vendor || 'Business expense'}`,
      paymentMethod: record.paymentMethod,
      timestamp,
      source: 'business',
      sourceType: 'business_expense',
      sourceId: id,
      businessId,
      splitGroupId: record.splitGroupId,
      splitPart: record.splitPart,
      splitTotalParts: record.splitTotalParts,
      splitTotalCents: record.splitTotalCents,
      splitParentDescription: record.splitParentDescription,
      previousBalanceCents,
      nextBalanceCents,
      ...receiptFields,
    };
    const newRecord = {
      ...record,
      id,
      businessId,
      accountKey,
      transactionId: newTx.id,
      amountCents,
      createdAt: now,
      deleted: false,
      ...receiptFields,
    };
    const genericBusinessExpenses = [...get().genericBusinessExpenses, newRecord];
    const updatedAccounts = { ...accounts, [accountKey]: nextBalanceCents };
    const updatedTransactions = [...transactions, newTx];
    set({ genericBusinessExpenses, accounts: updatedAccounts, transactions: updatedTransactions, lastActivityAt: now });
    await Promise.all([
      AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(genericBusinessExpenses)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.lastActivityAt, JSON.stringify(now)),
    ]);
    get().awardXP('BUSINESS_EXPENSE_LOGGED');
    get().incrementBusinessCount('expense');
    get().checkAndAwardBadge('llc_launched');
    requestAutoExportForChange(signedAmountCents);
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('business_expense', {
      accountKey,
      amountCents: signedAmountCents,
      category: 'business_expense',
      previousBalanceCents,
      nextBalanceCents,
    });
  },

  logGenericBusinessMileage: async (businessId, record) => {
    const id = record.id || `biz_mile_${Date.now()}`;
    const miles = parseFloat(record.miles || 0) || 0;
    if (miles <= 0) return;
    const irsRateCents = record.irsRateCents || get().irsRatePerMile || 0;
    const taxDeductible = record.taxDeductible !== false;
    const deductionCents = taxDeductible ? Math.round(miles * irsRateCents) : 0;
    const newRecord = { ...record, id, miles, taxDeductible, irsRateCents, deductionCents, businessId, createdAt: Date.now(), deleted: false };
    const genericBusinessMileage = [...(get().genericBusinessMileage || []), newRecord];
    set({ genericBusinessMileage });
    await AsyncStorage.setItem(KEYS.genericBusinessMileage, JSON.stringify(genericBusinessMileage));
    get().awardXP('BUSINESS_MILEAGE_LOGGED');
    get().incrementBusinessCount('mileage');
    requestAutoExportForChange();
    get().recomputeVariance();
    get().rotateFlavorTextForEvent('business_mileage', {
      amountCents: 0,
      category: 'business_mileage',
    });
  },

  editGenericBusinessIncome: async (id, updates) => {
    const { genericBusinessIncome, transactions, accounts } = get();
    const existing = genericBusinessIncome.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const amountCents = Math.floor(updates.amountCents ?? existing.amountCents ?? 0);
    if (amountCents <= 0) return;
    const accountKey = updates.accountKey || existing.accountKey || getBusinessAccountKey(get(), existing.businessId);
    if (!accountKey) return;
    const tx = transactions.find(t => !t.deleted && (t.id === existing.transactionId || (t.source === 'business' && t.sourceId === id)));
    const oldSigned = tx?.amountCents ?? (existing.amountCents || 0);
    const oldAccountKey = tx?.accountKey || existing.accountKey;
    let updatedAccounts = { ...accounts };
    if (tx) {
      if (oldAccountKey === accountKey) {
        updatedAccounts[accountKey] = (updatedAccounts[accountKey] || 0) + (amountCents - oldSigned);
      } else {
        if (oldAccountKey) updatedAccounts[oldAccountKey] = (updatedAccounts[oldAccountKey] || 0) - oldSigned;
        updatedAccounts[accountKey] = (updatedAccounts[accountKey] || 0) + amountCents;
      }
    }
    const timestamp = getRecordDateMs({ ...existing, ...updates });
    const businessName = getBusinessName(get(), existing.businessId);
    const updatedRecords = genericBusinessIncome.map(r =>
      r.id === id ? { ...r, ...updates, amountCents, accountKey, transactionId: tx?.id || r.transactionId || null } : r
    );
    const updatedTransactions = tx
      ? transactions.map(t => t.id === tx.id ? {
        ...t,
        accountKey,
        amountCents,
        category: updates.category || t.category || 'business_income',
        description: `${businessName}: ${updates.clientName || existing.clientName || updates.description || existing.description || 'Business income'}`,
        timestamp,
        businessId: existing.businessId,
        previousBalanceCents: oldAccountKey === accountKey ? t.previousBalanceCents : (accounts[accountKey] || 0),
        nextBalanceCents: oldAccountKey === accountKey
          ? (t.nextBalanceCents == null ? t.nextBalanceCents : t.nextBalanceCents + (amountCents - oldSigned))
          : (accounts[accountKey] || 0) + amountCents,
      } : t)
      : transactions;
    set({ genericBusinessIncome: updatedRecords, transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(updatedRecords)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    requestAutoExportForChange(amountCents);
    get().recomputeVariance();
  },

  deleteGenericBusinessIncome: async (id) => {
    const { genericBusinessIncome, transactions, accounts } = get();
    const existing = genericBusinessIncome.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const tx = transactions.find(t => !t.deleted && (t.id === existing.transactionId || (t.source === 'business' && t.sourceId === id)));
    const updatedRecords = genericBusinessIncome.map(r => r.id === id ? { ...r, deleted: true } : r);
    const updatedTransactions = tx ? transactions.map(t => t.id === tx.id ? { ...t, deleted: true } : t) : transactions;
    const updatedAccounts = tx?.accountKey
      ? { ...accounts, [tx.accountKey]: (accounts[tx.accountKey] || 0) - (tx.amountCents || 0) }
      : accounts;
    set({ genericBusinessIncome: updatedRecords, transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.genericBusinessIncome, JSON.stringify(updatedRecords)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    requestAutoExportForChange();
    get().recomputeVariance();
  },

  editGenericBusinessExpense: async (id, updates) => {
    const { genericBusinessExpenses, transactions, accounts } = get();
    const existing = genericBusinessExpenses.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const amountCents = Math.floor(updates.amountCents ?? existing.amountCents ?? 0);
    if (amountCents <= 0) return;
    const accountKey = updates.accountKey || existing.accountKey || getBusinessAccountKey(get(), existing.businessId);
    if (!accountKey) return;
    const tx = transactions.find(t => !t.deleted && (t.id === existing.transactionId || (t.source === 'business' && t.sourceId === id)));
    const newSigned = -amountCents;
    const oldSigned = tx?.amountCents ?? -(existing.amountCents || 0);
    const oldAccountKey = tx?.accountKey || existing.accountKey;
    let updatedAccounts = { ...accounts };
    if (tx) {
      if (oldAccountKey === accountKey) {
        updatedAccounts[accountKey] = (updatedAccounts[accountKey] || 0) + (newSigned - oldSigned);
      } else {
        if (oldAccountKey) updatedAccounts[oldAccountKey] = (updatedAccounts[oldAccountKey] || 0) - oldSigned;
        updatedAccounts[accountKey] = (updatedAccounts[accountKey] || 0) + newSigned;
      }
    }
    const timestamp = getRecordDateMs({ ...existing, ...updates });
    const businessName = getBusinessName(get(), existing.businessId);
    const updatedRecords = genericBusinessExpenses.map(r =>
      r.id === id ? { ...r, ...updates, amountCents, accountKey, transactionId: tx?.id || r.transactionId || null } : r
    );
    const updatedTransactions = tx
      ? transactions.map(t => t.id === tx.id ? {
        ...t,
        accountKey,
        amountCents: newSigned,
        category: updates.category || t.category || 'business_expense',
        description: `${businessName}: ${updates.description || existing.description || updates.vendor || existing.vendor || 'Business expense'}`,
        timestamp,
        businessId: existing.businessId,
        previousBalanceCents: oldAccountKey === accountKey ? t.previousBalanceCents : (accounts[accountKey] || 0),
        nextBalanceCents: oldAccountKey === accountKey
          ? (t.nextBalanceCents == null ? t.nextBalanceCents : t.nextBalanceCents + (newSigned - oldSigned))
          : (accounts[accountKey] || 0) + newSigned,
      } : t)
      : transactions;
    set({ genericBusinessExpenses: updatedRecords, transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(updatedRecords)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    requestAutoExportForChange(newSigned);
    get().recomputeVariance();
  },

  deleteGenericBusinessExpense: async (id) => {
    const { genericBusinessExpenses, transactions, accounts } = get();
    const existing = genericBusinessExpenses.find(r => r.id === id && !r.deleted);
    if (!existing) return;
    const tx = transactions.find(t => !t.deleted && (t.id === existing.transactionId || (t.source === 'business' && t.sourceId === id)));
    const updatedRecords = genericBusinessExpenses.map(r => r.id === id ? { ...r, deleted: true } : r);
    const updatedTransactions = tx ? transactions.map(t => t.id === tx.id ? { ...t, deleted: true } : t) : transactions;
    const updatedAccounts = tx?.accountKey
      ? { ...accounts, [tx.accountKey]: (accounts[tx.accountKey] || 0) - (tx.amountCents || 0) }
      : accounts;
    set({ genericBusinessExpenses: updatedRecords, transactions: updatedTransactions, accounts: updatedAccounts });
    await Promise.all([
      AsyncStorage.setItem(KEYS.genericBusinessExpenses, JSON.stringify(updatedRecords)),
      AsyncStorage.setItem(KEYS.transactions, JSON.stringify(updatedTransactions)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updatedAccounts)),
    ]);
    requestAutoExportForChange();
    get().recomputeVariance();
  },

  editGenericBusinessMileage: async (id, updates) => {
    const genericBusinessMileage = (get().genericBusinessMileage || []).map(r => {
      if (r.id !== id) return r;
      const miles = parseFloat(updates.miles ?? r.miles ?? 0) || 0;
      const irsRateCents = updates.irsRateCents || r.irsRateCents || get().irsRatePerMile || 0;
      const taxDeductible = updates.taxDeductible !== undefined ? updates.taxDeductible !== false : r.taxDeductible !== false;
      const deductionCents = taxDeductible ? Math.round(miles * irsRateCents) : 0;
      return { ...r, ...updates, miles, taxDeductible, irsRateCents, deductionCents };
    });
    set({ genericBusinessMileage });
    await AsyncStorage.setItem(KEYS.genericBusinessMileage, JSON.stringify(genericBusinessMileage));
    requestAutoExportForChange();
    get().recomputeVariance();
  },

  deleteGenericBusinessMileage: async (id) => {
    const genericBusinessMileage = (get().genericBusinessMileage || []).map(r => r.id === id ? { ...r, deleted: true } : r);
    set({ genericBusinessMileage });
    await AsyncStorage.setItem(KEYS.genericBusinessMileage, JSON.stringify(genericBusinessMileage));
    requestAutoExportForChange();
    get().recomputeVariance();
  },

  // Business registry
  addBusiness: async (biz) => {
    const id = biz.id || `biz_${Date.now()}`;
    const newEntry = {
      ...biz,
      id,
      defaultAccountKey: biz.defaultAccountKey || getBusinessAccountKey(get(), id),
      isActive: true,
      createdAt: Date.now(),
    };
    const businesses = [...get().businesses, newEntry];
    set({ businesses });
    await AsyncStorage.setItem(KEYS.businesses, JSON.stringify(businesses));
    get().rotateFlavorTextForEvent('business_tax_ready');
  },

  editBusiness: async (id, updates) => {
    const businesses = get().businesses.map(b => b.id === id ? { ...b, ...updates } : b);
    set({ businesses });
    await AsyncStorage.setItem(KEYS.businesses, JSON.stringify(businesses));
  },

  archiveBusiness: async (id) => {
    const businesses = get().businesses.map(b => b.id === id ? { ...b, isActive: false } : b);
    set({ businesses });
    await AsyncStorage.setItem(KEYS.businesses, JSON.stringify(businesses));
  },

  // Spending buckets
  addBucket: async (bucket) => {
    const id = bucket.id || `bucket_${Date.now()}`;
    const newEntry = { ...upgradeBucketIfNeeded({ ...bucket, id }), categoryDefaultsAudited: true, createdAt: Date.now() };
    const spendingBuckets = [...get().spendingBuckets, newEntry];
    set({ spendingBuckets });
    await AsyncStorage.setItem(KEYS.spendingBuckets, JSON.stringify(spendingBuckets));
  },

  editBucket: async (id, updates) => {
    const spendingBuckets = get().spendingBuckets.map(b => {
      if (b.id !== id) return b;
      const merged = { ...b, ...updates };
      return upgradeBucketIfNeeded(merged);
    });
    set({ spendingBuckets });
    await AsyncStorage.setItem(KEYS.spendingBuckets, JSON.stringify(spendingBuckets));
  },

  removeBucket: async (id) => {
    const spendingBuckets = get().spendingBuckets.filter(b => b.id !== id);
    set({ spendingBuckets });
    await AsyncStorage.setItem(KEYS.spendingBuckets, JSON.stringify(spendingBuckets));
  },

  updateCardOrder: async (order) => {
    await get().updatePersonalCardOrder(order);
  },

  updateDashboardCardOrder: async (order) => {
    const rest = normalizeCardOrderIds(order).filter((id) => DASHBOARD_CARD_IDS.has(id));
    const missing = DEFAULT_DASHBOARD_CARD_ORDER.filter((id) => !rest.includes(id));
    const cleaned = [...rest, ...missing];
    set({ dashboardCardOrder: cleaned });
    await AsyncStorage.setItem(KEYS.dashboardCardOrder, JSON.stringify(cleaned));
  },

  updatePersonalCardOrder: async (order) => {
    const rest = normalizeCardOrderIds(order).filter((id) => PERSONAL_CARD_IDS.has(id));
    const missing = DEFAULT_PERSONAL_CARD_ORDER.filter((id) => !rest.includes(id));
    const cleaned = [...rest, ...missing];
    set({ personalCardOrder: cleaned });
    await AsyncStorage.setItem(KEYS.personalCardOrder, JSON.stringify(cleaned));
  },

  updateHouseholdCardOrder: async (order) => {
    const rest = normalizeCardOrderIds(order).filter((id) => HOUSEHOLD_CARD_IDS.has(id));
    const missing = DEFAULT_HOUSEHOLD_CARD_ORDER.filter((id) => !rest.includes(id));
    const cleaned = [...rest, ...missing];
    set({ householdCardOrder: cleaned });
    await AsyncStorage.setItem(KEYS.householdCardOrder, JSON.stringify(cleaned));
  },

  updateBusinessCardOrder: async (order) => {
    const rest = normalizeCardOrderIds(order).filter((id) => BUSINESS_CARD_IDS.has(id));
    const missing = DEFAULT_BUSINESS_CARD_ORDER.filter((id) => !rest.includes(id));
    const cleaned = [...rest, ...missing];
    set({ businessCardOrder: cleaned });
    await AsyncStorage.setItem(KEYS.businessCardOrder, JSON.stringify(cleaned));
  },

  updateDashboardHiddenCards: async (hidden) => {
    const cleaned = Array.isArray(hidden) ? normalizeCardOrderIds(hidden).filter((id) => DASHBOARD_CARD_IDS.has(id)) : [];
    set({ dashboardHiddenCards: cleaned });
    await AsyncStorage.setItem(KEYS.dashboardHiddenCards, JSON.stringify(cleaned));
  },

  updatePersonalHiddenCards: async (hidden) => {
    const cleaned = Array.isArray(hidden) ? normalizeCardOrderIds(hidden).filter((id) => PERSONAL_CARD_IDS.has(id)) : [];
    set({ personalHiddenCards: cleaned });
    await AsyncStorage.setItem(KEYS.personalHiddenCards, JSON.stringify(cleaned));
  },

  updateHouseholdHiddenCards: async (hidden) => {
    const cleaned = Array.isArray(hidden) ? normalizeCardOrderIds(hidden).filter((id) => HOUSEHOLD_CARD_IDS.has(id)) : [];
    set({ householdHiddenCards: cleaned });
    await AsyncStorage.setItem(KEYS.householdHiddenCards, JSON.stringify(cleaned));
  },

  updateBusinessHiddenCards: async (hidden) => {
    const cleaned = Array.isArray(hidden) ? normalizeCardOrderIds(hidden).filter((id) => BUSINESS_CARD_IDS.has(id)) : [];
    set({ businessHiddenCards: cleaned });
    await AsyncStorage.setItem(KEYS.businessHiddenCards, JSON.stringify(cleaned));
  },

  // Wizard completion — writes full payload to store atomically
  completeOnboarding: async (payload = {}) => {
    const {
      wizardAccounts = [],
      wizardBusinesses = [],
      bills = [],
      buckets = [],
      incomeConfig = {},
      userMode = 'solo',
      entrepreneurMode = false,
      paycheckSplits = [],
      savingsGoal = initialState.novaConfig.savingsGoal,
      guidedTourEnabled = true,
      tourDismissedCues = [],
      manualSetupRequested = false,
    } = payload;
    const now = Date.now();
    const mkId = (prefix) => `${prefix}_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const registry = wizardAccounts.map(a => ({
      ...a, id: a.id || mkId('acc'), isActive: true, createdAt: now,
    }));

    const accountBalances = {};
    const accountFloors = { others: 0 };
    for (const acc of registry) {
      const key = acc.legacyKey || acc.id;
      accountBalances[key] = acc.initialBalanceCents || 0;
      if (acc.floorCents && acc.floorCents > 0) accountFloors[key] = acc.floorCents;
    }

    const firstBusinessAccountKey = registry
      .filter(a => a.role === 'business')
      .map(getAccountKey)
      .filter(Boolean)[0] || registry.map(getAccountKey).filter(Boolean)[0] || null;
    const bizRegistry = wizardBusinesses.map(b => ({
      ...b,
      id: b.id || mkId('biz'),
      defaultAccountKey: b.defaultAccountKey || firstBusinessAccountKey,
      isActive: true,
      createdAt: now,
    }));

    const householdAccountKeys = new Set(
      registry.filter(a => a.role === 'household').map(a => a.legacyKey || a.id)
    );
    // No fallback — only real household accounts classify bills as household.
    // Wizard bills with no account (null) or an unresolvable key go to personalBills.

    const onboardingBillAutoPostEnabled = (b) => {
      const isFixed = b.amountType === 'static' || b.isStaticAmount === true;
      if (!isFixed) return false;
      if (b.autoPostEnabled !== undefined) return b.autoPostEnabled === true;
      if (b.isAutoPost !== undefined) return b.isAutoPost === true;
      if (b.isAutoDraft !== undefined) return b.isAutoDraft !== false;
      return false;
    };

    const mkBill = (b, defaultAcct) => {
      const autoPostEnabled = onboardingBillAutoPostEnabled(b);
      return normalizeBillForSave({
        ...b,
        id: b.id || mkId('bill'),
        name: b.name,
        amountCents: b.amountCents || 0,
        expectedDay: b.dueDay || b.expectedDay || 1,
        dueDay: b.dueDay || b.expectedDay || 1,
        autoPostEnabled,
        isAutoPost: autoPostEnabled,
        isAutoDraft: autoPostEnabled,
        isActive: true,
        lastPaidDate: null,
        lastPaidAmountCents: null,
        lastPaidMonth: null,
        defaultAccountKey: b.defaultAccountKey || b.accountKey || defaultAcct || null,
        createdAt: now,
      }, defaultAcct);
    };
    const newHouseholdBills = bills.filter(b => {
      const key = b.defaultAccountKey || b.accountKey;
      return key && householdAccountKeys.has(key);
    }).map(b => mkBill(b, null));
    const newPersonalBills  = bills.filter(b => {
      const key = b.defaultAccountKey || b.accountKey;
      return !key || !householdAccountKeys.has(key);
    }).map(b => mkBill(b, null));

    const incomeEvents = {
      ...get().incomeEvents,
      payFrequency: incomeConfig.payFrequency || 'biweekly',
      nextPaycheckDate: incomeConfig.nextPaycheckDate || null,
      paycheckAmountCents: incomeConfig.paycheckAmountCents || 0,
      paycheckAmount: incomeConfig.paycheckAmountCents || 0,
      scheduledIncomeEvents: Array.isArray(incomeConfig.scheduledIncomeEvents)
        ? incomeConfig.scheduledIncomeEvents
        : (get().incomeEvents?.scheduledIncomeEvents || []),
    };
    const finalBuckets = auditSpendingBucketsForDefaults(buckets || []);
    const onboardingSavingsGoals = normalizeSavingsGoals(savingsGoal ? [{ ...savingsGoal, scope: 'personal' }] : []);

    const updatedNovaConfig = {
      ...get().novaConfig,
      onboardingComplete: true,
      userMode,
      entrepreneurMode,
      paycheckSplits: paycheckSplits,
      guidedTourEnabled,
      tourDismissedCues: Array.isArray(tourDismissedCues) ? tourDismissedCues : [],
      manualSetupRequested,
      setupCompletedAt: now,
      savingsGoals: onboardingSavingsGoals,
      savingsGoal: onboardingSavingsGoals[0] || initialState.novaConfig.savingsGoal,
      registrySeeded: true,
    };

    const finalHouseholdBills = [...get().householdBills, ...newHouseholdBills];
    const finalPersonalBills  = [...get().personalBills,  ...newPersonalBills];

    set({
      accountRegistry: registry,
      businesses: bizRegistry,
      spendingBuckets: finalBuckets,
      householdBills: finalHouseholdBills,
      personalBills: finalPersonalBills,
      accounts: accountBalances,
      accountFloors,
      incomeEvents,
      novaConfig: updatedNovaConfig,
      onboardingComplete: true,
    });

    await Promise.all([
      AsyncStorage.setItem(KEYS.accountRegistry, JSON.stringify(registry)),
      AsyncStorage.setItem(KEYS.businesses, JSON.stringify(bizRegistry)),
      AsyncStorage.setItem(KEYS.spendingBuckets, JSON.stringify(finalBuckets)),
      AsyncStorage.setItem(KEYS.householdBills, JSON.stringify(finalHouseholdBills)),
      AsyncStorage.setItem(KEYS.personalBills, JSON.stringify(finalPersonalBills)),
      AsyncStorage.setItem(KEYS.accounts, JSON.stringify(accountBalances)),
      AsyncStorage.setItem(KEYS.accountFloors, JSON.stringify(accountFloors)),
      AsyncStorage.setItem(KEYS.incomeEvents, JSON.stringify(incomeEvents)),
      AsyncStorage.setItem(KEYS.novaConfig, JSON.stringify(updatedNovaConfig)),
      AsyncStorage.setItem(KEYS.onboardingComplete, JSON.stringify(true)),
    ]);

    get().awardXP('ONBOARDING_COMPLETE');
    get().recomputeVariance();
    if (!String(get().currentFlavorText || '').trim()) {
      get().rotateFlavorTextForEvent('onboarding_complete');
    }
  },
}));

export default useStore;
