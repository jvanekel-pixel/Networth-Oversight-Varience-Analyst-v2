import * as Crypto from 'expo-crypto';

const { gcm } = require('../../node_modules/@noble/ciphers/aes.js');
const { pbkdf2Async } = require('../../node_modules/@noble/hashes/pbkdf2.js');
const { sha256 } = require('../../node_modules/@noble/hashes/sha2.js');

export const ENCRYPTED_BACKUP_EXPORT_TYPE = 'nova_encrypted_backup';
export const BACKUP_ENCRYPTION_VERSION = 1;
export const BACKUP_PASSPHRASE_MIN_LENGTH = 8;

const DEFAULT_ITERATIONS = 210000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const AAD_TEXT = 'nova-v2-backup:v1';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = B64.split('').reduce((map, char, index) => {
  map[char] = index;
  return map;
}, {});

export const DEFAULT_BACKUP_ENCRYPTION_SETTINGS = {
  enabled: false,
  passphraseSalt: null,
  passphraseVerifier: null,
  iterations: DEFAULT_ITERATIONS,
  lastChangedAt: null,
};

function utf8ToBytes(value) {
  const text = String(value ?? '');
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    let codePoint = text.codePointAt(i);
    if (codePoint > 0xffff) i += 1;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let output = '';
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i];
    let codePoint = first;
    let advance = 1;
    if ((first & 0xe0) === 0xc0) {
      codePoint = ((first & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      advance = 2;
    } else if ((first & 0xf0) === 0xe0) {
      codePoint = ((first & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      advance = 3;
    } else if ((first & 0xf8) === 0xf0) {
      codePoint = ((first & 0x07) << 18)
        | ((bytes[i + 1] & 0x3f) << 12)
        | ((bytes[i + 2] & 0x3f) << 6)
        | (bytes[i + 3] & 0x3f);
      advance = 4;
    }
    output += String.fromCodePoint(codePoint);
    i += advance;
  }
  return output;
}

export function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let output = '';
  for (let i = 0; i < input.length; i += 3) {
    const a = input[i];
    const b = i + 1 < input.length ? input[i + 1] : 0;
    const c = i + 2 < input.length ? input[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    output += B64[(triple >> 18) & 63];
    output += B64[(triple >> 12) & 63];
    output += i + 1 < input.length ? B64[(triple >> 6) & 63] : '=';
    output += i + 2 < input.length ? B64[triple & 63] : '=';
  }
  return output;
}

export function base64ToBytes(value) {
  const clean = String(value || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array(Math.max(0, Math.floor((clean.length * 3) / 4) - padding));
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === '=') break;
    const valueAtChar = B64_LOOKUP[char];
    if (valueAtChar == null) continue;
    buffer = (buffer << 6) | valueAtChar;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (index < out.length) {
        out[index] = (buffer >> bits) & 255;
        index += 1;
      }
    }
  }

  return out;
}

function randomBytes(length) {
  return Crypto.getRandomBytes(length);
}

function normalizeIterations(value) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 100000 ? parsed : DEFAULT_ITERATIONS;
}

function cleanPassphrase(passphrase) {
  return String(passphrase || '');
}

export function isValidBackupPassphrase(passphrase) {
  return cleanPassphrase(passphrase).length >= BACKUP_PASSPHRASE_MIN_LENGTH;
}

export function normalizeBackupEncryptionSettings(settings = {}) {
  const merged = {
    ...DEFAULT_BACKUP_ENCRYPTION_SETTINGS,
    ...(settings || {}),
  };
  const hasPassphrase = !!merged.passphraseSalt && !!merged.passphraseVerifier;
  return {
    ...merged,
    enabled: !!merged.enabled && hasPassphrase,
    hasPassphrase,
    iterations: normalizeIterations(merged.iterations),
  };
}

export function isBackupEncryptionReady(settings = {}) {
  const normalized = normalizeBackupEncryptionSettings(settings);
  return normalized.enabled && normalized.hasPassphrase;
}

