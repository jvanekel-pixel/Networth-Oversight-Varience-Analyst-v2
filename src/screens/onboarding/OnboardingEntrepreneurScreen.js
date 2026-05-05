import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';

const BLANK_BIZ = { name: '', trackIncome: true, trackExpenses: true, trackMileage: false, defaultAccountKey: '' };

function BizCard({ biz, accountOptions = [], onUpdate, onRemove }) {
  return (
    <View style={styles.bizCard}>
      <View style={styles.bizHeader}>
        <Text style={styles.bizName}>{biz.name || 'Unnamed Business'}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Text style={styles.removeBtn}>REMOVE</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.trackRow}>
        <Text style={styles.trackLabel}>Track Income</Text>
        <Switch
          value={biz.trackIncome}
          onValueChange={(v) => onUpdate({ ...biz, trackIncome: v })}
          trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }}
          thumbColor={biz.trackIncome ? theme.accent : theme.textDim}
        />
      </View>
      <View style={styles.trackRow}>
        <Text style={styles.trackLabel}>Track Expenses</Text>
        <Switch
          value={biz.trackExpenses}
          onValueChange={(v) => onUpdate({ ...biz, trackExpenses: v })}
          trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }}
          thumbColor={biz.trackExpenses ? theme.accent : theme.textDim}
        />
      </View>
      <View style={styles.trackRow}>
        <Text style={styles.trackLabel}>Track Mileage</Text>
        <Switch
          value={biz.trackMileage}
          onValueChange={(v) => onUpdate({ ...biz, trackMileage: v })}
          trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }}
          thumbColor={biz.trackMileage ? theme.accent : theme.textDim}
        />
      </View>
      {accountOptions.length > 0 && (
        <>
          <Text style={styles.trackLabel}>Money account</Text>
          <View style={styles.chipRow}>
            {accountOptions.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, biz.defaultAccountKey === opt.key && styles.chipOn]}
                onPress={() => onUpdate({ ...biz, defaultAccountKey: opt.key })}
              >
                <Text style={[styles.chipText, biz.defaultAccountKey === opt.key && styles.chipTextOn]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export default function OnboardingEntrepreneurScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const [enabled, setEnabled] = useState(wizardState.entrepreneurMode);
  const [businesses, setBusinesses] = useState(
    wizardState.wizardBusinesses.length > 0 ? wizardState.wizardBusinesses : []
  );
  const [newBizName, setNewBizName] = useState('');
  const accountOptions = (() => {
    const active = wizardState.wizardAccounts || [];
    const businessAccounts = active.filter(account => account.role === 'business');
    const source = businessAccounts.length > 0 ? businessAccounts : active;
    return source
      .map(account => ({ key: account.legacyKey || account.id, label: (account.name || account.id).toUpperCase() }))
      .filter(option => option.key);
  })();
  const fallbackAccountKey = accountOptions[0]?.key || '';

  function handleAddBusiness() {
    const name = newBizName.trim();
    if (!name) return;
    const biz = { ...BLANK_BIZ, id: `biz_${Date.now()}`, name, defaultAccountKey: fallbackAccountKey };
    const updated = [...businesses, biz];
    setBusinesses(updated);
    setNewBizName('');
  }

  function handleUpdate(idx, updated) {
    const next = businesses.map((b, i) => (i === idx ? updated : b));
    setBusinesses(next);
  }

  function handleRemove(idx) {
    const next = businesses.filter((_, i) => i !== idx);
    setBusinesses(next);
  }

  function handleNext() {
    updateWizard({ entrepreneurMode: enabled, wizardBusinesses: enabled ? businesses : [] });
    navigation.navigate('OnboardingReview');
  }

  function handleSkip() {
    updateWizard({ entrepreneurMode: false, wizardBusinesses: [] });
    navigation.navigate('OnboardingReview');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar hidden />
      <ProgressBar step={7} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>BUSINESS MODE</Text>
        <Text style={styles.subtitle}>Track self-employment income and expenses.</Text>
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enable Business Mode</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }}
          thumbColor={enabled ? theme.accent : theme.textDim}
        />
      </View>
      {enabled && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {businesses.map((b, i) => (
            <BizCard
              key={b.id || i}
              biz={{ ...b, defaultAccountKey: b.defaultAccountKey || fallbackAccountKey }}
              accountOptions={accountOptions}
              onUpdate={(u) => handleUpdate(i, u)}
              onRemove={() => handleRemove(i)}
            />
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={styles.nameInput}
              value={newBizName}
              onChangeText={setNewBizName}
              placeholder="Business name"
              placeholderTextColor={theme.textDim}
              returnKeyType="done"
              onSubmitEditing={handleAddBusiness}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddBusiness} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
      {!enabled && <View style={styles.spacer} />}
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingMD, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim },
  toggleLabel: { color: theme.textPrimary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary },
  spacer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingMD, gap: theme.spacingMD, paddingTop: theme.spacingMD },
  bizCard: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, backgroundColor: theme.backgroundCard, gap: theme.spacingXS },
  bizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacingSM },
  bizName: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  removeBtn: { color: theme.statusDanger, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  trackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingXS, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4 },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextOn: { color: theme.accent },
  addRow: { flexDirection: 'row', gap: theme.spacingSM },
  nameInput: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  addBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentGlow },
  addBtnText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingSM },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  skipText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
});
