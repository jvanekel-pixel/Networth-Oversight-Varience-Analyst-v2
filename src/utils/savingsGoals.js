export const SAVINGS_GOALS_CARD_ID = 'savings_goals';
export const LEGACY_SAVINGS_GOAL_CARD_ID = 'savings_goal';

export const SAVINGS_GOAL_SCOPES = [
  { key: 'personal', label: 'Personal' },
  { key: 'household', label: 'Household' },
  { key: 'business', label: 'Business' },
];

export const SAVINGS_GOAL_PRESETS = [
  { key: 'emergency', label: 'Emergency Fund', targetCents: 100000 },
  { key: 'christmas', label: 'Christmas', targetCents: 120000 },
  { key: 'car_repair', label: 'Car Repair', targetCents: 150000 },
  { key: 'vacation', label: 'Vacation', targetCents: 250000 },
  { key: 'taxes', label: 'Taxes', targetCents: 300000 },
  { key: 'buffer', label: '3-Month Buffer', targetCents: 500000 },
  { key: 'down_payment', label: 'Down Payment', targetCents: 2000000 },
  { key: 'custom', label: 'Custom Goal', targetCents: 0 },
];

function cleanScope(scope) {
  return SAVINGS_GOAL_SCOPES.some(item => item.key === scope) ? scope : 'personal';
}

function cleanCents(value) {
  const n = Math.trunc(Number(value || 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function normalizeSavingsGoal(goal = {}, fallback = {}) {
  goal = goal || {};
  fallback = fallback || {};
  const now = Date.now();
  const preset = SAVINGS_GOAL_PRESETS.find(item => item.key === goal.key);
  const label = String(goal.label || preset?.label || fallback.label || 'Savings Goal').trim();
  const targetCents = cleanCents(goal.targetCents ?? goal.amountCents ?? preset?.targetCents ?? fallback.targetCents);
  const accountId = goal.accountId || goal.accountKey || fallback.accountId || null;
  const hasManualCurrent = goal.currentCents !== undefined || goal.savedCents !== undefined || fallback.currentCents !== undefined;
  return {
    id: goal.id || fallback.id || `goal_${now}_${Math.random().toString(36).slice(2, 7)}`,
    key: goal.key || fallback.key || (preset?.key ?? 'custom'),
    label,
    targetCents,
    currentCents: hasManualCurrent ? cleanCents(goal.currentCents ?? goal.savedCents ?? fallback.currentCents) : null,
    monthlyContributionCents: cleanCents(goal.monthlyContributionCents ?? goal.monthlyCents ?? fallback.monthlyContributionCents),
    targetDate: goal.targetDate || fallback.targetDate || null,
    accountId,
    scope: cleanScope(goal.scope || goal.profile || goal.homepage || fallback.scope),
    isActive: goal.isActive !== false,
    createdAt: goal.createdAt || fallback.createdAt || now,
    updatedAt: goal.updatedAt || now,
  };
}

export function normalizeSavingsGoals(goals, legacyGoal = null) {
  const rawGoals = Array.isArray(goals) ? goals : [];
  const normalized = rawGoals
    .filter(goal => goal && goal.isActive !== false && ((goal.targetCents || goal.amountCents || 0) > 0 || goal.label))
    .map(goal => normalizeSavingsGoal(goal))
    .filter(goal => goal.targetCents > 0 || goal.label);

  const legacyHasValue = legacyGoal?.targetCents > 0 || legacyGoal?.label || legacyGoal?.accountId;
  if (normalized.length === 0 && legacyHasValue) {
    return [normalizeSavingsGoal({
      ...legacyGoal,
      id: legacyGoal.id || 'goal_legacy_savings',
      scope: legacyGoal.scope || 'personal',
      currentCents: legacyGoal.currentCents,
    })];
  }
  return normalized;
}

export function accountKeyForSavingsGoal(goal) {
  return goal?.accountId || goal?.accountKey || null;
}

export function accountForSavingsGoal(goal, accountRegistry = []) {
  const key = accountKeyForSavingsGoal(goal);
  if (!key) return null;
  return (accountRegistry || []).find(account =>
    account && account.isActive !== false && (account.id === key || account.legacyKey === key)
  ) || null;
}

export function accountDisplayNameForSavingsGoal(goal, accountRegistry = []) {
  const account = accountForSavingsGoal(goal, accountRegistry);
  return account ? (account.name || account.id) : accountKeyForSavingsGoal(goal);
}

export function getSavingsGoalProgress(goal, accounts = {}, accountRegistry = []) {
  const account = accountForSavingsGoal(goal, accountRegistry);
  const accountKey = account ? (account.legacyKey || account.id) : accountKeyForSavingsGoal(goal);
  const linkedBalance = accountKey ? (accounts?.[accountKey] || 0) : null;
  const hasManualProgress = goal?.currentCents !== null && goal?.currentCents !== undefined && Number.isFinite(Number(goal.currentCents));
  const currentCents = hasManualProgress ? cleanCents(goal.currentCents) : Math.max(0, linkedBalance || 0);
  const targetCents = cleanCents(goal?.targetCents);
  const percent = targetCents > 0 ? Math.min(100, Math.floor((currentCents / targetCents) * 100)) : 0;
  return {
    accountKey,
    accountDisplayName: account ? (account.name || account.id) : accountKey,
    currentCents,
    targetCents,
    remainingCents: Math.max(0, targetCents - currentCents),
    percent,
    complete: targetCents > 0 && currentCents >= targetCents,
  };
}

export function savingsGoalsForScope(goals = [], scope = null) {
  const active = normalizeSavingsGoals(goals).filter(goal => goal.isActive !== false);
  if (!scope) return active;
  return active.filter(goal => cleanScope(goal.scope) === scope);
}

export function normalizeCardOrderIds(order = []) {
  const seen = new Set();
  return (order || [])
    .map(id => id === LEGACY_SAVINGS_GOAL_CARD_ID ? SAVINGS_GOALS_CARD_ID : id)
    .filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}