async function deriveBackupKey(passphrase, saltBytes, iterations = DEFAULT_ITERATIONS) {
  const clean = cleanPassphrase(passphrase);
  if (!clean) throw new Error('Backup password is required.');
  return pbkdf2Async(sha256, clean, saltBytes, {
    c: normalizeIterations(iterations),
    dkLen: KEY_BYTES,
    asyncTick: 20,
  });
}

export async function createBackupPassphraseCredential(passphrase) {
  if (!isValidBackupPassphrase(passphrase)) {
    throw new Error(`Backup password must be at least ${BACKUP_PASSPHRASE_MIN_LENGTH} characters.`);
  }
  const passphraseSaltBytes = randomBytes(SALT_BYTES);
  const iterations = DEFAULT_ITERATIONS;
  const verifier = await deriveBackupKey(passphrase, passphraseSaltBytes, iterations);
  return {
    enabled: true,
    passphraseSalt: bytesToBase64(passphraseSaltBytes),
    passphraseVerifier: bytesToBase64(verifier),
    iterations,
    lastChangedAt: Date.now(),
  };
}

export async function verifyBackupPassphrase(passphrase, settings = {}) {
  const normalized = normalizeBackupEncryptionSettings(settings);
  if (!normalized.hasPassphrase || !cleanPassphrase(passphrase)) return false;
  const saltBytes = base64ToBytes(normalized.passphraseSalt);
  const verifier = await deriveBackupKey(passphrase, saltBytes, normalized.iterations);
  return bytesToBase64(verifier) === normalized.passphraseVerifier;
}

export function isEncryptedBackupEnvelope(value) {
  return !!value
    && typeof value === 'object'
    && value.exportType === ENCRYPTED_BACKUP_EXPORT_TYPE
    && value.encrypted === true;
}

export async function encryptBackupJson(plainJson, passphrase, metadata = {}) {
  if (!isValidBackupPassphrase(passphrase)) {
    throw new Error(`Backup password must be at least ${BACKUP_PASSPHRASE_MIN_LENGTH} characters.`);
  }
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const iterations = normalizeIterations(metadata.iterations);
  const key = await deriveBackupKey(passphrase, salt, iterations);
  const aad = utf8ToBytes(AAD_TEXT);
  const cipher = gcm(key, nonce, aad);
  const ciphertext = cipher.encrypt(utf8ToBytes(plainJson));
  key.fill(0);

  return JSON.stringify({
    schemaVersion: BACKUP_ENCRYPTION_VERSION,
    exportType: ENCRYPTED_BACKUP_EXPORT_TYPE,
    encrypted: true,
    encryptedAt: new Date().toISOString(),
    appVersion: metadata.appVersion || '1.0.0',
    scope: metadata.scope || 'all',
    encryption: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-HMAC-SHA256',
      iterations,
      salt: bytesToBase64(salt),
      nonce: bytesToBase64(nonce),
      aad: AAD_TEXT,
      tagLengthBits: 128,
    },
    ciphertext: bytesToBase64(ciphertext),
  });
}

export async function decryptBackupJson(envelope, passphrase) {
  if (!isEncryptedBackupEnvelope(envelope)) {
    throw new Error('File is not a NOVA encrypted backup.');
  }
  const encryption = envelope.encryption || {};
  if (encryption.algorithm !== 'AES-256-GCM' || encryption.kdf !== 'PBKDF2-HMAC-SHA256') {
    throw new Error('Unsupported backup encryption format.');
  }
  const salt = base64ToBytes(encryption.salt);
  const nonce = base64ToBytes(encryption.nonce);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const iterations = normalizeIterations(encryption.iterations);
  const key = await deriveBackupKey(passphrase, salt, iterations);

  try {
    const aad = utf8ToBytes(encryption.aad || AAD_TEXT);
    const plainBytes = gcm(key, nonce, aad).decrypt(ciphertext);
    return bytesToUtf8(plainBytes);
  } catch (error) {
    throw new Error('Could not decrypt backup. Check the backup password.');
  } finally {
    key.fill(0);
  }
}

export function stripBackupEncryptionSecretsFromNovaConfig(novaConfig = {}) {
  if (!novaConfig || typeof novaConfig !== 'object' || !novaConfig.backupEncryption) return novaConfig;
  const { backupEncryption, ...rest } = novaConfig;
  return rest;
}
