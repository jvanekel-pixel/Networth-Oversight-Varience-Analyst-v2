import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import { formatCents, formatCentsShort, parseBillInput } from '../../utils/currency';

export default function OnboardingPaycheckSplitScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const { wizardAccounts, incomeConfig } = wizardState;

  const paycheckAmountCents = incomeConfig.paycheckAmountCents || 0;
  const eligibleAccounts = wizardAccounts.filter(
    a => a.role === 'personal' || a.role === 'household'
  );

  const [amountRaws, setAmountRaws] = useState(eligibleAccounts.map(() => ''));

  const totalCents = amountRaws.reduce((sum, r) => sum + (parseBillInput(r) || 0), 0);
  const diff = paycheckAmountCents - totalCents;
  const diffColor = diff === 0 ? theme.statusPositive : Math.abs(diff) < 100 ? theme.statusWarning : theme.statusDanger;

  function handleNext() {
    const splits = eligibleAccounts
      .map((acct, i) => ({
        id: acct.id,
        accountId: acct.id,
        label: acct.name,
        amountCents: parseBillInput(amountRaws[i] ?? '') || 0,
      }))
      .filter(s => s.amountCents > 0);
    updateWizard({ paycheckSplits: splits });
    navigation.navigate('OnboardingBills');
  }

  function handleSkip() {
    updateWizard({ paycheckSplits: [] });
    navigation.navigate('OnboardingBills');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar hidden />
      <ProgressBar step={3} total={8} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>PAYCHECK SPLIT</Text>
          <Text style={styles.subtitle}>
            How should your{paycheckAmountCents > 0 ? ` ${formatCentsShort(paycheckAmountCents)}` : ''} paycheck be distributed?
          </Text>
        </View>

        {eligibleAccounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No accounts configured yet — you can set this up later in Settings.</Text>
          </View>
        ) : (
          <View style={styles.rows}>
            {eligibleAccounts.map((acct, i) => (
              <View key={acct.id} style={styles.splitRow}>
                <Text style={styles.splitLabel}>{acct.name}</Text>
                <TextInput
                  style={styles.splitInput}
                  placeholder="0.00"
                  placeholderTextColor={theme.textDim}
                  keyboardType="decimal-pad"
                  value={amountRaws[i]}
                  onChangeText={raw => {
                    const updated = [...amountRaws];
                    updated[i] = raw;
                    setAmountRaws(updated);
                  }}
                />
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={[styles.totalAmt, { color: diffColor }]}>{formatCentsShort(totalCents)}</Text>
            </View>
            {paycheckAmountCents > 0 && diff !== 0 && (
              <Text style={[styles.diffText, { color: diffColor }]}>
                {diff > 0 ? `${formatCents(diff)} unallocated` : `${formatCents(Math.abs(diff))} over`}
              </Text>
            )}
            <Text style={styles.hint}>Doesn't add up? No problem — adjust this anytime in Settings.</Text>
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
        <TouchableOpacity style={styles.cta} onPress={handleNext}>
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
  emptyCard: { marginHorizontal: theme.spacingMD, padding: theme.spacingMD, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, backgroundColor: theme.backgroundCard },
  emptyText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontStyle: 'italic' },
  rows: { paddingHorizontal: theme.spacingMD, gap: theme.spacingXS },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacingXS },
  splitLabel: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, flex: 1 },
  splitInput: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel, width: 100, textAlign: 'right' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.borderColorDim, paddingTop: theme.spacingSM, marginTop: theme.spacingXS },
  totalLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  totalAmt: { fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  diffText: { fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, textAlign: 'right', marginTop: 2 },
  hint: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: theme.spacingMD, fontStyle: 'italic' },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingSM },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  skipText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
});
