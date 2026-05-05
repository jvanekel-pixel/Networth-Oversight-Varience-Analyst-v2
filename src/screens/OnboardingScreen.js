import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NovaFace } from '../components/NovaFace';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';

const randomLine = personality.starterPool[Math.floor(Math.random() * personality.starterPool.length)];

export default function OnboardingScreen() {
  const setOnboardingComplete = useStore((s) => s.setOnboardingComplete);
  const householdBills = useStore((s) => s.householdBills);
  const personalBills = useStore((s) => s.personalBills);
  const billsEmpty = (!householdBills || householdBills.length === 0) && (!personalBills || personalBills.length === 0);

  return (
    <View style={styles.container}>
      <NovaFace size={200} />
      <Text style={styles.name}>{personality.characterName}</Text>
      <Text style={styles.line}>{randomLine}</Text>
      <TouchableOpacity style={styles.button} onPress={setOnboardingComplete}>
        <Text style={styles.buttonText}>BEGIN SETUP</Text>
      </TouchableOpacity>
      {billsEmpty && (
        <View style={styles.nudge}>
          <Text style={styles.nudgeText}>Add your bill schedule in Settings to unlock full variance forecasting.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacingXL,
  },
  name: {
    color: theme.accent,
    fontSize: theme.fontSizeDisplay,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginTop: theme.spacingLG,
    marginBottom: theme.spacingMD,
  },
  line: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacingXXL,
  },
  button: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingXL,
    paddingVertical: theme.spacingMD,
    backgroundColor: theme.accentGlow,
  },
  buttonText: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  nudge: {
    backgroundColor: theme.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.statusWarning,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginTop: theme.spacingLG,
    marginHorizontal: theme.spacingMD,
  },
  nudgeText: {
    color: theme.statusWarning,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
  },
});
