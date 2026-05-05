import { TIERED_BADGES, TIER_ORDER } from '../config/badges.config';
import { getSavingsGoalProgress, normalizeSavingsGoals } from './savingsGoals';

// ─────────────────────────────────────────────────────────────────────────────
// Value extractors
// Each badge's three variables are extracted from the combined inputs.
// All extractors are pure — no side effects.
// ─────────────────────────────────────────────────────────────────────────────

function getSavingsGoalPercent(accounts, novaConfig, accountRegistry = []) {
  const goals = normalizeSavingsGoals(novaConfig?.savingsGoals, novaConfig?.savingsGoal);
  if (goals.length === 0) return 0;
  return Math.max(...goals.map(goal => getSavingsGoalProgress(goal, accounts, accountRegistry).percent));
}

function getPaycheckSplitCoveragePercent(novaConfig, incomeEvents) {
  const splits = (novaConfig?.paycheckSplits || []).filter(s => (s.amountCents || 0) > 0);
  if (splits.length === 0) return 0;
  const paycheckAmt = incomeEvents?.paycheckAmountCents || incomeEvents?.paycheckAmount || 0;
  if (!paycheckAmt) return splits.length > 0 ? 1 : 0;
  const totalSplit = splits.reduce((sum, s) => sum + (s.amountCents || 0), 0);
  return Math.min(100, Math.floor((totalSplit / paycheckAmt) * 100));
}

// Count how many weeks in weeklyXPCategories have 3+ distinct categories
// This is also tracked monotonically as crossCategoryWeeksTotal but we verify here
function getCrossCategoryWeeks(actionCounts) {
  // Prefer the monotone running counter (accurate across the full history)
  return actionCounts.crossCategoryWeeksTotal || 0;
}

// Extract all three variable values for a given badge
function extractValues(badgeId, { actionCounts, xpTotal, streakData, accounts, novaConfig, incomeEvents, accountRegistry }) {
  const ac = actionCounts || {};
  const sd = streakData || {};
  const xpCat = ac.xpByCategory || {};

  switch (badgeId) {
    case 'payday_oracle':
      return {
        v1: ac.paycheckConfirmedSameDay || 0,
        v2: xpCat.income || 0,
        v3: sd.paydayStreak?.consecutiveOnTime || 0,
      };

    case 'vault_guardian':
      return {
        v1: ac.savingsDeposits || 0,
        v2: xpCat.savings || 0,
        v3: getSavingsGoalPercent(accounts, novaConfig, accountRegistry),
      };

    case 'bill_slayer':
      return {
        v1: ac.billsPaidOnTime || 0,
        v2: xpCat.bills || 0,
        v3: ac.consecutiveOnTimeBillMonths || 0,
      };

    case 'grocery_sentinel':
      return {
        v1: ac.weeksUnderBudget || 0,
        v2: ac.groceryEntriesLogged || 0,
        v3: sd.groceryStreak?.current || 0,
      };

    case 'ledger_keeper':
      return {
        v1: ac.balanceConfirmations || 0,
        v2: xpCat.balance || 0,
        v3: (ac.confirmationWeekStarts || []).length,
      };

    case 'cycle_closer':
      return {
        v1: ac.cyclesCompleted || 0,
        v2: ac.bestCycleXP || 0,
        v3: ac.greenCycleEnds || 0,
      };

    case 'income_architect':
      return {
        v1: ac.paycheckConfirmedTotal || 0,
        v2: xpCat.savings || 0,
        v3: getPaycheckSplitCoveragePercent(novaConfig, incomeEvents),
      };

    case 'variance_analyst':
      return {
        v1: ac.balanceConfirmations || 0,
        v2: xpCat.balance || 0,
        v3: ac.yellowToGreenRecoveries || 0,
      };

    case 'entrepreneur':
      return {
        v1: ac.businessTransactions || 0,
        v2: Math.floor((ac.totalBusinessIncomeCents || 0) / 100), // cents → dollars
        v3: ac.completePLMonths || 0,
      };

    case 'nova_agent':
      return {
        v1: xpTotal || 0,
        v2: ac.totalActiveDays || 0,
        v3: getCrossCategoryWeeks(ac),
      };

    default:
      return { v1: 0, v2: 0, v3: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core evaluation
// Returns the highest tier where ALL THREE thresholds are met (or null if none).
// ─────────────────────────────────────────────────────────────────────────────

function evaluateTier(values, tiers) {
  let highestTier = null;
  for (const tierDef of tiers) {
    if (values.v1 >= tierDef.v1 && values.v2 >= tierDef.v2 && values.v3 >= tierDef.v3) {
      highestTier = tierDef.tier;
    } else {
      break; // tiers are in ascending order; once one fails, higher ones will too
    }
  }
  return highestTier;
}

// Build per-tier progress details for UI display
function buildProgress(values, tiers) {
  const progress = {};
  for (const tierDef of tiers) {
    progress[tierDef.tier] = {
      v1: { current: values.v1, required: tierDef.v1, met: values.v1 >= tierDef.v1 },
      v2: { current: values.v2, required: tierDef.v2, met: values.v2 >= tierDef.v2 },
      v3: { current: values.v3, required: tierDef.v3, met: values.v3 >= tierDef.v3 },
    };
  }
  return progress;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure function — no side effects. Called from recomputeVariance after every action.
 *
 * @param {object} params
 * @param {object} params.actionCounts
 * @param {number} params.xpTotal
 * @param {object} params.streakData
 * @param {object} params.accounts
 * @param {object} params.novaConfig
 * @param {object} params.incomeEvents
 * @param {boolean} [params.entrepreneurMode]
 *
 * @returns {{ [badgeId]: { tier: string|null, values: object, progress: object } }}
 */
export function evaluateBadges({ actionCounts, xpTotal, streakData, accounts, novaConfig, incomeEvents, accountRegistry, entrepreneurMode }) {
  const result = {};
  for (const badge of TIERED_BADGES) {
    // Entrepreneur badge only active when entrepreneurMode is on
    if (badge.entrepreneurOnly && !entrepreneurMode) {
      result[badge.id] = { tier: null, values: { v1: 0, v2: 0, v3: 0 }, progress: {} };
      continue;
    }
    const values = extractValues(badge.id, { actionCounts, xpTotal, streakData, accounts, novaConfig, incomeEvents, accountRegistry });
    const tier = evaluateTier(values, badge.tiers);
    const progress = buildProgress(values, badge.tiers);
    result[badge.id] = { tier, values, progress };
  }
  return result;
}

/**
 * Diff two badgeState snapshots and return list of newly-unlocked tier events.
 * @returns {{ badgeId: string, tier: string }[]}
 */
export function diffBadgeState(prevState, nextState) {
  const unlocks = [];
  for (const badgeId of Object.keys(nextState)) {
    const prev = prevState?.[badgeId]?.tier ?? null;
    const next = nextState[badgeId]?.tier ?? null;
    if (next && next !== prev) {
      // A tier was newly achieved (or advanced to a higher tier)
      const prevIndex = prev ? TIER_ORDER.indexOf(prev) : -1;
      const nextIndex = TIER_ORDER.indexOf(next);
      if (nextIndex > prevIndex) {
        unlocks.push({ badgeId, tier: next });
      }
    }
  }
  return unlocks;
}
