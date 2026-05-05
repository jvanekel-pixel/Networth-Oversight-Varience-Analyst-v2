import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

export const RECEIPT_DIRECTORY = `${FileSystem.documentDirectory || ''}nova_receipts/`;

const BASE64_ENCODING = FileSystem.EncodingType?.Base64 || 'base64';
const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
};

function safePart(value) {
  return String(value || 'receipt')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'receipt';
}

function extensionFromUri(uri = '') {
  const clean = String(uri).split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = match ? match[1].toLowerCase() : '';
  return IMAGE_MIME_BY_EXT[ext] ? ext : '';
}

function extensionFromAsset(asset = {}) {
  return extensionFromUri(asset.fileName)
    || extensionFromUri(asset.uri)
    || EXT_BY_MIME[String(asset.mimeType || '').toLowerCase()]
    || 'jpg';
}

function mimeFromFileName(fileName = '', fallback = 'image/jpeg') {
  const ext = extensionFromUri(fileName);
  return IMAGE_MIME_BY_EXT[ext] || fallback;
}

function safeFileName(fileName = '', fallback = '') {
  const ext = extensionFromUri(fileName) || extensionFromUri(fallback) || 'jpg';
  const base = safePart(String(fileName || fallback || `receipt.${ext}`).replace(/\.[^.]+$/, ''));
  return `${base}.${ext}`;
}

async function ensureReceiptDirectory() {
  const info = await FileSystem.getInfoAsync(RECEIPT_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPT_DIRECTORY, { intermediates: true });
  }
}

export function normalizeReceiptAttachments(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((item, index) => {
        if (typeof item === 'string') {
          const fileName = safeFileName(item, `receipt_${index}.jpg`);
          return {
            id: `receipt_${index}`,
            uri: item,
            fileName,
            mimeType: mimeFromFileName(fileName),
          };
        }
        const fileName = item.fileName || safeFileName(item.uri || item.name, `receipt_${index}.jpg`);
        return {
          ...item,
          id: item.id || `receipt_${index}`,
          uri: item.uri || (fileName ? `${RECEIPT_DIRECTORY}${fileName}` : null),
          fileName,
          mimeType: item.mimeType || mimeFromFileName(fileName),
        };
      })
      .filter(item => item.uri || item.fileName);
  }
  return [];
}

export function getReceiptAttachments(record) {
  const attachments = normalizeReceiptAttachments(record?.receiptAttachments);
  if (attachments.length > 0) return attachments;
  if (record?.receiptUri) {
    const fileName = safeFileName(record.receiptFileName || record.receiptUri, record.id || 'receipt.jpg');
    return [{
      id: record.receiptAttachmentId || `receipt_${record.id || Date.now()}`,
      uri: record.receiptUri,
      fileName,
      mimeType: record.receiptMimeType || mimeFromFileName(fileName),
      createdAt: record.receiptCreatedAt || record.createdAt || record.timestamp || null,
      source: record.receiptSource || 'legacy',
    }];
  }
  return [];
}

export function withReceiptAttachments(record, attachments) {
  const normalized = normalizeReceiptAttachments(attachments);
  const first = normalized[0] || null;
  return {
    ...record,
    receiptAttachments: normalized,
    receiptUri: first?.uri || null,
    receiptFileName: first?.fileName || null,
    receiptMimeType: first?.mimeType || null,
  };
}

export function receiptCount(record) {
  return getReceiptAttachments(record).length;
}

export function receiptFileSummary(record) {
  return getReceiptAttachments(record)
    .map(item => item.fileName || item.uri)
    .filter(Boolean)
    .join('; ');
}

