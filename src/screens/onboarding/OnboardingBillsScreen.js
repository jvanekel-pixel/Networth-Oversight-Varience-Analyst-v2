import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import { parseBillInput, formatCentsShort } from '../../utils/currency';

const DEFAULT_ACCOUNT_OPTIONS = [
  { key: 'jointChecking', label: 'Joint Checking' },
  { key: 'entChecking', label: 'Personal Checking' },
];

const BLANK = { name: '', amount: '', dueDay: '', accountKey: null };

export default function OnboardingBillsScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const [bills, setBills] = useState(wizardState.bills);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK);

  const accountOptions = wizardState.wizardAccounts.length > 0
    ? wizardState.wizardAccounts.map((a) => ({ key: a.legacyKey || a.id, label: a.name }))
    : DEFAULT_ACCOUNT_OPTIONS;

  function handleAdd() {
    if (!form.name.trim() || !form.amount) return;
    const day = Math.max(1, Math.min(31, parseInt(form.dueDay, 10) || 1));
    const bill = {
      id: `bill_${Date.now()}`,
      name: form.name.trim(),
      amountCents: parseBillInput(form.amount),
      expectedDay: day,
      dueDay: day,
      defaultAccountKey: form.accountKey,
      isActive: true,
    };
    const updated = [...bills, bill];
    setBills(updated);
    updateWizard({ bills: updated });
    setForm(BLANK);
    setShowModal(false);
  }

  function handleRemove(id) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    updateWizard({ bills: updated });
  }

  function handleNext() {
    updateWizard({ bills });
    navigation.navigate('OnboardingBuckets');
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ProgressBar step={4} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>RECURRING BILLS</Text>
        <Text style={styles.subtitle}>Add your monthly bills and subscriptions.</Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {bills.length === 0 && (
          <Text style={styles.empty}>No bills added yet.</Text>
        )}
        {bills.map((b) => (
          <View key={b.id} style={styles.billRow}>
            <View style={styles.billInfo}>
              <Text style={styles.billName}>{b.name}</Text>
              <Text style={styles.billMeta}>
                {formatCentsShort(b.amountCents)} · due day {b.dueDay} · {(() => {
                  const key = b.defaultAccountKey;
                  if (!key) return 'Unassigned';
                  const found = accountOptions.find(a => a.key === key);
                  return found ? found.label : 'Unassigned';
                })()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(b.id)}>
              <Text style={styles.removeBtn}>REMOVE</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ ADD BILL</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleNext}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cta} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.ctaText}>NEXT</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>ADD BILL</Text>
            <Text style={styles.fieldLabel}>BILL NAME</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Netflix"
              placeholderTextColor={theme.textDim}
            />
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <TextInput
              style={styles.input}
              value={form.amount}
              onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>DUE DAY OF MONTH</Text>
            <TextInput
              style={styles.input}
              value={form.dueDay}
              onChangeText={(v) => setForm((p) => ({ ...p, dueDay: v }))}
              placeholder="1–31"
              placeholderTextColor={theme.textDim}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLabel}>ACCOUNT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pickerRow}>
                {accountOptions.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.chip, form.accountKey === a.key && styles.chipSelected]}
                    onPress={() => setForm((p) => ({ ...p, accountKey: a.key }))}
                  >
                    <Text style={[styles.chipText, form.accountKey === a.key && styles.chipTextSelected]}>
                      {a.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => { setForm(BLANK); setShowModal(false); }}>
                <Text style={styles.backText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cta} onPress={handleAdd} activeOpacity={0.8}>
                <Text style={styles.ctaText}>ADD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: theme.spacingMD, paddingTop: theme.spacingMD, paddingBottom: theme.spacingMD },
  title: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingXS },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingMD, gap: theme.spacingSM },
  empty: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, textAlign: 'center', paddingVertical: theme.spacingLG },
  billRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, backgroundColor: theme.backgroundCard },
  billInfo: { flex: 1 },
  billName: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: 2 },
  billMeta: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  removeBtn: { color: theme.statusDanger, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  addBtn: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', borderStyle: 'dashed', marginTop: theme.spacingXS },
  addBtnText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, letterSpacing: 1 },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingSM },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  skipText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlayBg },
  sheet: { backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: theme.borderRadiusLG, borderTopRightRadius: theme.borderRadiusLG, padding: theme.spacingLG, gap: theme.spacingSM },
  sheetTitle: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingSM },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingXS },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  pickerRow: { flexDirection: 'row', gap: theme.spacingXS, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4 },
  chipSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextSelected: { color: theme.accent },
  sheetActions: { flexDirection: 'row', gap: theme.spacingMD, marginTop: theme.spacingSM },
  sheetCancel: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
});
