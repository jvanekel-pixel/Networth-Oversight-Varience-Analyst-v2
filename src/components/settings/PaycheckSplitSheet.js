import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { formatCentsShort, parseBillInput } from '../../utils/currency';
import AccountPickerSheet from '../AccountPickerSheet';

export default function PaycheckSplitSheet() {
  const novaConfig = useStore((s) => s.novaConfig);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);

  const storedSplits = novaConfig?.paycheckSplits || [];
  const [editing, setEditing] = useState(false);
  const [splits, setSplits] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (editing) setSplits(storedSplits.map(s => ({ ...s, raw: (s.amountCents / 100).toFixed(2) })));
  }, [editing]);

  const getAccountName = (accountId) => {
    const acct = (accountRegistry || []).find(a => (a.legacyKey || a.id) === accountId || a.id === accountId);
    return acct ? (acct.name || acct.id) : accountId || 'Unknown';
  };

  const totalCents = splits.reduce((sum, s) => sum + (parseBillInput(s.raw) || 0), 0);

  const handleSave = async () => {
    const updated = splits.map(s => ({
      ...s,
      amountCents: parseBillInput(s.raw) || 0,
    }));
    await updateNovaConfig({ paycheckSplits: updated });
    setEditing(false);
  };

  const handleAddAccount = (accountKey) => {
    const acct = (accountRegistry || []).find(a => (a.legacyKey || a.id) === accountKey || a.id === accountKey);
    const alreadyAdded = splits.some(s => s.accountId === accountKey);
    if (alreadyAdded) { setShowPicker(false); return; }
    setSplits(prev => [
      ...prev,
      {
        id: `split_${Date.now()}`,
        accountId: accountKey,
        label: acct ? (acct.name || accountKey) : accountKey,
        amountCents: 0,
        raw: '',
      },
    ]);
    setShowPicker(false);
  };

  const handleRemove = (id) => setSplits(prev => prev.filter(s => s.id !== id));

  const handleCancel = () => { setSplits([]); setEditing(false); setShowPicker(false); };

  if (!editing) {
    return (
      <View>
        {storedSplits.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>Paycheck split not configured.</Text>
            <TouchableOpacity style={styles.setupBtn} onPress={() => setEditing(true)}>
              <Text style={styles.setupBtnText}>TAP TO SET UP</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {storedSplits.map(s => (
              <View key={s.id} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{getAccountName(s.accountId || s.accountKey)}</Text>
                <Text style={styles.summaryAmt}>{formatCentsShort(s.amountCents)}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View>
      {splits.map((s, idx) => (
        <View key={s.id} style={styles.editRow}>
          <Text style={styles.editLabel}>{getAccountName(s.accountId || s.accountKey)}</Text>
          <TextInput
            style={styles.editInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            value={s.raw}
            onChangeText={raw => {
              const updated = [...splits];
              updated[idx] = { ...s, raw };
              setSplits(updated);
            }}
          />
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(s.id)}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmt}>{formatCentsShort(totalCents)}</Text>
      </View>

      {showPicker ? (
        <AccountPickerSheet
          label="Add account"
          roleFilter={['personal', 'household']}
          selectedKey={null}
          onSelect={handleAddAccount}
        />
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.addBtnText}>+ ADD ACCOUNT</Text>
        </TouchableOpacity>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>SAVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyRow: { gap: theme.spacingSM },
  emptyText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontStyle: 'italic' },
  setupBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingXS },
  setupBtnText: { color: theme.accent, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacingXS },
  summaryLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  summaryAmt: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  editBtn: { marginTop: theme.spacingSM, alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingXS },
  editBtnText: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  editRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacingXS },
  editLabel: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, flex: 1 },
  editInput: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, width: 90, textAlign: 'right', backgroundColor: theme.backgroundPanel },
  removeBtn: { paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS, marginLeft: theme.spacingXS },
  removeBtnText: { color: theme.statusDanger, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.borderColorDim, paddingTop: theme.spacingSM, marginTop: theme.spacingXS, marginBottom: theme.spacingSM },
  totalLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  totalAmt: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  addBtn: { alignSelf: 'flex-start', paddingVertical: theme.spacingXS },
  addBtnText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  actionRow: { flexDirection: 'row', gap: theme.spacingSM, marginTop: theme.spacingMD },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingSM, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  saveBtn: { flex: 1, backgroundColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingSM, alignItems: 'center' },
  saveBtnText: { color: theme.background, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
});
