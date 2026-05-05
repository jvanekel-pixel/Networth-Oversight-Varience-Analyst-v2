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
import {
  DEFAULT_APP_LOCK_SETTINGS,
  PIN_LENGTH_OPTIONS,
  biometricSummary,
  createPinCredential,
  getBiometricSupport,
  normalizeAppLockSettings,
  verifyPin,
} from '../../utils/appLock';

export default function AppLockSettingsSection() {
  const novaConfig = useStore((s) => s.novaConfig);
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const appLock = useMemo(() => normalizeAppLockSettings(novaConfig?.appLock), [novaConfig?.appLock]);
  const [support, setSupport] = useState(null);
  const [pinLength, setPinLength] = useState(appLock.pinLength);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getBiometricSupport().then(next => {
      if (mounted) setSupport(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPinLength(appLock.pinLength);
  }, [appLock.pinLength]);

  const saveAppLock = async (updates) => {
    const next = normalizeAppLockSettings({
      ...DEFAULT_APP_LOCK_SETTINGS,
      ...(novaConfig?.appLock || {}),
      ...updates,
    });
    await updateNovaConfig({ appLock: next });
  };

  const resetPinInputs = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleSetPin = async () => {
    if (saving) return;
    if (newPin !== confirmPin) {
      Alert.alert('PIN mismatch', 'The new PIN and confirmation PIN do not match.');
      return;
    }
    if (appLock.pinEnabled) {
      const validCurrent = await verifyPin(currentPin, appLock);
      if (!validCurrent) {
        Alert.alert('Current PIN needed', 'Enter the current PIN before changing it.');
        setCurrentPin('');
        return;
      }
    }
    try {
      setSaving(true);
      const credential = await createPinCredential(newPin, pinLength);
      await saveAppLock({
        ...credential,
        enabled: true,
      });
      resetPinInputs();
      Alert.alert('Saved', `${credential.pinLength}-digit app PIN is active.`);
    } catch (error) {
      Alert.alert('PIN not saved', error.message || 'Could not save app PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (enabled) => {
    if (enabled && !appLock.pinEnabled) {
      Alert.alert('Set a PIN first', 'NOVA requires a 4- or 6-digit PIN before app lock can be enabled.');
      return;
    }
    await saveAppLock({
      enabled,
      biometricEnabled: enabled ? appLock.biometricEnabled : false,
    });
  };

  const handleToggleBiometric = async (biometricEnabled) => {
    if (biometricEnabled && !appLock.pinEnabled) {
      Alert.alert('Set a PIN first', 'PIN stays available as the fallback if biometrics fail.');
      return;
    }
    if (biometricEnabled && !support?.canUseBiometrics) {
      Alert.alert('Biometrics unavailable', biometricSummary(support || {}));
      return;
    }
    await saveAppLock({
      enabled: biometricEnabled ? true : appLock.enabled,
      biometricEnabled,
    });
  };

  const handleDisable = () => {
    Alert.alert(
      'Turn off app lock?',
      'This removes the local PIN credential and disables biometric unlock for NOVA.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn Off',
          style: 'destructive',
          onPress: async () => {
            await saveAppLock({
              enabled: false,
              pinEnabled: false,
              pinHash: null,
              pinSalt: null,
              biometricEnabled: false,
              lastChangedAt: Date.now(),
            });
            resetPinInputs();
          },
        },
      ],
    );
  };

  return (
    <View>
      <Text style={styles.header}>APP LOCK</Text>
      <Text style={styles.subtitle}>Require biometric unlock or a local PIN before balances and records are visible.</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={[styles.statusText, appLock.enabled ? styles.statusOn : styles.statusOff]}>
          {appLock.enabled ? 'LOCK ENABLED' : 'LOCK OFF'}
        </Text>
        <Text style={styles.statusSub}>
          {appLock.pinEnabled ? `${appLock.pinLength}-digit PIN configured` : 'No PIN configured'}
        </Text>
      </View>

      <Text style={styles.label}>PIN length</Text>
      <View style={styles.segmentRow}>
        {PIN_LENGTH_OPTIONS.map(length => (
          <TouchableOpacity
            key={length}
            style={[styles.segment, pinLength === length && styles.segmentActive]}
            onPress={() => {
              setPinLength(length);
              setNewPin('');
              setConfirmPin('');
            }}
          >
            <Text style={[styles.segmentText, pinLength === length && styles.segmentTextActive]}>
              {length} DIGIT
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {appLock.pinEnabled ? (
        <>
          <Text style={styles.label}>Current PIN</Text>
          <PinInput value={currentPin} onChange={setCurrentPin} length={appLock.pinLength} />
        </>
      ) : null}
      <Text style={styles.label}>{appLock.pinEnabled ? 'New PIN' : 'Create PIN'}</Text>
      <PinInput value={newPin} onChange={setNewPin} length={pinLength} />
      <Text style={styles.label}>Confirm PIN</Text>
      <PinInput value={confirmPin} onChange={setConfirmPin} length={pinLength} />

      <TouchableOpacity
        style={[
          styles.saveBtn,
          (saving || newPin.length !== pinLength || confirmPin.length !== pinLength || (appLock.pinEnabled && currentPin.length !== appLock.pinLength)) && styles.disabled,
        ]}
        onPress={handleSetPin}
        disabled={saving || newPin.length !== pinLength || confirmPin.length !== pinLength || (appLock.pinEnabled && currentPin.length !== appLock.pinLength)}
      >
        <Text style={styles.saveBtnText}>{appLock.pinEnabled ? 'CHANGE PIN' : 'SET PIN & ENABLE LOCK'}</Text>
      </TouchableOpacity>

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextBlock}>
          <Text style={styles.toggleLabel}>Require lock on app open</Text>
          <Text style={styles.toggleHint}>NOVA locks again whenever the app leaves the foreground.</Text>
        </View>
        <Switch
          value={appLock.enabled}
          onValueChange={handleToggleLock}
          trackColor={{ false: theme.borderColorDim, true: theme.accent }}
          thumbColor={theme.background}
        />
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextBlock}>
          <Text style={styles.toggleLabel}>Biometric unlock</Text>
          <Text style={styles.toggleHint}>{support ? biometricSummary(support) : 'Checking biometric support...'}</Text>
        </View>
        <Switch
          value={appLock.biometricEnabled}
          onValueChange={handleToggleBiometric}
          trackColor={{ false: theme.borderColorDim, true: theme.accent }}
          thumbColor={theme.background}
        />
      </View>

      {appLock.pinEnabled ? (
        <TouchableOpacity style={styles.disableBtn} onPress={handleDisable}>
          <Text style={styles.disableText}>TURN OFF APP LOCK</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PinInput({ value, onChange, length }) {
  return (
    <TextInput
      style={styles.pinInput}
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={length}
      placeholder={'•'.repeat(length)}
      placeholderTextColor={theme.textDim}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
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
  label: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: theme.spacingXS,
    marginBottom: theme.spacingSM,
  },
  segment: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  segmentActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  segmentText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  segmentTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  pinInput: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeLG,
    letterSpacing: 0,
    padding: theme.spacingMD,
    marginBottom: theme.spacingXS,
    textAlign: 'center',
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
  },
  disabled: {
    opacity: 0.5,
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
