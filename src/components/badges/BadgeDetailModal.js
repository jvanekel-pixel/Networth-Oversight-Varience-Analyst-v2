import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import theme from '../../config/theme.config';
import { TIER_ORDER } from '../../config/badges.config';
import BadgeMedal, { BADGE_TIER_STYLES } from './BadgeMedal';

export const TIER_LABELS = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  platinum: 'PLATINUM',
  onyx: 'ONYX',
};

export function getNextTierDef(badge, tier) {
  if (!badge) return null;
  if (tier === 'onyx') return badge.tiers[badge.tiers.length - 1];
  const currentIndex = tier ? TIER_ORDER.indexOf(tier) : -1;
  return badge.tiers[Math.min(currentIndex + 1, badge.tiers.length - 1)];
}

export function getProgressRatio(state, targetTierDef) {
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

function formatCompact(value, unit) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (unit === 'dollars') return `$${Math.floor(safeValue).toLocaleString()}`;
  if (unit === '%') return `${Math.floor(safeValue)}%`;
  if (unit === 'XP') return `${Math.floor(safeValue).toLocaleString()}`;
  return Math.floor(safeValue).toLocaleString();
}

function isTierEarned(currentTier, tier) {
  if (!currentTier) return false;
  return TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(tier);
}

function tierProgress(state, tierDef) {
  const progress = state?.progress?.[tierDef.tier];
  if (progress) return progress;
  return {
    v1: { current: state?.values?.v1 || 0, required: tierDef.v1, met: (state?.values?.v1 || 0) >= tierDef.v1 },
    v2: { current: state?.values?.v2 || 0, required: tierDef.v2, met: (state?.values?.v2 || 0) >= tierDef.v2 },
    v3: { current: state?.values?.v3 || 0, required: tierDef.v3, met: (state?.values?.v3 || 0) >= tierDef.v3 },
  };
}

function TierRequirement({ badge, tierDef, state }) {
  const earned = isTierEarned(state?.tier, tierDef.tier);
  const progress = tierProgress(state, tierDef);
  const palette = BADGE_TIER_STYLES[tierDef.tier] || BADGE_TIER_STYLES.locked;
  const metrics = ['v1', 'v2', 'v3'];

  return (
    <View style={[styles.tierRequirement, earned && { borderColor: palette.trim }]}>
      <View style={styles.tierMedalWrap}>
        <BadgeMedal
          badgeId={badge.id}
          tier={earned ? tierDef.tier : null}
          size={46}
          progress={earned ? 1 : getProgressRatio(state, tierDef)}
          completed={earned}
          showLock={false}
        />
      </View>
      <View style={styles.tierReqCopy}>
        <View style={styles.tierReqHeader}>
          <Text style={[styles.tierReqTitle, earned && { color: palette.accent }]}>
            {TIER_LABELS[tierDef.tier]}
          </Text>
          <Text style={[styles.tierReqState, earned && { color: palette.accent }]}>
            {earned ? 'UNLOCKED' : `${Math.floor(getProgressRatio(state, tierDef) * 100)}%`}
          </Text>
        </View>
        {metrics.map((metricKey) => {
          const metric = progress[metricKey];
          const varDef = badge.vars[metricKey];
          return (
            <View key={metricKey} style={styles.metricLine}>
              <Text style={styles.metricLabel} numberOfLines={1}>{varDef.label}</Text>
              <Text style={[styles.metricValue, metric.met && styles.metricValueMet]}>
                {formatCompact(metric.current, varDef.unit)} / {formatCompact(metric.required, varDef.unit)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function BadgeDetailModal({
  badge,
  state,
  visible,
  onClose,
  entrepreneurMode = true,
}) {
  if (!badge || !state) return null;

  const target = getNextTierDef(badge, state.tier);
  const ratio = state.tier === 'onyx' ? 1 : getProgressRatio(state, target);
  const palette = BADGE_TIER_STYLES[state.tier || 'locked'] || BADGE_TIER_STYLES.locked;
  const disabledByMode = badge.entrepreneurOnly && !entrepreneurMode;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topMedalWrap}>
              <BadgeMedal
                badgeId={badge.id}
                tier={state.tier}
                size={122}
                progress={ratio}
                completed={state.tier === 'onyx'}
                showLock={false}
              />
            </View>

            <Text style={styles.currentValue}>
              {target ? `${Math.floor(ratio * 100)}%` : '0%'}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.floor(ratio * 100)}%`, backgroundColor: palette.accent }]} />
            </View>

            <Text style={styles.title}>{badge.name}</Text>
            <Text style={styles.tagline}>{badge.tagline}</Text>
            <Text style={styles.status}>
              {disabledByMode ? 'OFFLINE' : state.tier ? TIER_LABELS[state.tier] : 'LOCKED'}
            </Text>

            <View style={styles.currentStats}>
              {['v1', 'v2', 'v3'].map(key => (
                <View key={key} style={styles.currentStat}>
                  <Text style={styles.currentStatValue}>
                    {formatValue(state.values?.[key] || 0, badge.vars[key].unit)}
                  </Text>
                  <Text style={styles.currentStatLabel} numberOfLines={2}>{badge.vars[key].label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>AVAILABLE TIERS</Text>
            {badge.tiers.map(tierDef => (
              <TierRequirement
                key={tierDef.tier}
                badge={badge}
                tierDef={tierDef}
                state={state}
              />
            ))}

            {disabledByMode ? (
              <Text style={styles.modeNote}>Turn on Business Mode to progress this badge.</Text>
            ) : null}

            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacingMD,
  },
  panel: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#6670B8',
    borderRadius: theme.borderRadiusMD,
    backgroundColor: 'rgba(8, 9, 25, 0.96)',
    overflow: 'hidden',
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    padding: theme.spacingLG,
    alignItems: 'center',
  },
  topMedalWrap: {
    marginTop: -2,
    marginBottom: theme.spacingXS,
  },
  currentValue: {
    color: '#FF4EA3',
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
  },
  progressTrack: {
    width: '72%',
    height: 2,
    backgroundColor: 'rgba(255,78,163,0.22)',
    marginTop: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  progressFill: {
    height: 2,
  },
  title: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeLG,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tagline: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: theme.spacingXS,
  },
  status: {
    color: '#AAB3FF',
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: theme.spacingSM,
  },
  currentStats: {
    width: '100%',
    flexDirection: 'row',
    gap: theme.spacingXS,
    marginTop: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  currentStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: 'rgba(4, 5, 14, 0.86)',
    padding: theme.spacingSM,
    minHeight: 72,
  },
  currentStatValue: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
  },
  currentStatLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 4,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingSM,
  },
  tierRequirement: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: 'rgba(5, 6, 18, 0.82)',
    padding: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  tierMedalWrap: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacingSM,
  },
  tierReqCopy: {
    flex: 1,
  },
  tierReqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacingXS,
  },
  tierReqTitle: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  tierReqState: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  metricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    minHeight: 18,
  },
  metricLabel: {
    flex: 1,
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: 9,
  },
  metricValue: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: 9,
    textAlign: 'right',
  },
  metricValueMet: {
    color: theme.accent,
  },
  modeNote: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: theme.spacingXS,
    textAlign: 'center',
  },
  doneBtn: {
    width: '48%',
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: 'rgba(179,108,255,0.32)',
    paddingVertical: theme.spacingSM,
    alignItems: 'center',
    marginTop: theme.spacingSM,
  },
  doneText: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
});
