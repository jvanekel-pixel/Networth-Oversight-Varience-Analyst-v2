import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { parseBillInput, formatCentsShort } from '../../utils/currency';

const ACCOUNT_TYPES = ['checking', 'savings', 'digital', 'cash'];
const ACCOUNT_ROLES = ['household', 'personal', 'business'];
const BLANK = { name: '', type: 'checking', role: 'personal', balance: '', floor: '' };

export default function AccountsSection() {
  const accountRegistry = useStore((s) => s.accountRegistry);
  const addAccount = useStore((s) => s.addAccount);
  const archiveAccount = useStore((s) => s.archiveAccount);
  const accounts = useStore((s) => s.accounts);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK);

  const active = (accountRegistry || []).filter((a) => a.isActive !== false);

  async function handleAdd() {
    if (!form.name.trim()) return;
    await addAccount({
      name: form.name.trim(),
      type: form.type,
      role: form.role,
      initialBalanceCents: parseBillInput(form.balance),
      floorCents: parseBillInput(form.floor),
    });
    setForm(BLANK);
    setShowModal(false);
  }

  function handleArchive(id) {
    Alert.alert('Archive Account', 'Hide this account from views? Data is preserved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => archiveAccount(id) },
    ]);
  }

  return (
    <View>
      <Text style={styles.header}>ACCOUNTS</Text>
      {active.length === 0 && (
        <Text style={styles.empty}>No accounts configured. Using defaults.</Text>
      )}
      {active.map((a) => (
        <View key={a.id} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName}>{a.name}</Text>
            <Text style={styles.rowMeta}>
              {a.type.toUpperCase()} · {a.role.toUpperCase()} · {formatCentsShort(accounts[a.legacyKey || a.id] || 0)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleArchive(a.id)}>
            <Text style={styles.archiveBtn}>ARCHIVE</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
        <Text style={styles.addBtnText}>+ ADD ACCOUNT</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>ADD ACCOUNT</Text>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Account name" placeholderTextColor={theme.textDim} />
            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.chipRow}>
              {ACCOUNT_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, form.type === t && styles.chipOn]} onPress={() => setForm((p) => ({ ...p, type: t }))}>
                  <Text style={[styles.chipText, form.type === t && styles.chipTextOn]}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>ROLE</Text>
            <View style={styles.chipRow}>
              {ACCOUNT_ROLES.map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, form.role === r && styles.chipOn]} onPress={() => setForm((p) => ({ ...p, role: r }))}>
                  <Text style={[styles.chipText, form.role === r && styles.chipTextOn]}>{r.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>OPENING BALANCE</Text>
            <TextInput style={styles.input} value={form.balance} onChangeText={(v) => setForm((p) => ({ ...p, balance: v }))} placeholder="0.00" placeholderTextColor={theme.textDim} keyboardType="decimal-pad" />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setForm(BLANK); setShowModal(false); }}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} activeOpacity={0.8}>
                <Text style={styles.saveText}>ADD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet;
const styles = s.create({
  header: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, marginBottom: theme.spacingMD, fontWeight: 'bold' },
  empty: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingMD, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacingSM, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim },
  rowInfo: { flex: 1 },
  rowName: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  rowMeta: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 2 },
  archiveBtn: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  addBtn: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, alignItems: 'center', marginTop: theme.spacingMD, borderStyle: 'dashed' },
  addBtnText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlayBg },
  sheet: { backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: theme.borderRadiusLG, borderTopRightRadius: theme.borderRadiusLG, padding: theme.spacingLG, gap: theme.spacingSM },
  sheetTitle: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingSM },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingXS },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingXS, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4 },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextOn: { color: theme.accent },
  actions: { flexDirection: 'row', gap: theme.spacingMD, marginTop: theme.spacingSM },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  cancelText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  saveBtn: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  saveText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
});
