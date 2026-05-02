import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, ActivityIndicator,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import { formatCentsShort } from '../../utils/currency';
import useStore from '../../store/useStore';

function Section({ title, onEdit, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onEdit}>
          <Text style={styles.editBtn}>EDIT</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function OnboardingReviewScreen({ navigation }) {
  const { wizardState } = useWizard();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [loading, setLoading] = useState(false);

  const {
    userMode, entrepreneurMode, wizardAccounts, incomeConfig,
    bills, buckets, savingsGoal, wizardBusinesses, paycheckSplits,
  } = wizardState;

  async function handleFinish() {
    setLoading(true);
    try {
      await completeOnboarding({
        userMode,
        entrepreneurMode,
        wizardAccounts,
        wizardBusinesses,
        bills,
        buckets,
        incomeConfig,
        savingsGoal,
        paycheckSplits: paycheckSplits || [],
      });
    } catch (e) {
      console.warn('completeOnboarding error:', e);
    } finally {
      setLoading(false);
    }
  }

  const incomeLabel = () => {
    if (!incomeConfig.type || incomeConfig.type === 'skip') return 'Skipped';
    if (incomeConfig.type === 'irregular') return 'Irregular';
    const amt = incomeConfig.paycheckAmountCents > 0 ? formatCentsShort(incomeConfig.paycheckAmountCents) : '—';
    return `${amt} ${incomeConfig.payFrequency || 'biweekly'}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ProgressBar step={8} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>REVIEW & FINISH</Text>
        <Text style={styles.subtitle}>Everything look right?</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Section title="PROFILE" onEdit={() => navigation.navigate('OnboardingUserMode')}>
          <Row label="Mode" value={userMode ? userMode.toUpperCase() : '—'} />
          <Row label="Business Mode" value={entrepreneurMode ? 'ENABLED' : 'DISABLED'} />
        </Section>

        <Section title={`ACCOUNTS (${wizardAccounts.length})`} onEdit={() => navigation.navigate('OnboardingAccounts')}>
          {wizardAccounts.length === 0
            ? <Text style={styles.emptyNote}>No accounts added — using defaults</Text>
            : wizardAccounts.map((a) => (
              <Row key={a.id} label={a.name} value={`${a.type.toUpperCase()} · ${formatCentsShort(a.initialBalanceCents)}`} />
            ))
          }
        </Section>

        <Section title="INCOME" onEdit={() => navigation.navigate('OnboardingIncome')}>
          <Row label="Type" value={incomeConfig.type ? incomeConfig.type.toUpperCase() : '—'} />
          {incomeConfig.type === 'predictable' && (
            <>
              <Row label="Amount" value={incomeLabel()} />
              <Row label="Next Payday" value={incomeConfig.paydayDate || '—'} />
            </>
          )}
        </Section>

        <Section title={`BILLS (${bills.length})`} onEdit={() => navigation.navigate('OnboardingBills')}>
          {bills.length === 0
            ? <Text style={styles.emptyNote}>No bills added</Text>
            : bills.map((b) => (
              <Row key={b.id} label={b.name} value={`${formatCentsShort(b.amountCents)} · day ${b.dueDay}`} />
            ))
          }
        </Section>

        <Section title={`CATEGORIES (${buckets.length})`} onEdit={() => navigation.navigate('OnboardingBuckets')}>
          {buckets.length === 0
            ? <Text style={styles.emptyNote}>No categories selected</Text>
            : <Text style={styles.bucketList}>{buckets.map((b) => b.name).join(' · ')}</Text>
          }
        </Section>

        <Section title="SAVINGS GOAL" onEdit={() => navigation.navigate('OnboardingSavingsGoal')}>
          {savingsGoal
            ? <Row label={savingsGoal.label} value={formatCentsShort(savingsGoal.targetCents)} />
            : <Text style={styles.emptyNote}>No goal set</Text>
          }
        </Section>

        {entrepreneurMode && (
          <Section title={`BUSINESSES (${wizardBusinesses.length})`} onEdit={() => navigation.navigate('OnboardingEntrepreneur')}>
            {wizardBusinesses.length === 0
              ? <Text style={styles.emptyNote}>No businesses added</Text>
              : wizardBusinesses.map((b) => (
                <Row key={b.id} label={b.name} value={[b.trackIncome && 'Income', b.trackExpenses && 'Expenses', b.trackMileage && 'Mileage'].filter(Boolean).join(' · ')} />
              ))
            }
          </Section>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaLoading]}
          onPress={handleFinish}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={theme.accent} size="small" />
            : <Text style={styles.ctaText}>FINISH SETUP</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: theme.spacingMD, paddingTop: theme.spacingMD, paddingBottom: theme.spacingMD },
  title: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingXS },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingMD, gap: theme.spacingMD },
  section: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, backgroundColor: theme.backgroundCard, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingSM, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim, backgroundColor: theme.backgroundPanel },
  sectionTitle: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2 },
  editBtn: { color: theme.accent, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1 },
  sectionBody: { padding: theme.spacingMD, gap: theme.spacingXS },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, flex: 1 },
  rowValue: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  emptyNote: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, fontStyle: 'italic' },
  bucketList: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, lineHeight: 18 },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingMD },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaLoading: { opacity: 0.7 },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2 },
});
