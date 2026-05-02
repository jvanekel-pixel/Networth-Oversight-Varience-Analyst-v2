import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';

const MODES = [
  { key: 'solo', label: 'SOLO', desc: 'I manage my own finances independently.' },
  { key: 'partnered', label: 'PARTNERED', desc: 'I share finances with a partner or household.' },
];

export default function OnboardingUserModeScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const [selected, setSelected] = useState(wizardState.userMode);

  function handleNext() {
    updateWizard({ userMode: selected });
    navigation.navigate('OnboardingAccounts');
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ProgressBar step={1} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>HOW DO YOU MANAGE MONEY?</Text>
      </View>
      <View style={styles.cards}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.card, selected === m.key && styles.cardSelected]}
            onPress={() => setSelected(m.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardLabel, selected === m.key && styles.cardLabelSelected]}>
              {m.label}
            </Text>
            <Text style={styles.cardDesc}>{m.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cta, !selected && styles.ctaDisabled]}
          onPress={handleNext}
          disabled={!selected}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: theme.spacingMD, paddingTop: theme.spacingMD, paddingBottom: theme.spacingLG },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  cards: { flex: 1, paddingHorizontal: theme.spacingMD, gap: theme.spacingMD },
  card: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingLG,
    backgroundColor: theme.backgroundCard,
  },
  cardSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  cardLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: theme.spacingSM,
  },
  cardLabelSelected: { color: theme.accent },
  cardDesc: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingXXL,
    paddingTop: theme.spacingMD,
    gap: theme.spacingMD,
  },
  back: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: theme.spacingMD,
    alignItems: 'center',
  },
  backText: { color: theme.textDim, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary },
  cta: {
    flex: 2,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: theme.spacingMD,
    alignItems: 'center',
    backgroundColor: theme.accentGlow,
  },
  ctaDisabled: { borderColor: theme.borderColor, backgroundColor: 'transparent', opacity: 0.4 },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
});
