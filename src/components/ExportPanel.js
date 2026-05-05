import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { useExport } from '../hooks/useExport';
import {
  BACKUP_PASSPHRASE_MIN_LENGTH,
  isValidBackupPassphrase,
  normalizeBackupEncryptionSettings,
  verifyBackupPassphrase,
} from '../utils/backupCrypto';

function getAccountRows(accountRegistry, accounts) {
  const registryRows = (accountRegistry || [])
    .filter(account => account && account.isActive !== false)
    .map(account => ({
      key: account.legacyKey || account.id,
      label: account.name || account.id,
    }))
    .filter(account => account.key);

  if (registryRows.length > 0) return registryRows;
  return Object.keys(accounts || {}).map(key => ({ key, label: key }));
}

function CheckRow({ checked, label, description, onPress, disabled = false }) {
  return (
    <TouchableOpacity
      style={[styles.checkRow, disabled && styles.disabledRow]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
    >
      <Text style={[styles.checkMark, checked && styles.checkMarkOn]}>{checked ? '[x]' : '[ ]'}</Text>
      <View style={styles.checkCopy}>
        <Text style={[styles.checkLabel, checked && styles.checkLabelOn]}>{label}</Text>
        {description ? <Text style={styles.checkDescription}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ExportPanel({ destinationLabel = '' }) {
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = useStore((s) => s.accounts);
  const novaConfig = useStore((s) => s.novaConfig);
  const { exportBundle } = useExport();
  const backupEncryption = useMemo(
    () => normalizeBackupEncryptionSettings(novaConfig?.backupEncryption),
    [novaConfig?.backupEncryption],
  );
  const accountRows = useMemo(
    () => getAccountRows(accountRegistry, accounts),
    [accountRegistry, accounts],
  );
  const [open, setOpen] = useState(false);
  const [fullSystemBackup, setFullSystemBackup] = useState(true);
  const [householdBackup, setHouseholdBackup] = useState(false);
  const [businessBackup, setBusinessBackup] = useState(false);
  const [accountBackup, setAccountBackup] = useState(false);
  const [accountCsv, setAccountCsv] = useState(false);
  const [accountPdf, setAccountPdf] = useState(false);
  const [businessCsvs, setBusinessCsvs] = useState(false);
  const [encryptBackups, setEncryptBackups] = useState(backupEncryption.enabled);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [selectedAccountKeys, setSelectedAccountKeys] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (selectedAccountKeys.length === 0 && accountRows.length > 0) {
      setSelectedAccountKeys(accountRows.map(account => account.key));
    }
  }, [accountRows.map(account => account.key).join('|')]);

  useEffect(() => {
    setEncryptBackups(backupEncryption.enabled);
  }, [backupEncryption.enabled, backupEncryption.passphraseVerifier]);

  const toggleAccount = (key) => {
    setSelectedAccountKeys(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]
    );
  };

  const handleExportPress = async () => {
    if (!open) {
      setOpen(true);
      return;
    }
    const needsAccounts = accountBackup || accountCsv || accountPdf;
    const hasAnySelection = fullSystemBackup || householdBackup || businessBackup || businessCsvs || needsAccounts;
    if (!hasAnySelection) {
      Alert.alert('Nothing selected', 'Choose at least one export option.');
      return;
    }
    if (needsAccounts && selectedAccountKeys.length === 0) {
      Alert.alert('No accounts selected', 'Choose at least one account.');
      return;
    }

    const wantsJsonBackup = fullSystemBackup || householdBackup || businessBackup || accountBackup;
    const shouldEncryptJson = wantsJsonBackup && encryptBackups;
    if (shouldEncryptJson) {
      if (!backupPassphrase.trim()) {
        Alert.alert('Backup password needed', 'Enter the backup password before exporting encrypted JSON backups.');
        return;
      }
      if (!isValidBackupPassphrase(backupPassphrase)) {
        Alert.alert('Backup password too short', `Use at least ${BACKUP_PASSPHRASE_MIN_LENGTH} characters for encrypted backups.`);
        return;
      }
      if (backupEncryption.hasPassphrase) {
        const valid = await verifyBackupPassphrase(backupPassphrase, backupEncryption);
        if (!valid) {
          Alert.alert('Wrong backup password', 'The backup password does not match the one saved in Settings.');
          setBackupPassphrase('');
          return;
        }
      }
    }

    setIsExporting(true);
    await exportBundle({
      fullSystemBackup,
      householdBackup,
      businessBackup,
      accountBackup,
      accountCsv,
      accountPdf,
      businessCsvs,
      accountKeys: selectedAccountKeys,
      encryptBackups: shouldEncryptJson,
      backupPassphrase: shouldEncryptJson ? backupPassphrase : '',
      destinationLabel,
    });
    setIsExporting(false);
  };

  const wantsJsonBackup = fullSystemBackup || householdBackup || businessBackup || accountBackup;

  return (
    <View style={styles.exportSection}>
      <Text style={styles.sectionHeader}>EXPORT</Text>
      <Text style={styles.portabilityText}>
        JSON backups import into NOVA. CSV and PDF exports are portable records.
      </Text>

      {open ? (
        <View style={styles.optionsPanel}>
          <CheckRow
            checked={fullSystemBackup}
            label="[FULL SYSTEM BACK-UP]"
            description="Everything needed for a complete restore."
            onPress={() => setFullSystemBackup(value => !value)}
          />
          <CheckRow
            checked={householdBackup}
            label="Household backup"
            onPress={() => setHouseholdBackup(value => !value)}
          />
          <CheckRow
            checked={businessBackup}
            label="Business backup"
            onPress={() => setBusinessBackup(value => !value)}
          />
          <CheckRow
            checked={accountBackup}
            label="Selected account backup"
            description="Balances, account registry, and matching ledger rows."
            onPress={() => setAccountBackup(value => !value)}
          />
          <CheckRow
            checked={accountCsv}
            label="Selected account CSV"
            onPress={() => setAccountCsv(value => !value)}
          />
          <CheckRow
            checked={accountPdf}
            label="Selected account PDF"
            onPress={() => setAccountPdf(value => !value)}
          />
          <CheckRow
            checked={businessCsvs}
            label="Business tax CSVs"
            onPress={() => setBusinessCsvs(value => !value)}
          />
          <CheckRow
            checked={encryptBackups}
            label="Encrypt JSON backups"
            description={backupEncryption.hasPassphrase
              ? 'Uses the backup password saved in Settings.'
              : 'Use an ad hoc password for this export.'}
            onPress={() => setEncryptBackups(value => !value)}
            disabled={!wantsJsonBackup}
          />
          {wantsJsonBackup && encryptBackups ? (
            <>
              <Text style={styles.accountHeader}>BACKUP PASSWORD</Text>
              <TextInput
                style={styles.passphraseInput}
                value={backupPassphrase}
                onChangeText={setBackupPassphrase}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Required for encrypted JSON backups"
                placeholderTextColor={theme.textDim}
              />
            </>
          ) : null}

          <Text style={styles.accountHeader}>ACCOUNTS</Text>
          {accountRows.length === 0 ? (
            <Text style={styles.emptyText}>No active accounts.</Text>
          ) : accountRows.map(account => (
            <CheckRow
              key={account.key}
              checked={selectedAccountKeys.includes(account.key)}
              label={account.label}
              onPress={() => toggleAccount(account.key)}
            />
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
        onPress={handleExportPress}
        disabled={isExporting}
      >
        <Text style={styles.exportBtnText}>{open ? 'EXPORT SELECTED' : 'EXPORT'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  exportSection: {
    backgroundColor: theme.backgroundCard,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    borderWidth: 1,
    gap: theme.spacingSM,
    padding: theme.spacingMD,
  },
  sectionHeader: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
    letterSpacing: 1,
  },
  portabilityText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
  },
  optionsPanel: {
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    borderWidth: 1,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingSM,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacingSM,
    paddingVertical: theme.spacingSM,
    borderBottomColor: theme.borderColorDim,
    borderBottomWidth: 1,
  },
  disabledRow: {
    opacity: 0.45,
  },
  checkMark: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    width: 34,
  },
  checkMarkOn: {
    color: theme.accent,
    fontWeight: '700',
  },
  checkCopy: {
    flex: 1,
  },
  checkLabel: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  checkLabelOn: {
    color: theme.textPrimary,
    fontWeight: '700',
  },
  checkDescription: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    lineHeight: 16,
    marginTop: 2,
  },
  accountHeader: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: theme.spacingSM,
  },
  passphraseInput: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    letterSpacing: 0,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  emptyText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
    paddingVertical: theme.spacingSM,
  },
  exportBtn: {
    minHeight: 46,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
  },
  exportBtnDisabled: {
    opacity: 0.55,
  },
  exportBtnText: {
    color: theme.background,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
    textAlign: 'center',
  },
});
