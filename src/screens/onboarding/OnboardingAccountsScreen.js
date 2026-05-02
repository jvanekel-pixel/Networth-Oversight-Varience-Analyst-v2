import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import { parseBillInput, formatCentsShort } from '../../utils/currency';

const ACCOUNT_TYPES = ['checking', 'savings', 'digital', 'cash'];
const ACCOUNT_ROLES = ['household', 'personal', 'business'];

const BLANK = { name: '', type: 'checking', role: 'personal', balance: '', floor: '' };

function TypePicker({ value, onChange }) {
  return (
    <View style={styles.pickerRow}>
      {ACCOUNT_TYPES.map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.chip, value === t && styles.chipSelected]}
          onPress={() => onChange(t)}
        >
          <Text style={[styles.chipText, value === t && styles.chipTextSelected]}>
            {t.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RolePicker({ value, onChange }) {
  return (
    <View style={styles.pickerRow}>
      {ACCOUNT_ROLES.map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.chip, value === r && styles.chipSelected]}
          onPress={() => onChange(r)}
        >
          <Text style={[styles.chipText, value === r && styles.chipTextSelected]}>
            {r.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function OnboardingAccountsScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const [accounts, setAccounts] = useState(wizardState.wizardAccounts);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK);

  function handleAdd() {
    if (!form.name.trim()) return;
    const id = `acc_${Date.now()}`;
    const legacyKey = id;
    const entry = {
      id,
      legacyKey,
      name: form.name.trim(),
      type: form.type,
      role: form.role,
      isActive: true,
      initialBalanceCents: parseBillInput(form.balance),
      floorCents: parseBillInput(form.floor),
    };
    const updated = [...accounts, entry];
    setAccounts(updated);
    updateWizard({ wizardAccounts: updated });
    setForm(BLANK);
    setShowModal(false);
  }

  function handleRemove(id) {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    updateWizard({ wizardAccounts: updated });
  }

  function handleNext() {
    updateWizard({ wizardAccounts: accounts });
    navigation.navigate('OnboardingIncome');
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ProgressBar step={2} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>YOUR ACCOUNTS</Text>
        <Text style={styles.subtitle}>Add the accounts you track in NOVA.</Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {accounts.length === 0 && (
          <Text style={styles.empty}>No accounts added yet.</Text>
        )}
        {accounts.map((a) => (
          <View key={a.id} style={styles.accountRow}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{a.name}</Text>
              <Text style={styles.accountMeta}>
                {a.type.toUpperCase()} · {a.role.toUpperCase()} · {formatCentsShort(a.initialBalanceCents)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(a.id)}>
              <Text style={styles.removeBtn}>REMOVE</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ ADD ACCOUNT</Text>
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
            <Text style={styles.sheetTitle}>ADD ACCOUNT</Text>
            <Text style={styles.fieldLabel}>ACCOUNT NAME</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Chase Checking"
              placeholderTextColor={theme.textDim}
            />
            <Text style={styles.fieldLabel}>TYPE</Text>
            <TypePicker value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v }))} />
            <Text style={styles.fieldLabel}>ROLE</Text>
            <RolePicker value={form.role} onChange={(v) => setForm((p) => ({ ...p, role: v }))} />
            <Text style={styles.fieldLabel}>OPENING BALANCE</Text>
            <TextInput
              style={styles.input}
              value={form.balance}
              onChangeText={(v) => setForm((p) => ({ ...p, balance: v }))}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>FLOOR AMOUNT (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={form.floor}
              onChangeText={(v) => setForm((p) => ({ ...p, floor: v }))}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
            />
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
  accountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, backgroundColor: theme.backgroundCard },
  accountInfo: { flex: 1 },
  accountName: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: 2 },
  accountMeta: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
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
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingXS, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4 },
  chipSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextSelected: { color: theme.accent },
  sheetActions: { flexDirection: 'row', gap: theme.spacingMD, marginTop: theme.spacingSM },
  sheetCancel: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
});
