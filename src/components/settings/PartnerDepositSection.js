import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { formatCentsShort, parseBillInput } from '../../utils/currency';

const FREQ_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Unscheduled', value: 'unscheduled' },
];

function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.segRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.segBtn, value === opt.value && styles.segBtnActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.segText, value === opt.value && styles.segTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PartnerDepositSection() {
  const {
    incomeEvents,
    accountRegistry,
    upsertScheduledIncomeEvent,
    removeScheduledIncomeEvent,
    recordScheduledIncomeEvent,
    recomputeVariance,
  } = useStore();

  const activeAccounts = (accountRegistry || []).filter(a => a.isActive !== false);
  const defaultAccountKey = activeAccounts[0] ? (activeAccounts[0].legacyKey || activeAccounts[0].id) : null;
  const scheduled = (incomeEvents?.scheduledIncomeEvents || []).filter(event => event.isActive !== false);

  const [editingId, setEditingId] = useState(null);
  const [labelRaw, setLabelRaw] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [dayRaw, setDayRaw] = useState('1');
  const [accountKey, setAccountKey] = useState(defaultAccountKey);

  useEffect(() => {
    if (!accountKey && defaultAccountKey) setAccountKey(defaultAccountKey);
  }, [defaultAccountKey]);

  const resetForm = () => {
    setEditingId(null);
    setLabelRaw('');
    setAmountRaw('');
    setFrequency('monthly');
    setDayRaw('1');
    setAccountKey(defaultAccountKey);
  };

  const handleEdit = (event) => {
    setEditingId(event.id);
    setLabelRaw(event.label || '');
    setAmountRaw(event.amountCents > 0 ? (event.amountCents / 100).toFixed(2) : '');
    setFrequency(event.frequency || 'monthly');
    setDayRaw(String(event.dayOfMonth || 1));
    setAccountKey(event.accountKey || defaultAccountKey);
  };

  const handleSave = async () => {
    const amountCents = parseBillInput(amountRaw);
    const label = labelRaw.trim();
    if (!label || amountCents <= 0) {
      Alert.alert('Missing Details', 'Add a label and amount for this income event.');
      return;
    }
    const dayOfMonth = Math.max(1, Math.min(31, parseInt(dayRaw, 10) || 1));
    await upsertScheduledIncomeEvent({
      id: editingId || undefined,
      label,
      amountCents,
      frequency,
      dayOfMonth,
      accountKey: accountKey || defaultAccountKey || null,
      isActive: true,
    });
    recomputeVariance();
    resetForm();
    Alert.alert('Saved', 'Scheduled income updated.');
  };

  const handleRemove = (event) => {
    Alert.alert('Remove Income Event', `Remove ${event.label || 'this income event'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeScheduledIncomeEvent(event.id) },
    ]);
  };

  const accountLabel = (key) => {
    const found = activeAccounts.find(a => (a.legacyKey || a.id) === key || a.id === key);
    return found ? (found.name || found.id) : 'Unassigned';
  };

  return (
    <View>
      <Text style={styles.sectionHeader}>SCHEDULED INCOME</Text>
      {scheduled.length === 0 && (
        <Text style={styles.emptyText}>No recurring income events configured.</Text>
      )}
      {scheduled.map(event => (
        <View key={event.id} style={styles.eventCard}>
          <View style={styles.eventTopRow}>
            <View style={styles.eventTextWrap}>
              <Text style={styles.eventLabel}>{(event.label || 'Income').toUpperCase()}</Text>
              <Text style={styles.eventMeta}>
                {formatCentsShort(event.amountCents || 0)} - {event.frequency || 'monthly'} - day {event.dayOfMonth || 1}
              </Text>
              <Text style={styles.eventMeta}>{accountLabel(event.accountKey)}</Text>
            </View>
            <TouchableOpacity style={styles.textBtn} onPress={() => handleEdit(event)}>
              <Text style={styles.textBtnLabel}>EDIT</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => recordScheduledIncomeEvent(event.id)}>
              <Text style={styles.confirmBtnText}>CONFIRM RECEIVED</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(event)}>
              <Text style={styles.removeBtnText}>REMOVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.label}>{editingId ? 'Edit income label' : 'New income label'}</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Paycheck, Partner deposit, Patreon"
        placeholderTextColor={theme.textDim}
        value={labelRaw}
        onChangeText={setLabelRaw}
      />
      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 500.00"
        placeholderTextColor={theme.textDim}
        keyboardType="decimal-pad"
        value={amountRaw}
        onChangeText={setAmountRaw}
      />
      {amountRaw.length > 0 && (
        <Text style={styles.previewText}>{formatCentsShort(parseBillInput(amountRaw))}</Text>
      )}
      <Text style={styles.label}>Frequency</Text>
      <SegmentedControl options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
      {frequency !== 'unscheduled' && (
        <>
          <Text style={styles.label}>Day of month / anchor day</Text>
          <TextInput
            style={styles.input}
            placeholder="1-31"
            placeholderTextColor={theme.textDim}
            keyboardType="numeric"
            maxLength={2}
            value={dayRaw}
            onChangeText={text => setDayRaw(text.replace(/[^0-9]/g, ''))}
          />
        </>
      )}
      {activeAccounts.length > 0 && (
        <>
          <Text style={styles.label}>Destination account</Text>
          <View style={styles.segRow}>
            {activeAccounts.map(account => {
              const key = account.legacyKey || account.id;
              return (
                <TouchableOpacity
                  key={account.id}
                  style={[styles.segBtn, accountKey === key && styles.segBtnActive]}
                  onPress={() => setAccountKey(key)}
                >
                  <Text style={[styles.segText, accountKey === key && styles.segTextActive]}>
                    {(account.name || account.id).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{editingId ? 'SAVE CHANGES' : 'ADD INCOME EVENT'}</Text>
      </TouchableOpacity>
      {editingId && (
        <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
          <Text style={styles.cancelBtnText}>CANCEL EDIT</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingMD, letterSpacing: 1 },
  emptyText: { color: theme.textDim, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginBottom: theme.spacingMD, fontStyle: 'italic' },
  eventCard: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingSM, marginBottom: theme.spacingSM, backgroundColor: theme.backgroundPanel },
  eventTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacingSM },
  eventTextWrap: { flex: 1 },
  eventLabel: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, fontWeight: 'bold' },
  eventMeta: { color: theme.textDim, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS, marginTop: 2 },
  textBtn: { paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS },
  textBtnLabel: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: theme.spacingSM, marginTop: theme.spacingSM },
  confirmBtn: { flex: 1, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingVertical: theme.spacingXS, alignItems: 'center', backgroundColor: theme.accentGlow },
  confirmBtnText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS, fontWeight: 'bold' },
  removeBtn: { borderWidth: 1, borderColor: theme.statusDanger, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS, alignItems: 'center' },
  removeBtnText: { color: theme.statusDanger, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS, fontWeight: 'bold' },
  label: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS, marginTop: theme.spacingSM },
  input: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, marginBottom: theme.spacingXS },
  previewText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginBottom: theme.spacingSM },
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingXS, marginBottom: theme.spacingSM },
  segBtn: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS },
  segBtnActive: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  segText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
  segTextActive: { color: theme.accent, fontWeight: 'bold' },
  saveBtn: { backgroundColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD },
  saveBtnText: { color: theme.background, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  cancelBtn: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingSM },
  cancelBtnText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, fontWeight: 'bold' },
});
