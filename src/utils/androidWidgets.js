import { NativeModules, Platform } from 'react-native';
import { formatCentsShort } from './currency';
import { getBillEventsBetween, getCurrentCycleId } from './forecasting';
import { formatDate, timeAgo } from './dates';
import {
  getSavingsGoalProgress,
  normalizeSavingsGoals,
  savingsGoalsForScope,
} from './savingsGoals';

export const DEFAULT_ANDROID_WIDGET_SETTINGS = {
  accountKey: null,
  profile: 'personal',
  showSpendingLeft: true,
  showNextBill: true,
  showSavingsGoal: true,
};

const WIDGET_STORAGE_NOTE = 'nova_android_widgets';
let syncTimer = null;

function normalizeProfile(profile) {
  return ['household', 'personal', 'business'].includes(profile) ? profile : 'personal';
}

function accountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

function activeAccounts(state = {}) {
  const registry = Array.isArray(state.accountRegistry) ? state.accountRegistry : [];
  const registryAccounts = registry
    .filter(account => account && account.isActive !== false)
    .map(account => ({
      key: accountKey(account),
      id: account.id,
      legacyKey: account.legacyKey,
      label: account.name || account.id || account.legacyKey,
      role: account.role || 'personal',
      type: account.type || 'checking',
    }))
    .filter(account => account.key);
  if (registryAccounts.length > 0) return registryAccounts;
  return Object.keys(state.accounts || {}).map(key => ({
    key,
    id: key,
    legacyKey: key,
    label: key,
    role: key.toLowerCase().includes('joint') ? 'household' : 'personal',
    type: key.toLowerCase().includes('saving') ? 'savings' : 'checking',
  }));
}

export function resolveAndroidWidgetSettings(novaConfig = {}) {
  return {
    ...DEFAULT_ANDROID_WIDGET_SETTINGS,
    ...(novaConfig?.widgetSettings || {}),
    profile: normalizeProfile(novaConfig?.widgetSettings?.profile),
  };
}

export function resolveWidgetAccount(state = {}, explicitAccountKey = null) {
  const settings = resolveAndroidWidgetSettings(state.novaConfig);
  const accounts = activeAccounts(state);
  const requested = explicitAccountKey || settings.accountKey;
  const configured = accounts.find(account => account.key === requested || account.id === requested || account.legacyKey === requested);
  if (configured) return configured;

  const preferredRole = normalizeProfile(
    settings.profile || (state.novaConfig?.userMode === 'partnered' ? 'household' : 'personal')
  );
  return accounts.find(account => account.role === preferredRole)
    || accounts.find(account => account.role === 'personal')
    || accounts[0]
    || null;
}

function spendingSnapshot(state, account, profile) {
  if (!account) {
    const profileData = state.varianceCache?.[profile] || {};
    return {
      amountCents: profileData.variance || 0,
      state: profileData.state === 'red' ? 'danger' : profileData.state === 'yellow' ? 'warning' : 'good',
      label: 'Projected this cycle',
    };
  }

  const balance = Math.trunc(state.accounts?.[account.key] || 0);
  const floor = Math.trunc(state.accountFloors?.[account.key] ?? state.accountFloors?.others ?? 0);
  const amountCents = balance - floor;
  const stateLabel = amountCents < 0 ? 'danger' : amountCents <= Math.max(1000, Math.floor(floor * 0.2)) ? 'warning' : 'good';
  return {
    amountCents,
    state: stateLabel,
    label: floor > 0 ? 'Above account floor' : 'Account balance',
  };
}

function billAccountKey(bill) {
  return bill?.defaultAccountKey || bill?.accountKey || null;
}

function keyBelongsToAccount(key, account) {
  return account && key && (key === account.key || key === account.id || key === account.legacyKey);
}

function billEventsForWidget(state, account) {
  const now = Date.now();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 45);
  end.setHours(23, 59, 59, 999);

  const allBills = [
    ...(state.householdBills || []).map(bill => ({ ...bill, profile: 'household' })),
    ...(state.personalBills || []).map(bill => ({ ...bill, profile: 'personal' })),
  ];
  const scopedBills = account
    ? allBills.filter(bill => !billAccountKey(bill) || keyBelongsToAccount(billAccountKey(bill), account))
    : allBills;
  const billSource = scopedBills.length > 0 ? scopedBills : allBills;
  return getBillEventsBetween(billSource, start.getTime(), end.getTime())
    .sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
}

function daysUntilLabel(dateMs) {
  if (!dateMs) return 'No due date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateMs);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days} days`;
  return `Due ${formatDate(dateMs).replace(`, ${target.getFullYear()}`, '')}`;
}

