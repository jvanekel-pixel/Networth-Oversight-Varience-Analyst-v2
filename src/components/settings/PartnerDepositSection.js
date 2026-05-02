import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { formatCentsShort, parseBillInput } from '../../utils/currency';

const SCHEDULE_OPTIONS = [
  { label: 'Last day', value: 'last_day' },
  { label: 'Last Friday', value: 'last_friday' },
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
  const { incomeEvents, novaConfig, updateConfig, recomputeVariance, recordPartnerDeposit, awardXP, rotateFlavorTextForEvent } = useStore();
  const userMode = novaConfig?.userMode;

  const [depositAmtRaw, setDepositAmtRaw] = useState('');
  const [depositSchedule, setDepositSchedule] = useState('last_day');

  useEffect(() => {
    if (!incomeEvents) return;
    const dAmt = incomeEvents.partnerDepositAmountCents ?? incomeEvents.partnerDepositAmount ?? 0;
    setDepositAmtRaw(dAmt > 0 ? (dAmt / 100).toFixed(2) : '');
    setDepositSchedule(incomeEvents.partnerDepositSchedule || 'last_day');
  }, []);

  if (userMode === 'solo') return null;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const depositConfirmedThisMonth = incomeEvents?.partnerDepositLastReceivedMonth === currentMonth;
  const lastConfirmedDate = incomeEvents?.partnerDepositLastReceivedMonth
    ? (() => {
        const [y, m] = incomeEvents.partnerDepositLastReceivedMonth.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      })()
    : null;

  const handleSave = async () => {
    const partnerDepositAmountCents = parseBillInput(depositAmtRaw);
    await updateConfig({ incomeEvents: { ...incomeEvents, partnerDepositAmountCents, partnerDepositSchedule: depositSchedule } });
    recomputeVariance();
    Alert.alert('Saved', 'Partner deposit updated.');
  };

  const handleConfirmReceived = async () => {
    const amt = parseBillInput(depositAmtRaw) || (incomeEvents.partnerDepositAmountCents ?? incomeEvents.partnerDepositAmount ?? 0);
    if (!amt) { Alert.alert('Amount Required', 'Enter the deposit amount first.'); return; }
    await recordPartnerDeposit(amt);
    awardXP(10);
    rotateFlavorTextForEvent('partner_deposit_received');
    Alert.alert('Confirmed', 'Partner deposit recorded.');
  };

  return (
    <View>
      <Text style={styles.sectionHeader}>PARTNER DEPOSIT</Text>
      <Text style={styles.label}>Expected amount</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 500.00"
        placeholderTextColor={theme.textDim}
        keyboardType="decimal-pad"
        value={depositAmtRaw}
        onChangeText={setDepositAmtRaw}
      />
      {depositAmtRaw.length > 0 && (
        <Text style={styles.previewText}>{formatCentsShort(parseBillInput(depositAmtRaw))}</Text>
      )}
      <Text style={styles.label}>Expected schedule</Text>
      <SegmentedControl options={SCHEDULE_OPTIONS} value={depositSchedule} onChange={setDepositSchedule} />
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>SAVE</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.confirmBtn, depositConfirmedThisMonth && styles.confirmBtnDisabled]}
        onPress={depositConfirmedThisMonth ? undefined : handleConfirmReceived}
        disabled={depositConfirmedThisMonth}
      >
        <Text style={[styles.confirmBtnText, depositConfirmedThisMonth && styles.confirmBtnTextDisabled]}>
          CONFIRM RECEIVED
        </Text>
      </TouchableOpacity>
      <Text style={styles.lastConfirmedText}>
        {depositConfirmedThisMonth
          ? `Last confirmed: ${lastConfirmedDate || 'this month'}`
          : 'Not confirmed this month'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingMD, letterSpacing: 1 },
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
  confirmBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD },
  confirmBtnDisabled: { borderColor: theme.borderColorDim, opacity: 0.5 },
  confirmBtnText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  confirmBtnTextDisabled: { color: theme.textDim },
  lastConfirmedText: { color: theme.textDim, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginTop: theme.spacingSM, textAlign: 'center' },
});
