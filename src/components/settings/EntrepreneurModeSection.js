import React, { useMemo, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';

function BusinessEditSheet({ biz, visible, onClose }) {
  const editBusiness = useStore((s) => s.editBusiness);
  const [name, setName] = useState(biz?.name || '');
  const [trackIncome, setTrackIncome] = useState(biz?.trackIncome ?? true);
  const [trackExpenses, setTrackExpenses] = useState(biz?.trackExpenses ?? true);
  const [trackMileage, setTrackMileage] = useState(biz?.trackMileage ?? false);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accountOptions = useMemo(() => {
    const active = (accountRegistry || []).filter(account => account.isActive !== false);
    const businessAccounts = active.filter(account => account.role === 'business');
    const source = businessAccounts.length > 0 ? businessAccounts : active;
    return source
      .map(account => ({ key: account.legacyKey || account.id, label: (account.name || account.id).toUpperCase() }))
      .filter(option => option.key);
  }, [accountRegistry]);
  const [defaultAccountKey, setDefaultAccountKey] = useState(biz?.defaultAccountKey || accountOptions[0]?.key || '');

  async function handleSave() {
    if (!biz) return;
    await editBusiness(biz.id, { name: name.trim() || biz.name, trackIncome, trackExpenses, trackMileage, defaultAccountKey: defaultAccountKey || accountOptions[0]?.key || null });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>EDIT BUSINESS</Text>
          <Text style={styles.fieldLabel}>BUSINESS NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={biz?.name || 'Business name'}
            placeholderTextColor={theme.textDim}
          />
          <View style={styles.trackRow}>
            <Text style={styles.trackLabel}>Track Income</Text>
            <Switch value={trackIncome} onValueChange={setTrackIncome} trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }} thumbColor={trackIncome ? theme.accent : theme.textDim} />
          </View>
          <View style={styles.trackRow}>
            <Text style={styles.trackLabel}>Track Expenses</Text>
            <Switch value={trackExpenses} onValueChange={setTrackExpenses} trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }} thumbColor={trackExpenses ? theme.accent : theme.textDim} />
          </View>
          <View style={styles.trackRow}>
            <Text style={styles.trackLabel}>Track Mileage</Text>
            <Switch value={trackMileage} onValueChange={setTrackMileage} trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }} thumbColor={trackMileage ? theme.accent : theme.textDim} />
          </View>
          {accountOptions.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>DEFAULT MONEY ACCOUNT</Text>
              <View style={styles.chipRow}>
                {accountOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.chip, defaultAccountKey === opt.key && styles.chipOn]}
                    onPress={() => setDefaultAccountKey(opt.key)}
                  >
                    <Text style={[styles.chipText, defaultAccountKey === opt.key && styles.chipTextOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function EntrepreneurModeSection() {
  const novaConfig = useStore((s) => s.novaConfig);
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const businesses = useStore((s) => s.businesses);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const addBusiness = useStore((s) => s.addBusiness);
  const archiveBusiness = useStore((s) => s.archiveBusiness);
  const [editingBiz, setEditingBiz] = useState(null);
  const [newBizName, setNewBizName] = useState('');

  const enabled = novaConfig?.entrepreneurMode ?? false;
  const active = (businesses || []).filter((b) => b.isActive !== false);
  const defaultBusinessAccountKey = (accountRegistry || []).find(a => a.isActive !== false && a.role === 'business')?.legacyKey
    || (accountRegistry || []).find(a => a.isActive !== false && a.role === 'business')?.id
    || (accountRegistry || []).find(a => a.isActive !== false)?.legacyKey
    || (accountRegistry || []).find(a => a.isActive !== false)?.id
    || null;

  async function handleToggle(val) {
    await updateNovaConfig({ entrepreneurMode: val });
  }

  async function handleAdd() {
    const name = newBizName.trim();
    if (!name) return;
    await addBusiness({ name, trackIncome: true, trackExpenses: true, trackMileage: false, defaultAccountKey: defaultBusinessAccountKey });
    setNewBizName('');
  }

  return (
    <View>
      <Text style={styles.header}>BUSINESS MODE</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enable Business Mode</Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: theme.backgroundPanel, true: theme.accentGlow }}
          thumbColor={enabled ? theme.accent : theme.textDim}
        />
      </View>
      {enabled && (
        <View style={styles.bizList}>
          {active.map((b) => (
            <View key={b.id} style={styles.bizRow}>
              <Text style={styles.bizName}>{b.name}</Text>
              <View style={styles.bizActions}>
                <TouchableOpacity onPress={() => setEditingBiz(b)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => archiveBusiness(b.id)}>
                  <Text style={styles.archiveText}>ARCHIVE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newBizName}
              onChangeText={setNewBizName}
              placeholder="New business name"
              placeholderTextColor={theme.textDim}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {editingBiz && (
        <BusinessEditSheet
          biz={editingBiz}
          visible={!!editingBiz}
          onClose={() => setEditingBiz(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, marginBottom: theme.spacingMD, fontWeight: 'bold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacingMD },
  toggleLabel: { color: theme.textPrimary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary },
  bizList: { gap: theme.spacingSM },
  bizRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacingSM, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim },
  bizName: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', flex: 1 },
  bizActions: { flexDirection: 'row', gap: theme.spacingMD },
  editBtn: {},
  editBtnText: { color: theme.accent, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  archiveText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  addRow: { flexDirection: 'row', gap: theme.spacingSM, marginTop: theme.spacingSM },
  input: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  addBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentGlow },
  addBtnText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlayBg },
  sheet: { backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: theme.borderRadiusLG, borderTopRightRadius: theme.borderRadiusLG, padding: theme.spacingLG, gap: theme.spacingSM },
  sheetTitle: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingSM },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingXS },
  input2: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  trackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacingXS },
  trackLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
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
