import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import theme from '../../config/theme.config';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.hero}>
        <Text style={styles.logo}>N.O.V.A.</Text>
        <Text style={styles.subtitle}>Net Worth Oversight{'\n'}Variance Analyst</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.tagline}>
          Your personal finance command center.{'\n'}Let's get your picture set up.
        </Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('OnboardingUserMode')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>GET STARTED</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: theme.spacingXL,
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: theme.spacingXL,
  },
  logo: {
    color: theme.accent,
    fontSize: theme.fontSizeDisplay,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 6,
    marginBottom: theme.spacingSM,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 20,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagline: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingBottom: theme.spacingXXL,
  },
  cta: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: theme.spacingMD,
    alignItems: 'center',
    backgroundColor: theme.accentGlow,
  },
  ctaText: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
});
