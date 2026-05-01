import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import Svg, { Ellipse, Circle, Path, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { timeAgo } from '../utils/dates';

function NovaFace({ size = 80 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="faceGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="{theme.faceColor}" stopOpacity="0.06" />
          <Stop offset="100%" stopColor="{theme.faceColor}" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="52" rx="43" ry="45" fill={theme.faceColorDim} stroke="{theme.faceColor}" strokeWidth="1.5" />
      <Ellipse cx="50" cy="52" rx="43" ry="45" fill="url(#faceGlow)" />
      <Path d="M 28 34 Q 36 30 44 34" stroke="{theme.faceColor}" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M 56 34 Q 64 30 72 34" stroke="{theme.faceColor}" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Ellipse cx="36" cy="45" rx="7" ry="7" stroke="{theme.faceColor}" strokeWidth="1.5" fill="none" />
      <Circle cx="36" cy="45" r="3.5" fill="{theme.faceColor}" fillOpacity="0.65" />
      <Circle cx="37.5" cy="43.5" r="1.2" fill="white" fillOpacity="0.3" />
      <Ellipse cx="64" cy="45" rx="7" ry="7" stroke="{theme.faceColor}" strokeWidth="1.5" fill="none" />
      <Circle cx="64" cy="45" r="3.5" fill="{theme.faceColor}" fillOpacity="0.65" />
      <Circle cx="65.5" cy="43.5" r="1.2" fill="white" fillOpacity="0.3" />
      <Path d="M 37 64 Q 50 71 63 64" stroke="{theme.faceColor}" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <SvgText x="50" y="93" textAnchor="middle" fontFamily="monospace" fontSize="5" fill="{theme.faceColor}" fillOpacity="0.4">
        CONTENT
      </SvgText>
    </Svg>
  );
}

export { NovaFace };

export default function NovaHeader() {
  const [now, setNow] = useState(new Date());
  const { xpTotal, badges, currentFlavorText, lastActivityAt, confirmBalance, rotateFlavorText } = useStore();
  const badgeCount = Object.keys(badges).length;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const needsConfirm = !lastActivityAt || Date.now() - lastActivityAt > 48 * 60 * 60 * 1000;

  const handleConfirm = () => {
    confirmBalance();
    const personality = require('../config/personality.config').default;
    rotateFlavorText(personality.starterPool);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.appName}>{theme.appName}</Text>
        <Text style={styles.datetime}>{timeStr}  {dateStr}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.subtitle}>{theme.appSubtitle}</Text>
      </View>

      <View style={styles.faceRow}>
        <NovaFace size={80} />
        <Text style={styles.flavorText}>
          {currentFlavorText || '...'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>XP: {xpTotal}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>BADGES: {badgeCount}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.lastLogged}>Last logged: {timeAgo(lastActivityAt)}</Text>
        <TouchableOpacity
          style={[styles.confirmBtn, needsConfirm && styles.confirmBtnGlow]}
          onPress={handleConfirm}
        >
          <Text style={[styles.confirmText, needsConfirm && styles.confirmTextGlow]}>
            CONFIRM BALANCE
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundSecondary,
    paddingTop: theme.spacingMD,
    paddingBottom: theme.spacingSM,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    minHeight: SCREEN_HEIGHT * 0.30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacingXS,
  },
  appName: {
    color: theme.accent,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  datetime: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  subtitle: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacingXS,
    minHeight: SCREEN_HEIGHT * 0.12,
  },
  flavorText: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontStyle: 'italic',
    marginLeft: theme.spacingMD,
  },
  pill: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    marginRight: theme.spacingSM,
  },
  pillText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  lastLogged: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  confirmBtn: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  confirmBtnGlow: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  confirmTextGlow: {
    color: theme.accent,
  },
});
