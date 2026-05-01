import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';

export default function BusinessScreen({ navigation }) {
  const businessVariance = useStore((s) => s.varianceCache.business);
  const bv = businessVariance || { balance: 0, variance: 0, state: 'neutral', annotation: '—' };
  const borderColor = bv.state === 'green' ? theme.statusPositive : bv.state === 'yellow' ? theme.statusWarning : bv.state === 'red' ? theme.statusDanger : theme.borderColorDim;
  const bgColor = bv.state === 'green' ? theme.statusPositiveBg : bv.state === 'yellow' ? theme.statusWarningBg : bv.state === 'red' ? theme.statusDangerBg : theme.backgroundCard;
  const varSign = bv.variance > 0 ? '+' : '';
  const varColor = bv.variance > 0 ? theme.statusPositive : bv.variance < 0 ? theme.statusDanger : theme.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.headerStrip}>
        <Text style={styles.title}>{theme.tabBusiness}</Text>
        <Text style={styles.subtitle}>MASSAGE + CLEANING LLC</Text>
      </View>

      <View style={[styles.varianceCard, { borderColor, backgroundColor: bgColor }]}>
        <Text style={styles.varianceLabel}>BUSINESS VARIANCE</Text>
        <Text style={styles.varianceBalance}>{formatCentsShort(bv.balance)}</Text>
        <Text style={[styles.varianceAmt, { color: varColor }]}>{varSign}{formatCentsShort(bv.variance)}</Text>
        <Text style={styles.varianceAnnotation}>{bv.annotation}</Text>
      </View>

      <TouchableOpacity style={styles.enterButton} onPress={() => navigation.navigate('BusinessSelector')}>
        <Text style={styles.enterButtonText}>MANAGE BUSINESS ZONES</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingVertical: theme.spacingMD,
  },
  headerStrip: {
    marginBottom: theme.spacingMD,
  },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingXS,
  },
  varianceCard: {
    padding: theme.spacingLG,
    borderRadius: theme.radiusLG,
    borderWidth: 2,
  },
  varianceLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  varianceBalance: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  varianceAmt: {
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    marginBottom: 2,
  },
  varianceAnnotation: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  enterButton: {
    marginTop: theme.spacingLG,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: 14,
    alignItems: 'center',
  },
  enterButtonText: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
});
