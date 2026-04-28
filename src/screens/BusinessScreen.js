import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../config/theme.config';

export default function BusinessScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{theme.tabBusiness}</Text>
      <Text style={styles.subtitle}>MASSAGE + CLEANING LLC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: theme.spacingSM,
  },
});
