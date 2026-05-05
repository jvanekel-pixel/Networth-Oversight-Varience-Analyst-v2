import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BadgeMedal, { BADGE_TIER_STYLES } from '../components/badges/BadgeMedal';
import BadgeDetailModal from '../components/badges/BadgeDetailModal';
import theme from '../config/theme.config';
import { TIERED_BADGES, TIER_ORDER } from '../config/badges.config';
import useStore from '../store/useStore';

const TIER_LABELS = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  platinum: 'PLATINUM',
  onyx: 'ONYX',
};

function getBadgeState(badgeState, badgeId) {
  return badgeState?.[badgeId] || { tier: null, values: { v1: 0, v2: 0, v3: 0 }, progress: {} };
}

function getNextTierDef(badge, tier) {
  if (tier === 'onyx') return badge.tiers[badge.tiers.length - 1];
  const currentIndex = tier ? TIER_ORDER.indexOf(tier) : -1;
  return badge.tiers[Math.min(currentIndex + 1, badge.tiers.length - 1)];
}

function getProgressRatio(state, targetTierDef) {
  const values = state?.values || {};
  if (!targetTierDef) return 0;
  const ratios = ['v1', 'v2', 'v3'].map(key => {
    const required = targetTierDef[key] || 0;
    if (required <= 0) return 1;
    return Math.max(0, Math.min(1, (values[key] || 0) / required));
  });
  return Math.min(...ratios);
}

function formatValue(value, unit) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (unit === 'dollars') return `$${Math.floor(safeValue).toLocaleString()}`;
  if (unit === '%') return `${Math.floor(safeValue)}%`;
  if (unit === 'XP') return `${Math.floor(safeValue).toLocaleString()} XP`;
  return Math.floor(safeValue).toLocaleString();
}

function formatGap(current, required, unit) {
  const gap = Math.max(0, (required || 0) - (current || 0));
  if (gap <= 0) return 'MET';
  if (unit === 'dollars') return `$${Math.ceil(gap).toLocaleString()} MORE`;
  if (unit === '%') return `${Math.ceil(gap)}% MORE`;
  if (unit === 'XP') return `${Math.ceil(gap).toLocaleString()} XP MORE`;
  return `${Math.ceil(gap).toLocaleString()} MORE`;
}

