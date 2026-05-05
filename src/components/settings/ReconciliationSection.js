import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import DatePickerField from '../DatePickerField';
import { formatCentsShort, parseBillInput } from '../../utils/currency';
import { localDateKey } from '../../utils/reconciliation';

function accountKeyFor(account) {
  return account?.legacyKey || account?.id || null;
}

function accountRows(accountRegistry = [], accounts = {}) {
  const registryRows = (accountRegistry || [])
    .filter(account => account && account.isActive !== false)
    .map(account => ({
      key: accountKeyFor(account),
      label: account.name || account.id,
      role: account.role || null,
      balanceCents: accounts[accountKeyFor(account)] || 0,
    }))
    .filter(account => account.key);
  if (registryRows.length > 0) return registryRows;
  return Object.keys(accounts || {}).map(key => ({
    key,
    label: key,
    role: null,
    balanceCents: accounts[key] || 0,
  }));
}

function statusLabel(record) {
  if (record.status === 'matched') return 'MATCHED';
  if (record.status === 'adjusted') return 'ADJUSTED';
  return 'VARIANCE';
}

export default function ReconciliationSection() {
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = useStore((s) => s.accounts);
  const reconciliationHistory = useStore((s) => s.reconciliationHistory);
  const reconcileAccount = useStore((s) => s.reconcileAccount);

  const rows = useMemo(() => accountRows(accountRegistry, accounts), [accountRegistry, accounts]);
  const [selectedAccountKey, setSelectedAccountKey] = useState(rows[0]?.key || null);
  const [asOfDate, setAsOfDate] = useState(localDateKey());
  const [bankRaw, setBankRaw] = useState('');
  const [note, setNote] = useState('');
  const [updateBalance, setUpdateBalance] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedAccountKey && rows[0]?.key) setSelectedAccountKey(rows[0].key);
    if (selectedAccountKey && !rows.some(row => row.key === selectedAccountKey)) {
      setSelectedAccountKey(rows[0]?.key || null);
    }
  }, [rows, selectedAccountKey]);

  const selectedAccount = rows.find(row => row.key === selectedAccountKey) || rows[0] || null;
  const bankBalanceCents = parseBillInput(bankRaw);
  const novaBalanceCents = selectedAccount?.balanceCents || 0;
  const differenceCents = bankRaw.trim() ? bankBalanceCents - novaBalanceCents : 0;
  const selectedHistory = useMemo(
    () => (reconciliationHistory || [])
      .filter(record => record?.accountKey === selectedAccountKey)
      .slice(0, 6),
    [reconciliationHistory, selectedAccountKey],
  );

  async function saveReconciliation() {
    if (saving) return;
    if (!selectedAccountKey) {
      Alert.alert('Choose an account', 'Add or select an account before reconciling.');
      return;
    }
    if (!bankRaw.trim()) {
      Alert.alert('Bank balance needed', 'Enter the balance shown by the bank statement.');
      return;
    }
    try {
      setSaving(true);
      const record = await reconcileAccount({
        accountKey: selectedAccountKey,
        asOfDate,
        bankBalanceCents,
        note,
        updateBalance,
      });
      setBankRaw('');
      setNote('');
      setUpdateBalance(false);
      Alert.alert(
        'Reconciliation saved',
        record.differenceCents === 0
          ? 'NOVA and the bank matched for that account.'
          : `${formatCentsShort(Math.abs(record.differenceCents))} difference recorded${record.adjustedBalance ? ' and current balance updated.' : '.'}`,
      );
    } catch (error) {
      Alert.alert('Reconciliation failed', error.message || 'Could not save reconciliation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Text style={styles.subtitle}>
        Save a statement-style audit trail: account, as-of date, bank balance, NOVA balance, and any difference.
      </Text>

      <Text style={styles.label}>Account</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No accounts available.</Text>
      ) : (
        <View style={styles.accountGrid}>
          {rows.map(account => {
            const active = account.key === selectedAccountKey;
            return (
              <TouchableOpacity
                key={account.key}
                style={[styles.accountChip, active && styles.accountChipActive]}
                onPress={() => setSelectedAccountKey(account.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.accountChipName, active && styles.accountChipNameActive]} numberOfLines={1}>
                  {account.label}
                </Text>
                <Text style={styles.accountChipMeta}>{formatCentsShort(account.balanceCents)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <DatePickerField value={asOfDate} onChange={setAsOfDate} label="Statement as-of date" />

      <Text style={styles.label}>Bank statement balance</Text>
      <TextInput
        style={styles.input}
        value={bankRaw}
        onChangeText={setBankRaw}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={theme.textDim}
      />

      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>NOVA balance</Text>
          <Text style={styles.summaryValue}>{formatCentsShort(novaBalanceCents)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Bank balance</Text>
          <Text style={styles.summaryValue}>{bankRaw.trim() ? formatCentsShort(bankBalanceCents) : '--'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Difference</Text>
          <Text style={[styles.summaryValue, differenceCents === 0 ? styles.matchText : styles.diffText]}>
            {bankRaw.trim() ? formatCentsShort(differenceCents) : '--'}
          </Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleLabel}>Update current NOVA balance</Text>
          <Text style={styles.toggleHint}>Use only when the current app balance should be corrected to the bank balance.</Text>
        </View>
        <Switch
          value={updateBalance}
          onValueChange={setUpdateBalance}
          trackColor={{ false: theme.borderColorDim, true: theme.accent }}
          thumbColor={theme.background}
        />
      </View>

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Statement ending, bank portal, correction context..."
        placeholderTextColor={theme.textDim}
        multiline
      />

      <TouchableOpacity
        style={[styles.saveBtn, (saving || rows.length === 0) && styles.disabled]}
        onPress={saveReconciliation}
        disabled={saving || rows.length === 0}
      >
        <Text style={styles.saveBtnText}>SAVE RECONCILIATION</Text>
      </TouchableOpacity>

      <Text style={styles.historyHeader}>RECENT HISTORY</Text>
      {selectedHistory.length === 0 ? (
        <Text style={styles.emptyText}>No reconciliations saved for this account.</Text>
      ) : selectedHistory.map(record => (
        <View key={record.id} style={styles.historyRow}>
          <View style={styles.historyTop}>
            <Text style={styles.historyDate}>{record.asOfDate}</Text>
            <Text style={[
              styles.historyStatus,
              record.status === 'variance' && styles.historyStatusWarn,
              record.status === 'matched' && styles.historyStatusMatch,
            ]}>
              {statusLabel(record)}
            </Text>
          </View>
          <Text style={styles.historyMeta}>
            Bank {formatCentsShort(record.bankBalanceCents)} / NOVA {formatCentsShort(record.novaBalanceCents)} / Diff {formatCentsShort(record.differenceCents)}
          </Text>
          {record.note ? <Text style={styles.historyNote}>{record.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
    marginBottom: theme.spacingMD,
  },
  label: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingSM,
  },
  accountChip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    minWidth: 128,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingSM,
  },
  accountChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  accountChipName: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
  },
  accountChipNameActive: {
    color: theme.accent,
  },
  accountChipMeta: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 2,
  },
  input: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingXS,
  },
  noteInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  summaryBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.borderColorDim,
    marginTop: theme.spacingSM,
    paddingVertical: theme.spacingSM,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    paddingVertical: theme.spacingXS,
  },
  summaryLabel: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  summaryValue: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
  },
  matchText: {
    color: theme.statusPositive,
  },
  diffText: {
    color: theme.statusWarning,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    paddingVertical: theme.spacingMD,
    marginTop: theme.spacingSM,
  },
  toggleCopy: {
    flex: 1,
    marginRight: theme.spacingMD,
  },
  toggleLabel: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
  },
  toggleHint: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    lineHeight: 15,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginTop: theme.spacingMD,
  },
  saveBtnText: {
    color: theme.background,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  historyHeader: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: theme.spacingLG,
    marginBottom: theme.spacingSM,
  },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingVertical: theme.spacingSM,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
  },
  historyDate: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
  },
  historyStatus: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
  historyStatusWarn: {
    color: theme.statusWarning,
  },
  historyStatusMatch: {
    color: theme.statusPositive,
  },
  historyMeta: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    lineHeight: 16,
    marginTop: 2,
  },
  historyNote: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
    paddingVertical: theme.spacingSM,
  },
});
