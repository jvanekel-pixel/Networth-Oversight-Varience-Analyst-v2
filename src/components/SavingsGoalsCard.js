import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../config/theme.config';
import { formatCentsShort } from '../utils/currency';
import {
  getSavingsGoalProgress,
  savingsGoalsForScope,
} from '../utils/savingsGoals';

function formatTargetDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SavingsGoalsCard({
  goals = [],
  accounts = {},
  accountRegistry = [],
  scope = null,
  title = 'SAVINGS GOALS',
  emptyText = 'No savings goals yet.',
  onPress,
}) {
  const visibleGoals = savingsGoalsForScope(goals, scope);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>{title}</Text>
        <Text style={styles.countText}>{visibleGoals.length}</Text>
      </View>
      {visibleGoals.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : visibleGoals.map(goal => {
        const progress = getSavingsGoalProgress(goal, accounts, accountRegistry);
        const targetDate = formatTargetDate(goal.targetDate);
        const monthly = goal.monthlyContributionCents || 0;
        return (
          <TouchableOpacity
            key={goal.id}
            style={[styles.goalRow, progress.complete && styles.goalRowComplete]}
            onPress={onPress ? () => onPress(goal) : undefined}
            activeOpacity={onPress ? 0.8 : 1}
          >
            <View style={styles.goalTopRow}>
              <View style={styles.goalTitleBlock}>
                <Text style={styles.goalLabel} numberOfLines={1}>{goal.label || 'Savings Goal'}</Text>
                <Text style={styles.goalMeta} numberOfLines={1}>
                  {progress.accountDisplayName || 'No linked account'}
                  {targetDate ? ` / ${targetDate}` : ''}
                </Text>
              </View>
              <Text style={[styles.percentText, progress.complete && styles.completeText]}>
                {progress.percent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(0, progress.percent)}%` },
                  progress.complete && styles.completeFill,
                ]}
              />
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountText}>
                {formatCentsShort(progress.currentCents)} / {formatCentsShort(progress.targetCents)}
              </Text>
              <Text style={styles.amountText}>
                {monthly > 0 ? `${formatCentsShort(monthly)}/mo` : `${formatCentsShort(progress.remainingCents)} left`}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacingSM,
  },
  cardLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  countText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  emptyText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  goalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingTop: theme.spacingSM,
    marginTop: theme.spacingSM,
  },
  goalRowComplete: {
    borderTopColor: theme.statusPositive,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
  },
  goalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  goalLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  goalMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  percentText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  completeText: {
    color: theme.statusPositive,
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.backgroundPanel,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  completeFill: {
    backgroundColor: theme.statusPositive,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
  },
  amountText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
});
