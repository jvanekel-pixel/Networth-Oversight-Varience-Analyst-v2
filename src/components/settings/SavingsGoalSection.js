import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import theme from '../../config/theme.config';
import personality from '../../config/personality.config';
import useStore from '../../store/useStore';
import { parseBillInput, formatCentsShort } from '../../utils/currency';

const PRESETS = [
  { key: 'emergency_1k', label: 'Emergency Fund', amount: 100000 },
  { key: 'buffer_5k',    label: '3-Month Buffer',  amount: 500000 },
  { key: 'down_20k',     label: 'Down Payment',    amount: 2000000 },
];

export default function SavingsGoalSection() {
  const novaConfig = useStore((s) => s.novaConfig);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const updateSavingsGoal = useStore((s) => s.updateSavingsGoal);
  const current = novaConfig?.savingsGoal || { key: null, targetCents: 0, label: null, accountId: null };
  const eligibleAccounts = [...(accountRegistry || [])]
    .filter((a) => a.isActive !== false && a.type === 'savings');
  const linkedAccount = eligibleAccounts.find((a) => (a.legacyKey || a.id) === current.accountId || a.id === current.accountId);

  const [selectedKey, setSelectedKey] = useState(current?.key || null);
  const [customRaw, setCustomRaw] = useState(
    current?.key === 'custom' ? String((current.targetCents || 0) / 100) : ''
  );
  const [accountId, setAccountId] = useState(current?.accountId || null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (current) {
      setSelectedKey(current.key);
      if (current.key === 'custom') setCustomRaw(String((current.targetCents || 0) / 100));
      setAccountId(current.accountId || null);
    }
  }, []);

  async function handleSave() {
    let goal = null;
    if (selectedKey && selectedKey !== 'custom') {
      const preset = PRESETS.find((p) => p.key === selectedKey);
      goal = { key: selectedKey, targetCents: preset.amount, label: preset.label, accountId };
    } else if (selectedKey === 'custom') {
      goal = { key: 'custom', targetCents: parseBillInput(customRaw), label: 'Custom Goal', accountId };
    }
    await updateSavingsGoal(goal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <View>
      <Text style={styles.header}>SAVINGS GOAL</Text>
      {current?.targetCents > 0 && (
        <Text style={styles.current}>
          Current: {current.label || personality.savingsGoal.defaultLabel} - {formatCentsShort(current.targetCents || 0)}
        </Text>
      )}
      <Text style={styles.linkedText}>
        Linked account: {linkedAccount ? (linkedAccount.name || linkedAccount.id) : personality.savingsGoal.settingsNotLinked}
      </Text>
      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.chip, selectedKey === p.key && styles.chipOn]}
            onPress={() => setSelectedKey(p.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, selectedKey === p.key && styles.chipTextOn]}>
              {p.label.toUpperCase()}
            </Text>
            <Text style={[styles.chipAmt, selectedKey === p.key && styles.chipTextOn]}>
              {formatCentsShort(p.amount)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, selectedKey === 'custom' && styles.chipOn]}
          onPress={() => setSelectedKey('custom')}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, selectedKey === 'custom' && styles.chipTextOn]}>CUSTOM</Text>
        </TouchableOpacity>
      </View>
      {selectedKey === 'custom' && (
        <TextInput
          style={styles.input}
          value={customRaw}
          onChangeText={setCustomRaw}
          placeholder="Target amount"
          placeholderTextColor={theme.textDim}
          keyboardType="decimal-pad"
        />
      )}
      {selectedKey && (
        <View style={styles.accountBlock}>
          <Text style={styles.subHeader}>TRACK PROGRESS FROM</Text>
          {eligibleAccounts.length === 0 ? (
            <Text style={styles.empty}>No savings accounts available. Add one above to track progress.</Text>
          ) : (
            <View style={styles.accountGrid}>
              <TouchableOpacity
                style={[styles.accountChip, accountId === null && styles.accountChipOn]}
                onPress={() => setAccountId(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.accountChipText, accountId === null && styles.chipTextOn]}>
                  {personality.savingsGoal.settingsNotLinked.toUpperCase()}
                </Text>
              </TouchableOpacity>
              {eligibleAccounts.map((account) => {
                const key = account.legacyKey || account.id;
                const selected = accountId === key;
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={[styles.accountChip, selected && styles.accountChipOn]}
                    onPress={() => setAccountId(key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.accountChipText, selected && styles.chipTextOn]}>
                      {(account.name || account.id).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveText}>{saved ? 'SAVED' : 'SAVE GOAL'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, marginBottom: theme.spacingMD, fontWeight: 'bold' },
  current: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingMD },
  linkedText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingMD },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingSM, marginBottom: theme.spacingMD },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingSM, alignItems: 'center' },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextOn: { color: theme.accent },
  chipAmt: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 2 },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel, marginBottom: theme.spacingMD },
  accountBlock: { marginBottom: theme.spacingMD },
  subHeader: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginBottom: theme.spacingSM },
  empty: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontStyle: 'italic' },
  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingSM },
  accountChip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS },
  accountChipOn: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  accountChipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  saveBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, alignItems: 'center', backgroundColor: theme.accentGlow },
  saveText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
});
