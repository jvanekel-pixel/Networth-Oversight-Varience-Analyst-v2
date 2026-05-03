import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import { formatCentsShort } from '../utils/currency';

export default function SavingsGoalCard({ goalLabel, targetCents, currentCents, accountDisplayName }) {
  if (!targetCents || targetCents <= 0) {
    return null;
  }

  const hasLinkedAccount = currentCents !== null && currentCents !== undefined;
  const progress = hasLinkedAccount ? Math.max(0, Math.min(1, currentCents / targetCents)) : 0;
  const percent = Math.floor(progress * 100);
  const isComplete = hasLinkedAccount && progress >= 1;

  return (
    <View style={[styles.card, isComplete && styles.completeCard]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>{personality.savingsGoal.cardLabel}</Text>
        {hasLinkedAccount && (
          <Text style={[styles.percentText, isComplete && styles.completeText]}>{percent}%</Text>
        )}
      </View>
      <Text style={styles.goalLabel}>{goalLabel || personality.savingsGoal.defaultLabel}</Text>
      <Text style={styles.amountText}>{formatCentsShort(targetCents)}</Text>
      {!hasLinkedAccount ? (
        <Text style={styles.linkPrompt}>{personality.savingsGoal.linkPrompt}</Text>
      ) : (
        <>
          <Text style={styles.accountText}>{accountDisplayName}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${isComplete ? 100 : percent}%` }, isComplete && styles.completeFill]} />
          </View>
          <Text style={styles.amountText}>
            {formatCentsShort(currentCents)} / {formatCentsShort(targetCents)}
          </Text>
          {isComplete && <Text style={styles.completeText}>{personality.savingsGoal.reachedCopy}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.backgroundCard, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, marginBottom: theme.spacingMD },
  completeCard: { borderColor: theme.statusPositive, backgroundColor: theme.statusPositiveBg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacingXS },
  cardLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1 },
  goalLabel: { color: theme.textPrimary, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: 2 },
  accountText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginBottom: theme.spacingSM },
  progressTrack: { height: 8, backgroundColor: theme.backgroundPanel, borderRadius: 4, overflow: 'hidden', marginBottom: theme.spacingSM },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: theme.accent },
  completeFill: { backgroundColor: theme.statusPositive },
  amountText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  linkPrompt: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: theme.spacingSM },
  percentText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  completeText: { color: theme.statusPositive, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: theme.spacingXS },
});