function savingsSnapshot(state, account, profile) {
  const goals = normalizeSavingsGoals(state.novaConfig?.savingsGoals, state.novaConfig?.savingsGoal);
  const scoped = savingsGoalsForScope(goals, profile);
  const candidates = account
    ? scoped.filter(goal => keyBelongsToAccount(goal.accountId || goal.accountKey, account))
    : scoped;
  const goal = (candidates.length > 0 ? candidates : scoped.length > 0 ? scoped : goals)
    .filter(item => item && item.isActive !== false)
    .sort((a, b) => {
      const progressA = getSavingsGoalProgress(a, state.accounts, state.accountRegistry);
      const progressB = getSavingsGoalProgress(b, state.accounts, state.accountRegistry);
      return progressB.percent - progressA.percent;
    })[0];
  if (!goal) {
    return {
      name: 'No savings goal',
      percentLabel: '0%',
      amountLabel: 'Add a goal in Settings',
      progressPercent: 0,
    };
  }
  const progress = getSavingsGoalProgress(goal, state.accounts, state.accountRegistry);
  return {
    name: goal.label || 'Savings goal',
    percentLabel: `${progress.percent}%`,
    amountLabel: `${formatCentsShort(progress.currentCents)} of ${formatCentsShort(progress.targetCents)}`,
    progressPercent: progress.percent,
  };
}

function recordUrl(accountKeyValue) {
  const params = [`source=android_widget`];
  if (accountKeyValue) params.push(`accountKey=${encodeURIComponent(accountKeyValue)}`);
  const query = `?${params.join('&')}`;
  return `nova://record-transaction${query}`;
}

export function buildAndroidWidgetSnapshot(state = {}) {
  const settings = resolveAndroidWidgetSettings(state.novaConfig);
  const account = resolveWidgetAccount(state);
  const profile = normalizeProfile(account?.role || settings.profile);
  const spending = spendingSnapshot(state, account, profile);
  const events = billEventsForWidget(state, account);
  const nextBill = events[0] || null;
  const savings = savingsSnapshot(state, account, profile);
  const cycleId = getCurrentCycleId(Date.now());
  const updatedAt = Date.now();

  return {
    storage: WIDGET_STORAGE_NOTE,
    cycleId,
    profile,
    accountKey: account?.key || null,
    accountName: account?.label || `${profile[0].toUpperCase()}${profile.slice(1)} budget`,
    showSpendingLeft: settings.showSpendingLeft !== false,
    showNextBill: settings.showNextBill !== false,
    showSavingsGoal: settings.showSavingsGoal !== false,
    spendingLeftAmount: settings.showSpendingLeft === false ? '--' : formatCentsShort(spending.amountCents),
    spendingLeftCents: spending.amountCents,
    spendingLeftState: spending.state,
    spendingLeftLabel: spending.label,
    nextBillName: settings.showNextBill === false ? 'Bill widget disabled' : nextBill?.billName || 'No bills due',
    nextBillAmount: settings.showNextBill === false ? '--' : formatCentsShort(nextBill?.amountCents || 0),
    nextBillDueLabel: settings.showNextBill === false ? 'Enable in Settings' : nextBill ? daysUntilLabel(nextBill.dateMs) : 'All clear',
    nextBillMeta: nextBill ? `${formatCentsShort(spending.amountCents)} left after floor` : 'No scheduled bill found in the next 45 days',
    savingsGoalName: settings.showSavingsGoal === false ? 'Savings hidden' : savings.name,
    savingsGoalPercentLabel: settings.showSavingsGoal === false ? '--' : savings.percentLabel,
    savingsGoalAmountLabel: settings.showSavingsGoal === false ? 'Enable in Settings' : savings.amountLabel,
    savingsGoalProgressPercent: settings.showSavingsGoal === false ? 0 : savings.progressPercent,
    recordUrl: recordUrl(account?.key || settings.accountKey),
    updatedAt,
    updatedLabel: `Updated ${timeAgo(updatedAt)}`,
  };
}

export async function syncAndroidWidgets(state = {}) {
  if (Platform.OS !== 'android') return false;
  const module = NativeModules.NovaWidgetModule;
  if (!module || typeof module.updateWidgetData !== 'function') return false;
  const snapshot = buildAndroidWidgetSnapshot(state);
  await module.updateWidgetData(JSON.stringify(snapshot));
  return true;
}

export function scheduleAndroidWidgetSync(state = {}, delayMs = 600) {
  if (Platform.OS !== 'android') return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncAndroidWidgets(state).catch(() => {});
  }, delayMs);
}
