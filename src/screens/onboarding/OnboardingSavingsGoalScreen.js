import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import { parseBillInput, formatCentsShort } from '../../utils/currency';

const PRESET_GOALS = [
  { key: 'emergency_1k', label: 'EMERGENCY FUND', amount: 100000, desc: '$1,000 starter cushion' },
  { key: 'buffer_5k', label: '3-MONTH BUFFER', amount: 500000, desc: '$5,000 safety net' },
  { key: 'down_20k', label: 'DOWN PAYMENT', amount: 2000000, desc: '$20,000 milestone' },
  { key: 'custom', label: 'CUSTOM', amount: null, desc: 'Set your own target' },
];

export default function OnboardingSavingsGoalScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const initGoal = wizardState.savingsGoal;
  const [selectedKey, setSelectedKey] = useState(initGoal?.key || null);
  const [customAmount, setCustomAmount] = useState(initGoal?.key === 'custom' ? String((initGoal.targetCents || 0) / 100) : '');

  function handleNext() {
    let goal = null;
    if (selectedKey && selectedKey !== 'custom') {
      const preset = PRESET_GOALS.find((g) => g.key === selectedKey);
      goal = { key: selectedKey, targetCents: preset.amount, label: preset.label };
    } else if (selectedKey === 'custom' && customAmount) {
      goal = { key: 'custom', targetCents: parseBillInput(customAmount), label: 'Custom Goal' };
    }
    updateWizard({ savingsGoal: goal });
    navigation.navigate('OnboardingEntrepreneur');
  }

  function handleSkip() {
    updateWizard({ savingsGoal: null });
    navigation.navigate('OnboardingEntrepreneur');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar hidden />
      <ProgressBar step={6} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>SAVINGS GOAL</Text>
        <Text style={styles.subtitle}>What are you saving toward?</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {PRESET_GOALS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.card, selectedKey === g.key && styles.cardSelected]}
            onPress={() => setSelectedKey(g.key)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabel, selectedKey === g.key && styles.cardLabelSelected]}>
                {g.label}
              </Text>
              {g.amount != null && (
                <Text style={[styles.cardAmount, selectedKey === g.key && styles.cardLabelSelected]}>
                  {formatCentsShort(g.amount)}
                </Text>
              )}
            </View>
            <Text style={styles.cardDesc}>{g.desc}</Text>
          </TouchableOpacity>
        ))}
        {selectedKey === 'custom' && (
          <View style={styles.customBlock}>
            <Text style={styles.fieldLabel}>TARGET AMOUNT</Text>
            <TextInput
              style={styles.input}
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cta} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.ctaText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: theme.spacingMD, paddingTop: theme.spacingMD, paddingBottom: theme.spacingMD },
  title: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingXS },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingMD, gap: theme.spacingSM },
  card: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, backgroundColor: theme.backgroundCard },
  cardSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
  cardLabelSelected: { color: theme.accent },
  cardAmount: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  cardDesc: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  customBlock: { gap: theme.spacingXS },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1 },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingSM },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  skipText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
});
