import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../config/theme.config';
import {
  authenticateWithBiometrics,
  biometricSummary,
  getBiometricSupport,
  normalizeAppLockSettings,
  verifyPin,
} from '../utils/appLock';

export default function AppLockGate({ visible, settings, onUnlocked }) {
  const lockSettings = useMemo(() => normalizeAppLockSettings(settings), [settings]);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [support, setSupport] = useState(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const biometricReady = lockSettings.biometricEnabled && support?.canUseBiometrics;
  const biometricLabel = support?.labels?.length ? support.labels.join(' / ') : 'Biometric unlock';

  useEffect(() => {
    let mounted = true;
    if (!visible) {
      setPin('');
      setMessage('');
      setBiometricBusy(false);
      setPinBusy(false);
      return undefined;
    }
    getBiometricSupport().then(next => {
      if (!mounted) return;
      setSupport(next);
      if (lockSettings.biometricEnabled && next.canUseBiometrics) {
        requestBiometric(next);
      }
    });
    return () => {
      mounted = false;
    };
  }, [visible, lockSettings.biometricEnabled]);

  useEffect(() => {
    if (!visible || !lockSettings.pinEnabled || pin.length !== lockSettings.pinLength || pinBusy) return;
    let mounted = true;
    setPinBusy(true);
    verifyPin(pin, lockSettings)
      .then(valid => {
        if (!mounted) return;
        if (valid) {
          setPin('');
          setMessage('');
          onUnlocked?.('pin');
          return;
        }
        setPin('');
        setMessage('PIN did not match.');
      })
      .catch(() => {
        if (mounted) {
          setPin('');
          setMessage('Could not verify PIN.');
        }
      })
      .finally(() => {
        if (mounted) setPinBusy(false);
      });
    return () => {
      mounted = false;
    };
  }, [visible, pin, lockSettings, pinBusy, onUnlocked]);

  const requestBiometric = async (knownSupport = support) => {
    if (!lockSettings.biometricEnabled || !knownSupport?.canUseBiometrics || biometricBusy) return;
    setBiometricBusy(true);
    setMessage('');
    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        setPin('');
        onUnlocked?.('biometric');
      } else {
        setMessage('Biometric unlock was canceled. Enter your PIN.');
      }
    } catch {
      setMessage('Biometric unlock is unavailable. Enter your PIN.');
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={styles.root}>
        <View style={styles.brandBlock}>
          <Text style={styles.eyebrow}>PRIVATE MODE</Text>
          <Text style={styles.title}>N.O.V.A. LOCKED</Text>
          <Text style={styles.subtitle}>Unlock to view balances, transactions, and receipts.</Text>
        </View>

        <View style={styles.panel}>
          {support ? (
            <Text style={styles.biometricStatus}>
              {lockSettings.biometricEnabled ? biometricSummary(support) : 'Biometric unlock is off.'}
            </Text>
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.accent} />
              <Text style={styles.biometricStatus}>Checking biometric support...</Text>
            </View>
          )}

          {biometricReady ? (
            <TouchableOpacity
              style={[styles.primaryButton, biometricBusy && styles.disabled]}
              onPress={() => requestBiometric()}
              disabled={biometricBusy}
            >
              <Text style={styles.primaryButtonText}>
                {biometricBusy ? 'CHECKING...' : `UNLOCK WITH ${biometricLabel.toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.pinLabel}>{lockSettings.pinLength}-digit PIN</Text>
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(value) => {
              setMessage('');
              setPin(value.replace(/\D/g, '').slice(0, lockSettings.pinLength));
            }}
            placeholder={'•'.repeat(lockSettings.pinLength)}
            placeholderTextColor={theme.textDim}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={lockSettings.pinLength}
            autoFocus={!biometricReady}
          />
          <View style={styles.pinDots}>
            {Array.from({ length: lockSettings.pinLength }).map((_, index) => (
              <View key={index} style={[styles.dot, index < pin.length && styles.dotFilled]} />
            ))}
          </View>
          {message ? <Text style={styles.error}>{message}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
    padding: theme.spacingLG,
    justifyContent: 'center',
  },
  brandBlock: {
    marginBottom: theme.spacingLG,
  },
  eyebrow: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    letterSpacing: 1,
    marginBottom: theme.spacingXS,
  },
  title: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXXL,
    fontWeight: 'bold',
  },
  subtitle: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
    marginTop: theme.spacingXS,
  },
  panel: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingLG,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
  },
  biometricStatus: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    lineHeight: 18,
    marginBottom: theme.spacingMD,
  },
  primaryButton: {
    backgroundColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginBottom: theme.spacingLG,
  },
  primaryButtonText: {
    color: theme.background,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.55,
  },
  pinLabel: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginBottom: theme.spacingXS,
  },
  pinInput: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: 24,
    letterSpacing: 0,
    padding: theme.spacingMD,
    textAlign: 'center',
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacingSM,
    marginTop: theme.spacingMD,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  dotFilled: {
    backgroundColor: theme.accent,
  },
  error: {
    color: theme.statusDanger,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    textAlign: 'center',
    marginTop: theme.spacingMD,
  },
});
