import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';

export default function ProgressBar({ step, total }) {
  const pct = Math.min(1, step / total);
  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
      <Text style={styles.label}>{step}/{total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    gap: theme.spacingSM,
  },
  track: {
    flex: 1,
    height: 3,
    backgroundColor: theme.backgroundPanel,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 2,
  },
  label: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    minWidth: 28,
    textAlign: 'right',
  },
});
