import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { getNovaStateLabel, pickNovaResponse } from '../utils/novaStateEngine';
import { NovaFace } from './NovaFace';

export { NovaFace };

export default function NovaHeader() {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());
  const {
    xpTotal,
    badgeState,
    streakData,
    currentFlavorText,
    currentNovaState,
    currentNovaFace,
    postPaydayActions,
    setNovaState,
  } = useStore();
  const badgeCount = Object.values(badgeState || {}).filter(state => state?.tier).length;
  const weeklyActive = streakData?.weeklyActive || {};

  const novaIsAntsy = (postPaydayActions || []).some(a => !a.completed && Date.now() < a.expiresAt);
  const effectiveFace = novaIsAntsy ? 'post_payday_antsy' : currentNovaFace;
  const stateLabel = novaIsAntsy ? getNovaStateLabel('post_payday_antsy') : getNovaStateLabel(currentNovaState);
  const personality = require('../config/personality.config').default;
  const antsynudge = novaIsAntsy
    ? personality.postPaydayNudges[Math.floor(Math.random() * personality.postPaydayNudges.length)]
    : null;
  const hasFlavorText = String(currentFlavorText || '').trim().length > 0;
  const fallbackResponse = useMemo(() => pickNovaResponse(currentNovaState || 'neutral', {
    eventType: currentNovaState === 'neutral' ? 'onboarding_complete' : null,
    snapshot: useStore.getState(),
    avoidFaceKey: currentNovaFace,
  }), [currentNovaFace, currentNovaState]);
  const displayFlavorText = hasFlavorText
    ? currentFlavorText
    : fallbackResponse?.text || 'NOVA online. The ledger is open. The numbers are about to tell me who we are today.';

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasFlavorText || !fallbackResponse?.text || !setNovaState) return;
    setNovaState({
      stateKey: fallbackResponse.stateKey || currentNovaState || 'neutral',
      faceKey: fallbackResponse.faceKey || currentNovaFace || 'neutral',
      text: fallbackResponse.text,
      timestamp: Date.now(),
    });
  }, [currentFlavorText, currentNovaFace, currentNovaState, fallbackResponse?.faceKey, fallbackResponse?.stateKey, fallbackResponse?.text, hasFlavorText, setNovaState]);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 8, theme.spacingMD) }]}>
      <View style={styles.topRow}>
        <Text style={styles.appName}>{theme.appName}</Text>
        <Text style={styles.datetime}>{timeStr}  {dateStr}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.subtitle}>{theme.appSubtitle}</Text>
      </View>

      <View style={styles.faceRow}>
        <View style={styles.faceFrame}>
          <NovaFace size={84} faceKey={effectiveFace} />
        </View>
        <View style={styles.faceCopy}>
          <Text style={styles.flavorText}>{displayFlavorText}</Text>
          {antsynudge && (
            <Text style={styles.antsynudge}>{antsynudge}</Text>
          )}
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>XP: {xpTotal}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>BADGES: {badgeCount}/10</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>WEEK STREAK: {weeklyActive.current || 0}</Text>
        </View>
        <View style={styles.statePill}>
          <Text style={styles.statePillText}>{stateLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingMD,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacingXS,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginTop: theme.spacingXS,
  },
  appName: {
    color: theme.accent,
    fontSize: 26,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  datetime: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 4,
  },
  subtitle: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacingSM,
    minHeight: 94,
  },
  faceFrame: {
    width: 94,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusLG,
    backgroundColor: 'rgba(0,255,209,0.04)',
  },
  faceCopy: {
    flex: 1,
    minHeight: 94,
    marginLeft: theme.spacingMD,
    justifyContent: 'center',
  },
  flavorText: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  pill: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  pillText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  statePill: {
    backgroundColor: theme.accentGlow,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    marginLeft: 'auto',
    maxWidth: '52%',
  },
  statePillText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
  },
  antsynudge: {
    color: theme.statusWarning,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontStyle: 'italic',
    marginTop: theme.spacingXS,
  },
});
