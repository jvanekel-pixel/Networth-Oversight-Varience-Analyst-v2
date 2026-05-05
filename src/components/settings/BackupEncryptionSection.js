import React, { useMemo, useState } from 'react';
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
import {
  BACKUP_PASSPHRASE_MIN_LENGTH,
  DEFAULT_BACKUP_ENCRYPTION_SETTINGS,
  createBackupPassphraseCredential,
  normalizeBackupEncryptionSettings,
  verifyBackupPassphrase,
} from '../../utils/backupCrypto';

export default function BackupEncryptionSection() {
  const novaConfig = useStore((s) => s.novaConfig);
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const backupEncryption = useMemo(
    () => normalizeBackupEncryptionSettings(novaConfig?.backupEncryption),
    [novaConfig?.backupEncryption],
  );
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [saving, setSaving] = useState(false);

  const resetInputs = () => {
    setCurrentPassphrase('');
    setNewPassphrase('');
    setConfirmPassphrase('');
  };

  const saveBackupEncryption = async (updates) => {
    await updateNovaConfig({
      backupEncryption: {
        ...DEFAULT_BACKUP_ENCRYPTION_SETTINGS,
        ...(novaConfig?.backupEncryption || {}),
        ...updates,
      },
    });
  };

  const handleToggle = async (enabled) => {
    if (enabled && !backupEncryption.hasPassphrase) {
      Alert.alert('Set a backup password', 'Create a backup password before turning encrypted backups on.');
      return;
    }
    await saveBackupEncryption({ enabled });
  };

  const handleSavePassphrase = async () => {
    if (saving) return;
    if (newPassphrase.length < BACKUP_PASSPHRASE_MIN_LENGTH) {
      Alert.alert('Password too short', `Use at least ${BACKUP_PASSPHRASE_MIN_LENGTH} characters for backup encryption.`);
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      Alert.alert('Password mismatch', 'The backup password and confirmation do not match.');
      return;
    }
    if (backupEncryption.hasPassphrase) {
      const valid = await verifyBackupPassphrase(currentPassphrase, backupEncryption);
      if (!valid) {
        Alert.alert('Current password needed', 'Enter the current backup password before changing it.');
        setCurrentPassphrase('');
        return;
      }
    }

    try {
      setSaving(true);
      const credential = await createBackupPassphraseCredential(newPassphrase);
      await saveBackupEncryption(credential);
      resetInputs();
      Alert.alert('Saved', 'Encrypted JSON backups are enabled.');
    } catch (error) {
      Alert.alert('Not saved', error.message || 'Could not save backup encryption.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Turn off backup encryption?',
      'Future JSON backups will be plaintext unless you set a new backup password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn Off',
          style: 'destructive',
          onPress: async () => {
            resetInputs();
            await saveBackupEncryption({
              enabled: false,
              passphraseSalt: null,
              passphraseVerifier: null,
              lastChangedAt: Date.now(),
            });
          },
        },
      ],
    );
  };

  const canSave = newPassphrase.length >= BACKUP_PASSPHRASE_MIN_LENGTH
    && confirmPassphrase.length >= BACKUP_PASSPHRASE_MIN_LENGTH
    && (!backupEncryption.hasPassphrase || currentPassphrase.length > 0);

  return (
    <View>
      <Text style={styles.subtitle}>Protect import-ready JSON backups with AES-256-GCM. NOVA cannot recover this password. Scheduled auto-export pauses while encryption is on.</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={[styles.statusText, backupEncryption.enabled ? styles.statusOn : styles.statusOff]}>
          {backupEncryption.enabled ? 'ENCRYPTION ON' : 'ENCRYPTION OFF'}
        </Text>
        <Text style={styles.statusSub}>
          {backupEncryption.hasPassphrase ? 'Backup password configured' : 'No backup password configured'}
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextBlock}>
          <Text style={styles.toggleLabel}>Encrypt JSON backups</Text>
          <Text style={styles.toggleHint}>Exports ask for this password; imports require the same password.</Text>
        </View>
        <Switch
          value={backupEncryption.enabled}
          onValueChange={handleToggle}
          trackColor={{ false: theme.borderColorDim, true: theme.accent }}
          thumbColor={theme.background}
        />
      </View>

      {backupEncryption.hasPassphrase ? (
        <>
          <Text style={styles.label}>Current backup password</Text>
          <PassphraseInput value={currentPassphrase} onChange={setCurrentPassphrase} placeholder="Current password" />
        </>
      ) : null}

      <Text style={styles.label}>{backupEncryption.hasPassphrase ? 'New backup password' : 'Create backup password'}</Text>
      <PassphraseInput value={newPassphrase} onChange={setNewPassphrase} placeholder="At least 8 characters" />

      <Text style={styles.label}>Confirm backup password</Text>
      <PassphraseInput value={confirmPassphrase} onChange={setConfirmPassphrase} placeholder="Repeat password" />

      <TouchableOpacity
        style={[styles.saveBtn, (!canSave || saving) && styles.disabled]}
        onPress={handleSavePassphrase}
        disabled={!canSave || saving}
      >
        <Text style={styles.saveBtnText}>{backupEncryption.hasPassphrase ? 'CHANGE BACKUP PASSWORD' : 'SET PASSWORD & ENABLE'}</Text>
      </TouchableOpacity>

      {backupEncryption.hasPassphrase ? (
        <TouchableOpacity style={styles.disableBtn} onPress={handleRemove}>
          <Text style={styles.disableText}>TURN OFF BACKUP ENCRYPTION</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PassphraseInput({ value, onChange, placeholder }) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={placeholder}
      placeholderTextColor={theme.textDim}
    />
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
  statusBox: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  statusLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginBottom: theme.spacingXS,
  },
  statusText: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
  },
  statusOn: {
    color: theme.accent,
  },
  statusOff: {
    color: theme.textSecondary,
  },
  statusSub: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: theme.spacingXS,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingVertical: theme.spacingMD,
    marginTop: theme.spacingSM,
  },
  toggleTextBlock: {
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
  label: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  input: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    letterSpacing: 0,
    padding: theme.spacingMD,
    marginBottom: theme.spacingXS,
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
  disableBtn: {
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginTop: theme.spacingMD,
    backgroundColor: theme.statusDangerBg,
  },
  disableText: {
    color: theme.statusDanger,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
});
