import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';

export default function AboutSection() {
  const xpTotal = useStore(s => s.xpTotal);

  return (
    <View>
      <Text style={styles.header}>ABOUT</Text>
      <Text style={styles.appName}>N.O.V.A.</Text>
      <Text style={styles.version}>Version 1.1.1</Text>
      <Text style={styles.credits}>Built by CFLX-01.</Text>
      <Text style={styles.privacy}>
        Your data stays on-device. JSON backups can be imported back into NOVA, and CSV exports can be opened anywhere.
      </Text>
      <Text style={styles.xp}>XP: {xpTotal.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingSM },
  appName: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingXS },
  version: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  credits: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  privacy: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, lineHeight: 18, marginTop: theme.spacingSM },
  xp: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: theme.spacingSM },
});
