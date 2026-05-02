import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import { parseBillInput } from '../../utils/currency';

const INCOME_TYPES = [
  { key: 'predictable', label: 'PREDICTABLE', desc: 'Regular paycheck on a set schedule.' },
  { key: 'irregular', label: 'IRREGULAR', desc: 'Variable or self-employed income.' },
  { key: 'skip', label: 'SKIP', desc: 'Set up income later in Settings.' },
];

const FREQUENCIES = [
  { key: 'weekly', label: 'WEEKLY' },
  { key: 'biweekly', label: 'BI-WEEKLY' },
  { key: 'monthly', label: 'MONTHLY' },
];

function parseDateInput(str) {
  if (!str || str.length < 8) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const [y, mo, d] = parts.map(Number);
  if (!y || !mo || !d) return null;
  const date = new Date(y, mo - 1, d);
  if (isNaN(date.getTime())) return null;
  return date.getTime();
}

export default function OnboardingIncomeScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const init = wizardState.incomeConfig;
  const [incomeType, setIncomeType] = useState(init.type);
  const [paydayDate, setPaydayDate] = useState(init.paydayDate || '');
  const [amount, setAmount] = useState(init.paycheckAmountCents > 0 ? String(init.paycheckAmountCents / 100) : '');
  const [frequency, setFrequency] = useState(init.payFrequency || 'biweekly');

  function handleNext() {
    const config = {
      type: incomeType,
      paydayDate,
      paycheckAmountCents: parseBillInput(amount),
      payFrequency: frequency,
      nextPaycheckDate: parseDateInput(paydayDate),
    };
    updateWizard({ incomeConfig: config });
    if (incomeType === 'predictable') {
      navigation.navigate('OnboardingPaycheckSplit');
    } else {
      navigation.navigate('OnboardingBills');
    }
  }

  function handleSkip() {
    updateWizard({ incomeConfig: { type: 'skip', paydayDate: '', paycheckAmountCents: 0, payFrequency: 'biweekly', nextPaycheckDate: null } });
    navigation.navigate('OnboardingBills');
  }

  const showDetails = incomeType === 'predictable';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar hidden />
      <ProgressBar step={3} total={8} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>YOUR INCOME</Text>
          <Text style={styles.subtitle}>How do you receive income?</Text>
        </View>
        <View style={styles.cards}>
          {INCOME_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.card, incomeType === t.key && styles.cardSelected]}
              onPress={() => setIncomeType(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cardLabel, incomeType === t.key && styles.cardLabelSelected]}>
                {t.label}
              </Text>
              <Text style={styles.cardDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {showDetails && (
          <View style={styles.details}>
            <Text style={styles.fieldLabel}>NEXT PAYDAY DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={paydayDate}
              onChangeText={setPaydayDate}
              placeholder="2025-05-15"
              placeholderTextColor={theme.textDim}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.fieldLabel}>PAYCHECK AMOUNT</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>FREQUENCY</Text>
            <View style={styles.freqRow}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, frequency === f.key && styles.chipSelected]}
                  onPress={() => setFrequency(f.key)}
                >
                  <Text style={[styles.chipText, frequency === f.key && styles.chipTextSelected]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
        <TouchableOpacity
          style={[styles.cta, !incomeType && styles.ctaDisabled]}
          onPress={handleNext}
          disabled={!incomeType}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1, paddingBottom: theme.spacingMD },
  header: { paddingHorizontal: theme.spacingMD, paddingTop: theme.spacingMD, paddingBottom: theme.spacingMD },
  title: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingXS },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cards: { paddingHorizontal: theme.spacingMD, gap: theme.spacingSM },
  card: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, backgroundColor: theme.backgroundCard },
  cardSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  cardLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: 4 },
  cardLabelSelected: { color: theme.accent },
  cardDesc: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  details: { marginTop: theme.spacingLG, paddingHorizontal: theme.spacingMD, gap: theme.spacingXS },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingSM },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  freqRow: { flexDirection: 'row', gap: theme.spacingSM, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingXS },
  chipSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextSelected: { color: theme.accent },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingSM },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  skipText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaDisabled: { borderColor: theme.borderColor, backgroundColor: 'transparent', opacity: 0.4 },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
});
