import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

export const PIN_LENGTH_OPTIONS = [4, 6];

export const DEFAULT_APP_LOCK_SETTINGS = {
  enabled: false,
  pinEnabled: false,
  pinLength: 4,
  pinSalt: null,
  pinHash: null,
  biometricEnabled: false,
  lockAfterMs: 0,
  lastChangedAt: null,
};

const HASH_NAMESPACE = 'nova-v2-app-lock';

function cleanPinLength(length) {
  const parsed = parseInt(length, 10);
  return PIN_LENGTH_OPTIONS.includes(parsed) ? parsed : 4;
}

export function normalizeAppLockSettings(settings = {}) {
  const merged = {
    ...DEFAULT_APP_LOCK_SETTINGS,
    ...(settings || {}),
  };
  const pinLength = cleanPinLength(merged.pinLength);
  const hasPin = !!merged.pinHash && !!merged.pinSalt;
  return {
    ...merged,
    pinLength,
    pinEnabled: hasPin,
    enabled: !!merged.enabled && hasPin,
    biometricEnabled: !!merged.biometricEnabled && hasPin,
    lockAfterMs: Math.max(0, Math.trunc(Number(merged.lockAfterMs ?? 0))),
  };
}

export function isAppLockEnabled(settings = {}) {
  const normalized = normalizeAppLockSettings(settings);
  return normalized.enabled && normalized.pinEnabled;
}

export function isValidPin(pin, length = 4) {
  const cleanLength = cleanPinLength(length);
  return new RegExp(`^\\d{${cleanLength}}$`).test(String(pin || ''));
}

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${HASH_NAMESPACE}:${salt}:${pin}`,
  );
}

export async function createPinCredential(pin, length = 4) {
  const pinLength = cleanPinLength(length);
  if (!isValidPin(pin, pinLength)) {
    throw new Error(`PIN must be exactly ${pinLength} digits.`);
  }
  const salt = `${Crypto.randomUUID()}:${Date.now()}`;
  const pinHash = await hashPin(pin, salt);
  return {
    pinLength,
    pinSalt: salt,
    pinHash,
    pinEnabled: true,
    lastChangedAt: Date.now(),
  };
}

export async function verifyPin(pin, settings = {}) {
  const normalized = normalizeAppLockSettings(settings);
  if (!normalized.pinEnabled || !isValidPin(pin, normalized.pinLength)) return false;
  const pinHash = await hashPin(pin, normalized.pinSalt);
  return pinHash === normalized.pinHash;
}

export async function getBiometricSupport() {
  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const types = Array.isArray(supportedTypes) ? supportedTypes : [];
    return {
      hasHardware,
      isEnrolled,
      supportedTypes: types,
      labels: biometricLabels(types),
      canUseBiometrics: hasHardware && isEnrolled && types.length > 0,
    };
  } catch {
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: [],
      labels: [],
      canUseBiometrics: false,
    };
  }
}

export function biometricLabels(types = []) {
  const labels = [];
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    labels.push('Fingerprint');
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    labels.push('Face ID');
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    labels.push('Iris');
  }
  return labels;
}

export function biometricSummary(support = {}) {
  if (!support.hasHardware) return 'No biometric sensor detected.';
  if (!support.isEnrolled) return 'Biometric sensor found, but no face or fingerprint is enrolled on this device.';
  if (!support.labels?.length) return 'Biometric unlock is available.';
  return support.labels.join(' / ');
}

export async function authenticateWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock N.O.V.A.',
    cancelLabel: 'Use PIN',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'weak',
  });
  return !!result?.success;
}

export function sanitizedAppLockForBackup(settings = {}) {
  const normalized = normalizeAppLockSettings(settings);
  return {
    enabled: false,
    pinEnabled: false,
    pinLength: normalized.pinLength,
    biometricEnabled: false,
    lockAfterMs: normalized.lockAfterMs,
    lastChangedAt: normalized.lastChangedAt || null,
  };
}

export function stripAppLockSecretsFromNovaConfig(novaConfig = {}) {
  if (!novaConfig || typeof novaConfig !== 'object') return novaConfig;
  if (!novaConfig.appLock) return novaConfig;
  return {
    ...novaConfig,
    appLock: sanitizedAppLockForBackup(novaConfig.appLock),
  };
}