function BadgeProgressRow({ label, unit, current, required }) {
  const ratio = required > 0 ? Math.max(0, Math.min(1, current / required)) : 1;
  const met = current >= required;

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressMeta, met && styles.progressMetaMet]}>
          {formatValue(current, unit)} / {formatValue(required, unit)}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.floor(ratio * 100)}%` }, met && styles.progressFillMet]} />
      </View>
      <Text style={[styles.gapText, met && styles.gapTextMet]}>{formatGap(current, required, unit)}</Text>
    </View>
  );
}

function TierRail({ tier }) {
  const earnedIndex = tier ? TIER_ORDER.indexOf(tier) : -1;

  return (
    <View style={styles.tierRail}>
      {TIER_ORDER.map((tierKey, index) => {
        const active = index <= earnedIndex;
        const palette = BADGE_TIER_STYLES[tierKey];
        return (
          <View key={tierKey} style={styles.tierChipWrap}>
            <View
              style={[
                styles.tierChip,
                { borderColor: active ? palette.trim : theme.borderColorDim },
                active && { backgroundColor: palette.shell },
              ]}
            />
            <Text style={[styles.tierChipText, active && { color: palette.accent }]}>
              {TIER_LABELS[tierKey].slice(0, 2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function BadgeShowcaseScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const badgeState = useStore((s) => s.badgeState);
  const xpTotal = useStore((s) => s.xpTotal);
  const weeklyActive = useStore((s) => s.streakData?.weeklyActive);
  const entrepreneurMode = useStore((s) => s.novaConfig?.entrepreneurMode);
  const [selectedId, setSelectedId] = useState(null);

  const gridGap = 6;
  const gridWidth = Math.max(280, width - theme.spacingMD * 2);
  const medalSize = Math.max(50, Math.min(72, Math.floor((gridWidth - gridGap * 4) / 5)));

  const earnedCount = useMemo(
    () => TIERED_BADGES.filter(badge => getBadgeState(badgeState, badge.id).tier).length,
    [badgeState],
  );

  const selectedBadge = selectedId
    ? TIERED_BADGES.find(badge => badge.id === selectedId)
    : null;
  const selectedState = selectedBadge ? getBadgeState(badgeState, selectedBadge.id) : null;
  const selectedTarget = selectedBadge ? getNextTierDef(selectedBadge, selectedState?.tier) : null;
  const selectedProgress = selectedTarget && selectedState
    ? selectedState.progress?.[selectedTarget.tier] || {
      v1: { current: selectedState.values?.v1 || 0, required: selectedTarget.v1 },
      v2: { current: selectedState.values?.v2 || 0, required: selectedTarget.v2 },
      v3: { current: selectedState.values?.v3 || 0, required: selectedTarget.v3 },
    }
    : null;
  const selectedRatio = selectedState && selectedTarget ? getProgressRatio(selectedState, selectedTarget) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <Text style={styles.backText}>BACK</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.screenTitle}>BADGE VAULT</Text>
            <Text style={styles.screenSubtitle}>{earnedCount}/10 active medals</Text>
          </View>
        </View>

        <View style={styles.summaryBand}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL XP</Text>
            <Text style={styles.summaryValue}>{xpTotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryLabel}>WEEK STREAK</Text>
            <Text style={styles.summaryValue}>{weeklyActive?.current || 0}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryLabel}>BEST</Text>
            <Text style={styles.summaryValue}>{weeklyActive?.best || 0}</Text>
          </View>
        </View>

        <View style={[styles.badgeGrid, { gap: gridGap }]}>
          {TIERED_BADGES.map((badge) => {
            const state = getBadgeState(badgeState, badge.id);
            const target = getNextTierDef(badge, state.tier);
            const progress = state.tier === 'onyx' ? 1 : getProgressRatio(state, target);
            const disabledByMode = badge.entrepreneurOnly && !entrepreneurMode;

            return (
              <TouchableOpacity
                key={badge.id}
                style={[styles.badgeCell, { width: medalSize }, disabledByMode && styles.badgeCellMuted]}
                onPress={() => setSelectedId(badge.id)}
                activeOpacity={0.72}
                accessibilityLabel={`${badge.name} badge`}
              >
                <BadgeMedal
                  badgeId={badge.id}
                  tier={state.tier}
                  size={medalSize}
                  progress={state.tier === 'onyx' ? 1 : progress}
                  completed={state.tier === 'onyx'}
                />
                <Text style={styles.badgeName} numberOfLines={2}>{badge.name.toUpperCase()}</Text>
                <Text style={styles.badgeTier} numberOfLines={1}>
                  {state.tier ? TIER_LABELS[state.tier] : disabledByMode ? 'OFFLINE' : `${Math.floor(progress * 100)}%`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <BadgeDetailModal
        visible={!!selectedBadge}
        badge={selectedBadge}
        state={selectedState}
        entrepreneurMode={entrepreneurMode}
        onClose={() => setSelectedId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020207',
  },
  content: {
    padding: theme.spacingMD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  backText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  headerCopy: {
    flex: 1,
  },
  screenTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  screenSubtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  summaryBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingMD,
    marginBottom: theme.spacingLG,
  },
  summaryLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    letterSpacing: 1,
  },
  summaryValue: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeLG,
    fontWeight: 'bold',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.borderColorDim,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeCell: {
    alignItems: 'center',
    minHeight: 112,
    marginBottom: theme.spacingMD,
  },
  badgeCellMuted: {
    opacity: 0.58,
  },
  badgeName: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 10,
    minHeight: 20,
  },
  badgeTier: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacingMD,
  },
  detailPanel: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: '#060713',
    padding: theme.spacingLG,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  detailCopy: {
    flex: 1,
  },
  detailTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  detailTagline: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingXS,
  },
  detailTier: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginTop: theme.spacingSM,
  },
  tierRail: {
    flexDirection: 'row',
    gap: theme.spacingXS,
    marginTop: theme.spacingSM,
  },
  tierChipWrap: {
    alignItems: 'center',
  },
  tierChip: {
    width: 16,
    height: 7,
    borderWidth: 1,
    borderRadius: 2,
    backgroundColor: theme.backgroundPanel,
  },
  tierChipText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: 7,
    marginTop: 2,
  },
  nextTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingTop: theme.spacingMD,
    marginBottom: theme.spacingSM,
  },
  nextTierLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  nextTierPct: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  progressRow: {
    marginTop: theme.spacingSM,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  progressLabel: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  progressMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    textAlign: 'right',
  },
  progressMetaMet: {
    color: theme.accent,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.backgroundPanel,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.borderColor,
  },
  progressFillMet: {
    backgroundColor: theme.accent,
  },
  gapText: {
    color: theme.textDim,
    fontSize: 9,
    fontFamily: theme.fontPrimary,
    marginTop: 3,
    textAlign: 'right',
  },
  gapTextMet: {
    color: theme.accent,
  },
  modeNote: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginTop: theme.spacingLG,
  },
  closeText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
});
