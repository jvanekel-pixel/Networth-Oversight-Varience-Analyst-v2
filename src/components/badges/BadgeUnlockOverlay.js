import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import theme from '../../config/theme.config';
import { TIERED_BADGES } from '../../config/badges.config';
import useStore from '../../store/useStore';
import BadgeMedal, { BADGE_TIER_STYLES } from './BadgeMedal';

const TIER_LABELS = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  platinum: 'PLATINUM',
  onyx: 'ONYX',
};

export default function BadgeUnlockOverlay() {
  const pendingUnlocks = useStore((s) => s.pendingUnlocks || []);
  const dismissPendingUnlock = useStore((s) => s.dismissPendingUnlock);
  const pulse = useRef(new Animated.Value(0)).current;

  const unlock = pendingUnlocks[0] || null;
  const badge = unlock ? TIERED_BADGES.find(item => item.id === unlock.badgeId) : null;
  const palette = unlock ? BADGE_TIER_STYLES[unlock.tier] || BADGE_TIER_STYLES.bronze : BADGE_TIER_STYLES.bronze;

  useEffect(() => {
    if (!unlock) return undefined;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [unlock?.unlockedAt, pulse]);

  if (!unlock || !badge) return null;

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const scanY = pulse.interpolate({ inputRange: [0, 1], outputRange: [-80, 190] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => dismissPendingUnlock?.(unlock.unlockedAt)}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: palette.trim }]}>
          <Animated.View style={[styles.glow, { opacity: glowOpacity, borderColor: palette.accent }]} />
          <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }], backgroundColor: palette.accent }]} />

          <Text style={styles.kicker}>BADGE TIER UNLOCKED</Text>
          <BadgeMedal badgeId={badge.id} tier={unlock.tier} size={154} progress={1} completed />
          <Text style={styles.title}>{badge.name.toUpperCase()}</Text>
          <Text style={[styles.tier, { color: palette.accent }]}>{TIER_LABELS[unlock.tier]}</Text>
          <Text style={styles.tagline}>{badge.tagline}</Text>

          <TouchableOpacity style={[styles.continueBtn, { borderColor: palette.accent }]} onPress={() => dismissPendingUnlock?.(unlock.unlockedAt)}>
            <Text style={[styles.continueText, { color: palette.accent }]}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: theme.spacingLG,
  },
  panel: {
    width: '100%',
    maxWidth: 430,
    minHeight: 430,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: '#050713',
    padding: theme.spacingLG,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  scanLine: {
    position: 'absolute',
    left: theme.spacingLG,
    right: theme.spacingLG,
    height: 1,
    opacity: 0.34,
  },
  kicker: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    letterSpacing: 1,
    marginBottom: theme.spacingSM,
  },
  title: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXL,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: theme.spacingMD,
  },
  tier: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeLG,
    fontWeight: 'bold',
    marginTop: theme.spacingXS,
  },
  tagline: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    textAlign: 'center',
    marginTop: theme.spacingSM,
  },
  continueBtn: {
    borderWidth: 1,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingXL,
    paddingVertical: theme.spacingSM,
    marginTop: theme.spacingLG,
  },
  continueText: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
});