async function copyReceiptAssetAsync(asset, recordId, source) {
  if (!asset?.uri) return null;
  await ensureReceiptDirectory();
  const ext = extensionFromAsset(asset);
  const id = `receipt_${safePart(recordId)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const fileName = `${id}.${ext}`;
  const targetUri = `${RECEIPT_DIRECTORY}${fileName}`;
  await FileSystem.copyAsync({ from: asset.uri, to: targetUri });
  const info = await FileSystem.getInfoAsync(targetUri);
  return {
    id,
    uri: targetUri,
    fileName,
    mimeType: asset.mimeType || mimeFromFileName(fileName),
    width: asset.width || null,
    height: asset.height || null,
    size: info.exists ? info.size || null : null,
    source,
    createdAt: Date.now(),
  };
}

export async function pickReceiptImageAsync(source, recordId) {
  if (source === 'file') {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets?.[0];
    if (!asset?.uri) return null;
    return copyReceiptAssetAsync({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType,
      width: null,
      height: null,
    }, recordId, 'file');
  }

  const fromCamera = source === 'camera';
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(fromCamera ? 'Camera permission was denied.' : 'Photo library permission was denied.');
  }

  const pickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
    base64: false,
  };
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync({
      ...pickerOptions,
      allowsMultipleSelection: false,
    });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  return copyReceiptAssetAsync(asset, recordId, fromCamera ? 'camera' : 'library');
}

function receiptRecordsFromData(data = {}) {
  const keys = [
    'nova_v2_transactions',
    'nova_v2_generic_business_income',
    'nova_v2_generic_business_expenses',
    'nova_v2_generic_business_mileage',
  ];
  return keys.flatMap(key => Array.isArray(data[key]) ? data[key] : []);
}

export async function collectReceiptFilesForData(data = {}) {
  const files = [];
  const seen = new Set();
  for (const record of receiptRecordsFromData(data)) {
    for (const attachment of getReceiptAttachments(record)) {
      const fileName = attachment.fileName || safeFileName(attachment.uri, attachment.id || record.id);
      const uri = attachment.uri || `${RECEIPT_DIRECTORY}${fileName}`;
      const key = fileName || uri;
      if (!uri || seen.has(key)) continue;
      seen.add(key);
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) continue;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: BASE64_ENCODING });
        files.push({
          id: attachment.id || key,
          fileName,
          mimeType: attachment.mimeType || mimeFromFileName(fileName),
          size: info.size || attachment.size || null,
          originalUri: attachment.uri || null,
          base64,
        });
      } catch (e) {
        console.warn('receipt export skipped:', e?.message || e);
      }
    }
  }
  return files;
}

export async function restoreReceiptFilesFromBackup(receiptFiles = []) {
  const uriMap = {};
  if (!Array.isArray(receiptFiles) || receiptFiles.length === 0) return uriMap;
  await ensureReceiptDirectory();
  for (const file of receiptFiles) {
    if (!file?.base64) continue;
    const fileName = safeFileName(file.fileName || file.id, 'receipt.jpg');
    const targetUri = `${RECEIPT_DIRECTORY}${fileName}`;
    try {
      await FileSystem.writeAsStringAsync(targetUri, file.base64, { encoding: BASE64_ENCODING });
      if (file.originalUri) uriMap[file.originalUri] = targetUri;
      if (file.uri) uriMap[file.uri] = targetUri;
      if (file.fileName) uriMap[file.fileName] = targetUri;
      uriMap[fileName] = targetUri;
    } catch (e) {
      console.warn('receipt import skipped:', e?.message || e);
    }
  }
  return uriMap;
}

function remapRecordReceipts(record, uriMap) {
  if (!record || typeof record !== 'object') return record;
  const attachments = getReceiptAttachments(record);
  if (attachments.length === 0) return record;
  const nextAttachments = attachments.map(attachment => {
    const uri = uriMap[attachment.uri] || uriMap[attachment.fileName] || attachment.uri;
    return { ...attachment, uri };
  });
  return withReceiptAttachments(record, nextAttachments);
}

export function remapReceiptUrisInData(data = {}, uriMap = {}) {
  if (!uriMap || Object.keys(uriMap).length === 0) return data;
  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const mapped = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return mapped.receiptAttachments || mapped.receiptUri ? remapRecordReceipts(mapped, uriMap) : mapped;
  };
  return visit(data);
}

export async function deleteReceiptFileAsync(attachment) {
  if (!attachment?.uri) return;
  try {
    await FileSystem.deleteAsync(attachment.uri, { idempotent: true });
  } catch (e) {
    console.warn('receipt delete skipped:', e?.message || e);
  }
}
