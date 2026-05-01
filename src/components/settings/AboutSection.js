import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';

export default function AboutSection() {
  return (
    <View>
      <Text style={styles.header}>ABOUT</Text>
      <Text style={styles.appName}>N.O.V.A.</Text>
      <Text style={styles.version}>Version 1.0.0</Text>
      <Text style={styles.credits}>Built by CFLX-01.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingSM },
  appName: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingXS },
  version: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  credits: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
});
