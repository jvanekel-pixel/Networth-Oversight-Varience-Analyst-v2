import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import useStore from '../store/useStore';
import {
  buildFullJsonExport,
  buildAccountCsv,
  buildAccountPdfHtml,
  buildBusinessIncomeCsv,
  buildBusinessExpenseCsv,
  buildBusinessMileageCsv,
  buildBusinessTransactionsCsv,
  buildBusinessSummaryCsv,
  buildExportManifest,
  validateImportJson,
} from '../utils/exportUtils';
import {
  collectReceiptFilesForData,
  remapReceiptUrisInData,
  restoreReceiptFilesFromBackup,
} from '../utils/receiptFiles';
import { savingsGoalsForScope } from '../utils/savingsGoals';
import { stripAppLockSecretsFromNovaConfig } from '../utils/appLock';

const EXPORT_CONFIG_KEY = 'nova_v2_export_config';
const NOVA_PREFIX = 'nova_v2_';
const APP_VERSION = '1.1.1';
const AUTO_BACKUP_DIR = `${FileSystem.documentDirectory || ''}nova_backups/`;
const JSON_MIME = 'application/json';
const TEXT_MIME = 'text/plain';

const STORAGE = {
  accounts: 'nova_v2_accounts',
  accountFloors: 'nova_v2_accountFloors',
  householdBills: 'nova_v2_householdBills',
  personalBills: 'nova_v2_personalBills',
  billOverrides: 'nova_v2_billOverrides',
  incomeEvents: 'nova_v2_incomeEvents',
  groceryBudget: 'nova_v2_groceryBudget',
  groceryHistory: 'nova_v2_grocery_history',
  groceryEntries: 'nova_v2_grocery_entries',
  personalGroceryBudget: 'nova_v2_personal_grocery_budget',
  personalGroceryHistory: 'nova_v2_personal_grocery_history',
  personalGroceryEntries: 'nova_v2_personal_grocery_entries',
  transactions: 'nova_v2_transactions',
  recurringTransactions: 'nova_v2_recurring_transactions',
  irsRatePerMile: 'nova_v2_irsRatePerMile',
  genericBusinessIncome: 'nova_v2_generic_business_income',
  genericBusinessExpenses: 'nova_v2_generic_business_expenses',
  genericBusinessMileage: 'nova_v2_generic_business_mileage',
  novaConfig: 'nova_v2_config',
  accountRegistry: 'nova_v2_account_registry',
  businesses: 'nova_v2_businesses',
  spendingBuckets: 'nova_v2_spending_buckets',
  varianceConfig: 'nova_v2_variance_config',
  dashboardCardOrder: 'nova_v2_dashboard_card_order',
  personalCardOrder: 'nova_v2_personal_card_order',
  householdCardOrder: 'nova_v2_household_card_order',
  businessCardOrder: 'nova_v2_business_card_order',
  dashboardHiddenCards: 'nova_v2_dashboard_hidden_cards',
  personalHiddenCards: 'nova_v2_personal_hidden_cards',
  householdHiddenCards: 'nova_v2_household_hidden_cards',
  businessHiddenCards: 'nova_v2_business_hidden_cards',
  groceryReserveOn: 'nova_v2_grocery_reserve_on',
  importCategoryRules: 'nova_v2_import_category_rules',
  reconciliationHistory: 'nova_v2_account_reconciliations',
};

const ARRAY_MERGE_KEYS = new Set([
  STORAGE.accountRegistry,
  STORAGE.householdBills,
  STORAGE.personalBills,
  STORAGE.groceryEntries,
  STORAGE.groceryHistory,
  STORAGE.personalGroceryEntries,
  STORAGE.personalGroceryHistory,
  STORAGE.transactions,
  STORAGE.recurringTransactions,
  STORAGE.genericBusinessIncome,
  STORAGE.genericBusinessExpenses,
  STORAGE.genericBusinessMileage,
  STORAGE.businesses,
  STORAGE.spendingBuckets,
  STORAGE.importCategoryRules,
  STORAGE.reconciliationHistory,
]);

const OBJECT_MERGE_KEYS = new Set([
  STORAGE.accounts,
  STORAGE.accountFloors,
  STORAGE.billOverrides,
  STORAGE.incomeEvents,
  STORAGE.novaConfig,
  STORAGE.varianceConfig,
]);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function timestampStr() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function shareFile(uri, mimeType = 'application/octet-stream') {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('Sharing unavailable', 'This device does not support file sharing.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Share N.O.V.A. export' });
}

function storageEntries(data) {
  return Object.entries(data || {})
    .filter(([key, value]) => key.startsWith(NOVA_PREFIX) && value !== undefined)
    .map(([key, value]) => [key, JSON.stringify(value)]);
}

function sanitizeBackupData(data = {}) {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...data };
  if (sanitized[STORAGE.novaConfig]) {
    const { backupEncryption, ...safeNovaConfig } = stripAppLockSecretsFromNovaConfig(sanitized[STORAGE.novaConfig]);
    sanitized[STORAGE.novaConfig] = safeNovaConfig;
  }
  return sanitized;
}

async function readNovaStorage() {
  const allKeys = await AsyncStorage.getAllKeys();
  const novaKeys = allKeys.filter(k => k.startsWith(NOVA_PREFIX));
  const pairs = await AsyncStorage.multiGet(novaKeys);
  const data = {};
  for (const [key, value] of pairs) {
    try { data[key] = JSON.parse(value); } catch { data[key] = value; }
  }
  return data;
}

function accountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

function accountKeysForRole(state, role) {
  return new Set((state.accountRegistry || [])
    .filter(account => account && account.isActive !== false && account.role === role)
    .map(accountKey)
    .filter(Boolean));
}

function pickObjectKeys(source = {}, keys = new Set()) {
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source || {}, key)) out[key] = source[key];
  }
  return out;
}

function pickFloors(source = {}, keys = new Set()) {
  const out = pickObjectKeys(source, keys);
  if (Object.prototype.hasOwnProperty.call(source || {}, 'others')) out.others = source.others;
  return out;
}

function buildHouseholdIncomeEvents(incomeEvents = {}, householdAccountKeys = new Set()) {
  const scheduledIncomeEvents = (incomeEvents?.scheduledIncomeEvents || []).filter(event =>
    !event.accountKey || householdAccountKeys.has(event.accountKey)
  );
  const scoped = { scheduledIncomeEvents };
  [
    'partnerDepositAmount',
    'partnerDepositAmountCents',
    'partnerDepositExpected',
    'partnerDepositExpectedDay',
    'partnerDepositLastReceivedMonth',
    'partnerDepositMigrated',
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(incomeEvents || {}, key)) {
      scoped[key] = incomeEvents[key];
    }
  });
  return scoped;
}

function upsertArrayById(current = [], incoming = []) {
  const merged = new Map();
  (current || []).forEach((item, index) => {
    const key = item?.id || `current_${index}`;
    merged.set(key, item);
  });
  (incoming || []).forEach((item, index) => {
    const key = item?.id || `incoming_${index}`;
    merged.set(key, item);
  });
  return Array.from(merged.values());
}

function mergeIncomingData(currentData, incomingData, scope) {
  if (scope === 'all') return incomingData;
  const merged = { ...currentData };
  for (const [key, value] of Object.entries(incomingData || {})) {
    if (ARRAY_MERGE_KEYS.has(key)) {
      merged[key] = upsertArrayById(currentData[key] || [], value || []);
    } else if (key === STORAGE.incomeEvents && value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = {
        ...(currentData[key] || {}),
        ...value,
        scheduledIncomeEvents: upsertArrayById(
          currentData[key]?.scheduledIncomeEvents || [],
          value.scheduledIncomeEvents || [],
        ),
      };
    } else if (key === STORAGE.novaConfig && value && typeof value === 'object' && !Array.isArray(value)) {
      const savingsGoals = upsertArrayById(currentData[key]?.savingsGoals || [], value.savingsGoals || []);
      merged[key] = {
        ...(currentData[key] || {}),
        ...value,
        savingsGoals,
        savingsGoal: savingsGoals[0] || value.savingsGoal || currentData[key]?.savingsGoal || null,
      };
    } else if (OBJECT_MERGE_KEYS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = { ...(currentData[key] || {}), ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function businessBackupData(state) {
  const businessAccountKeys = accountKeysForRole(state, 'business');
  const businesses = state.businesses || [];
  const income = state.genericBusinessIncome || [];
  const expenses = state.genericBusinessExpenses || [];
  const mileage = state.genericBusinessMileage || [];
  businesses.forEach(business => {
    if (business?.defaultAccountKey) businessAccountKeys.add(business.defaultAccountKey);
  });
  [...income, ...expenses].forEach(record => {
    if (record?.accountKey) businessAccountKeys.add(record.accountKey);
  });

  const transactions = (state.transactions || []).filter(tx => {
    const sourceType = String(tx?.sourceType || '');
    if (tx?.source === 'business' || sourceType.startsWith('business_') || tx?.businessId) return true;
    return tx?.accountKey && businessAccountKeys.has(tx.accountKey);
  });
  transactions.forEach(tx => {
    if (tx?.accountKey) businessAccountKeys.add(tx.accountKey);
  });

  return {
    [STORAGE.accounts]: pickObjectKeys(state.accounts || {}, businessAccountKeys),
    [STORAGE.accountFloors]: pickFloors(state.accountFloors || {}, businessAccountKeys),
    [STORAGE.transactions]: transactions,
    [STORAGE.irsRatePerMile]: state.irsRatePerMile,
    [STORAGE.genericBusinessIncome]: income,
    [STORAGE.genericBusinessExpenses]: expenses,
    [STORAGE.genericBusinessMileage]: mileage,
    [STORAGE.recurringTransactions]: (state.recurringTransactions || []).filter(item => item?.scope === 'business'),
    [STORAGE.accountRegistry]: (state.accountRegistry || []).filter(account => businessAccountKeys.has(accountKey(account))),
    [STORAGE.businesses]: businesses,
    [STORAGE.novaConfig]: { entrepreneurMode: true, ...savingsConfigForScope(state, 'business') },
    [STORAGE.varianceConfig]: { business: state.varianceConfig?.business },
    [STORAGE.businessCardOrder]: state.businessCardOrder || [],
    [STORAGE.businessHiddenCards]: state.businessHiddenCards || [],
    [STORAGE.importCategoryRules]: state.importCategoryRules || [],
    [STORAGE.reconciliationHistory]: (state.reconciliationHistory || []).filter(item =>
      item?.accountKey && businessAccountKeys.has(item.accountKey)
    ),
  };
}

function householdBackupData(state) {
  const householdAccountKeys = accountKeysForRole(state, 'household');
  if (Object.prototype.hasOwnProperty.call(state.accounts || {}, 'jointChecking')) {
    householdAccountKeys.add('jointChecking');
  }
  (state.householdBills || []).forEach(bill => {
    if (bill?.defaultAccountKey || bill?.accountKey) householdAccountKeys.add(bill.defaultAccountKey || bill.accountKey);
  });
  const householdBillIds = new Set((state.householdBills || []).map(bill => bill.id).filter(Boolean));
  const transactions = (state.transactions || []).filter(tx => {
    if (tx?.accountKey && householdAccountKeys.has(tx.accountKey)) return true;
    if (tx?.source === 'grocery') return tx?.groceryScope !== 'personal';
    return tx?.source === 'bill' && householdBillIds.has(tx.sourceId);
  });
  transactions.forEach(tx => {
    if (tx?.accountKey) householdAccountKeys.add(tx.accountKey);
  });
  const billOverrides = {};
  for (const billId of householdBillIds) {
    if (state.billOverrides?.[billId]) billOverrides[billId] = state.billOverrides[billId];
  }
  const incomeEvents = buildHouseholdIncomeEvents(state.incomeEvents || {}, householdAccountKeys);

  return {
    [STORAGE.accounts]: pickObjectKeys(state.accounts || {}, householdAccountKeys),
    [STORAGE.accountFloors]: pickFloors(state.accountFloors || {}, householdAccountKeys),
    [STORAGE.accountRegistry]: (state.accountRegistry || []).filter(account => householdAccountKeys.has(accountKey(account))),
    [STORAGE.householdBills]: state.householdBills || [],
    [STORAGE.billOverrides]: billOverrides,
    [STORAGE.incomeEvents]: incomeEvents,
    [STORAGE.groceryBudget]: state.groceryBudget,
    [STORAGE.groceryHistory]: (state.groceryHistory || []).filter(record => record?.scope !== 'personal'),
    [STORAGE.groceryEntries]: (state.groceryEntries || []).filter(entry => entry?.scope !== 'personal'),
    [STORAGE.transactions]: transactions,
    [STORAGE.recurringTransactions]: (state.recurringTransactions || []).filter(item => item?.scope === 'household'),
    [STORAGE.spendingBuckets]: (state.spendingBuckets || []).filter(bucket => {
      const name = String(bucket?.name || bucket?.label || '').toLowerCase();
      return name.includes('grocery') || name.includes('groceries') || bucket?.scope === 'household';
    }),
    [STORAGE.novaConfig]: { userMode: state.novaConfig?.userMode, ...savingsConfigForScope(state, 'household') },
    [STORAGE.varianceConfig]: { household: state.varianceConfig?.household },
    [STORAGE.householdCardOrder]: state.householdCardOrder || [],
    [STORAGE.householdHiddenCards]: state.householdHiddenCards || [],
    [STORAGE.groceryReserveOn]: state.groceryReserveOn,
    [STORAGE.importCategoryRules]: state.importCategoryRules || [],
    [STORAGE.reconciliationHistory]: (state.reconciliationHistory || []).filter(item =>
      item?.accountKey && householdAccountKeys.has(item.accountKey)
    ),
  };
}

function accountNameForKey(state, key) {
  const account = (state.accountRegistry || []).find(item => item && (item.id === key || item.legacyKey === key));
  return account ? (account.name || account.id) : key;
}

function savingsConfigForScope(state, scope) {
  const savingsGoals = savingsGoalsForScope(state.novaConfig?.savingsGoals, scope);
  return {
    savingsGoals,
    savingsGoal: savingsGoals[0] || null,
  };
}

function selectedAccountsBackupData(state, selectedAccountKeys = []) {
  const selectedKeys = new Set((selectedAccountKeys || []).filter(Boolean));
  const selectedRoles = new Set((state.accountRegistry || [])
    .filter(account => selectedKeys.has(accountKey(account)))
    .map(account => account.role)
    .filter(Boolean));
  const transactions = (state.transactions || []).filter(tx => tx?.accountKey && selectedKeys.has(tx.accountKey));
  const linkedBillIds = new Set(transactions.filter(tx => tx.source === 'bill' && tx.sourceId).map(tx => tx.sourceId));
  const linkedBusinessIds = new Set(transactions.filter(tx => tx.businessId).map(tx => tx.businessId));
  const includeHouseholdGrocery = selectedRoles.has('household')
    || transactions.some(tx => tx?.source === 'grocery' && tx?.groceryScope !== 'personal');
  const includePersonalGrocery = selectedRoles.has('personal')
    || transactions.some(tx => tx?.source === 'grocery' && tx?.groceryScope === 'personal');
  const billOverrides = {};
  linkedBillIds.forEach(billId => {
    if (state.billOverrides?.[billId]) billOverrides[billId] = state.billOverrides[billId];
  });
  const savingsGoals = (state.novaConfig?.savingsGoals || []).filter(goal => {
    const goalAccountKey = goal?.accountId || goal?.accountKey;
    return (goalAccountKey && selectedKeys.has(goalAccountKey)) || selectedRoles.has(goal?.scope);
  });

  return {
    [STORAGE.accounts]: pickObjectKeys(state.accounts || {}, selectedKeys),
    [STORAGE.accountFloors]: pickFloors(state.accountFloors || {}, selectedKeys),
    [STORAGE.accountRegistry]: (state.accountRegistry || []).filter(account => selectedKeys.has(accountKey(account))),
    [STORAGE.transactions]: transactions,
    [STORAGE.recurringTransactions]: (state.recurringTransactions || []).filter(item =>
      selectedKeys.has(item?.accountKey) || selectedRoles.has(item?.scope)
    ),
    [STORAGE.householdBills]: (state.householdBills || []).filter(bill =>
      linkedBillIds.has(bill.id) || selectedKeys.has(bill.defaultAccountKey || bill.accountKey)
    ),
    [STORAGE.personalBills]: (state.personalBills || []).filter(bill =>
      linkedBillIds.has(bill.id) || selectedKeys.has(bill.defaultAccountKey || bill.accountKey)
    ),
    [STORAGE.billOverrides]: billOverrides,
    [STORAGE.genericBusinessIncome]: (state.genericBusinessIncome || []).filter(record =>
      selectedKeys.has(record.accountKey) || linkedBusinessIds.has(record.businessId)
    ),
    [STORAGE.genericBusinessExpenses]: (state.genericBusinessExpenses || []).filter(record =>
      selectedKeys.has(record.accountKey) || linkedBusinessIds.has(record.businessId)
    ),
    [STORAGE.businesses]: (state.businesses || []).filter(business =>
      linkedBusinessIds.has(business.id) || selectedKeys.has(business.defaultAccountKey)
    ),
    [STORAGE.novaConfig]: { savingsGoals, savingsGoal: savingsGoals[0] || null },
    [STORAGE.importCategoryRules]: state.importCategoryRules || [],
    [STORAGE.reconciliationHistory]: (state.reconciliationHistory || []).filter(item =>
      item?.accountKey && selectedKeys.has(item.accountKey)
    ),
    ...(includeHouseholdGrocery ? {
      [STORAGE.groceryBudget]: state.groceryBudget,
      [STORAGE.groceryHistory]: state.groceryHistory || [],
      [STORAGE.groceryEntries]: state.groceryEntries || [],
      [STORAGE.householdCardOrder]: state.householdCardOrder || [],
      [STORAGE.householdHiddenCards]: state.householdHiddenCards || [],
      [STORAGE.groceryReserveOn]: state.groceryReserveOn,
    } : {}),
    ...(includePersonalGrocery ? {
      [STORAGE.personalGroceryBudget]: state.personalGroceryBudget,
      [STORAGE.personalGroceryHistory]: state.personalGroceryHistory || [],
      [STORAGE.personalGroceryEntries]: state.personalGroceryEntries || [],
      [STORAGE.personalCardOrder]: state.personalCardOrder || [],
      [STORAGE.personalHiddenCards]: state.personalHiddenCards || [],
      [STORAGE.groceryReserveOn]: state.groceryReserveOn,
    } : {}),
  };
}

async function readExportConfig() {
  const raw = await AsyncStorage.getItem(EXPORT_CONFIG_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveExportConfig(updates) {
  const cfg = await readExportConfig();
  const next = { ...cfg, ...updates };
  await AsyncStorage.setItem(EXPORT_CONFIG_KEY, JSON.stringify(next));
  return next;
}

function normalizeFileScope(scope) {
  if (scope === 'all') return 'full_system';
  if (scope === 'accounts') return 'selected_accounts';
  return scope;
}

async function ensureAutoBackupDirectory() {
  const info = await FileSystem.getInfoAsync(AUTO_BACKUP_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUTO_BACKUP_DIR, { intermediates: true });
  }
}

async function writeManagedBackupFile(fileName, body, mimeType, options = {}) {
  const cfg = await readExportConfig();
  const directoryUri = options.backupDirectoryUri || cfg.backupDirectoryUri || null;
  const useBackupDirectory = options.useBackupDirectory !== false && !!directoryUri;
  const shouldShare = options.share !== false && !useBackupDirectory;

  if (useBackupDirectory && FileSystem.StorageAccessFramework?.createFileAsync) {
    const displayName = String(fileName || 'nova_export.json').replace(/[^\w.-]+/g, '_');
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, displayName, mimeType);
    await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, body, { encoding: 'utf8' });
    return { fileName, path: uri, savedToDirectory: true, shared: false };
  }

  if (options.auto === true) {
    await ensureAutoBackupDirectory();
    const path = `${AUTO_BACKUP_DIR}${fileName}`;
    await FileSystem.writeAsStringAsync(path, body, { encoding: 'utf8' });
    return { fileName, path, savedToDirectory: false, shared: false };
  }

  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, body, { encoding: 'utf8' });
  if (shouldShare) await shareFile(path, mimeType);
  return { fileName, path, savedToDirectory: false, shared: shouldShare };
}

async function writeJsonBackupFile(scope, data, options = {}) {
  const backupData = sanitizeBackupData(data);
  const receiptFiles = await collectReceiptFilesForData(backupData);
  const json = buildFullJsonExport(backupData, scope, { receiptFiles });
  const fileName = `nova_${normalizeFileScope(scope)}_backup_${timestampStr()}.json`;
  return writeManagedBackupFile(fileName, json, JSON_MIME, options);
}

async function writeBackupFile(scope, data, options = {}) {
  const { fileName } = await writeJsonBackupFile(scope, data, options);
  await writeManifestFile(scope, [fileName], 'json_backup', options);
}

async function writeCsvFile(fileName, csv, { share = true } = {}) {
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
  if (share) await shareFile(path, 'text/csv');
  return { fileName, path };
}

async function writePdfFile(fileName, html, { share = true } = {}) {
  const printed = await Print.printToFileAsync({ html, base64: false });
  const targetPath = `${FileSystem.cacheDirectory}${fileName}`;
  const existing = await FileSystem.getInfoAsync(targetPath);
  if (existing.exists) await FileSystem.deleteAsync(targetPath, { idempotent: true });
  await FileSystem.copyAsync({ from: printed.uri, to: targetPath });
  if (share) await shareFile(targetPath, 'application/pdf');
  return { fileName, path: targetPath };
}

async function writeManifestFile(scope, files, exportKind, options = {}) {
  const fileName = `nova_export_manifest_${scope}_${timestampStr()}.txt`;
  const manifest = buildExportManifest({
    scope,
    appVersion: APP_VERSION,
    files: [...files, fileName],
    exportKind,
    destinationLabel: options.destinationLabel,
  });
  await writeManagedBackupFile(fileName, manifest, TEXT_MIME, options);
}

export function useExport() {
  async function exportAllData(options = {}) {
    try {
      const data = await readNovaStorage();
      await writeBackupFile('all', data, options);
      await saveExportConfig({ lastExportTimestamp: Date.now(), lastAutoExportDate: todayStr() });
      useStore.getState().rotateFlavorTextForEvent?.('export_complete');
    } catch (e) {
      console.warn('exportAllData error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function exportScopedData(scope) {
    try {
      const state = useStore.getState();
      const data = scope === 'business'
        ? businessBackupData(state)
        : householdBackupData(state);
      await writeBackupFile(scope, data);
      useStore.getState().rotateFlavorTextForEvent?.('export_complete');
    } catch (e) {
      console.warn('exportScopedData error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  const exportBusinessData = () => exportScopedData('business');
  const exportHouseholdData = () => exportScopedData('household');

  async function importAllData(options = {}) {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'application/octet-stream', '*/*'],
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
      let parsed = JSON.parse(raw);
      if (parsed?.encrypted === true || parsed?.exportType === 'nova_encrypted_backup') {
        Alert.alert('Encrypted backup not supported', 'Backup encryption was removed in V1.1.1. Import a plain JSON NOVA backup.');
        return;
      }
      const { valid, reason } = validateImportJson(parsed);
      if (!valid) {
        Alert.alert('Invalid file', reason || 'Not a valid N.O.V.A. backup.');
        return;
      }
      const scope = parsed.scope || 'all';
      const isFullRestore = scope === 'all';
      Alert.alert(
        isFullRestore ? 'Overwrite all data?' : `Import ${scope} data?`,
        isFullRestore
          ? 'This will replace all current N.O.V.A. data with the imported backup. This cannot be undone.'
          : 'This will merge the scoped backup into the matching N.O.V.A. data. Existing matching records with the same IDs will be updated.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              const uriMap = await restoreReceiptFilesFromBackup(parsed.receiptFiles || []);
              const importData = sanitizeBackupData(remapReceiptUrisInData(parsed.data, uriMap));
              if (isFullRestore) {
                const allKeys = await AsyncStorage.getAllKeys();
                const novaKeys = allKeys.filter(k => k.startsWith(NOVA_PREFIX));
                if (novaKeys.length > 0) await AsyncStorage.multiRemove(novaKeys);
                await AsyncStorage.multiSet(storageEntries(importData));
              } else {
                const currentData = await readNovaStorage();
                const mergedData = mergeIncomingData(currentData, importData, scope);
                await AsyncStorage.multiSet(storageEntries(mergedData));
              }
              await useStore.getState().initStore();
              useStore.getState().rotateFlavorTextForEvent?.('import_complete');
            },
          },
        ],
      );
    } catch (e) {
      console.warn('importAllData error:', e);
      Alert.alert('Import failed', e.message);
    }
  }

  async function exportAccountCsv(accountKey) {
    try {
      const { accounts, transactions } = useStore.getState();
      const csv = buildAccountCsv(accountKey, transactions || [], accounts?.[accountKey]);
      const fileName = `nova_${accountKey}_${todayStr()}.csv`;
      await writeCsvFile(fileName, csv);
      await writeManifestFile(accountKey || 'account', [fileName], 'account_csv');
    } catch (e) {
      console.warn('exportAccountCsv error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function exportAccountPdf(accountKey) {
    try {
      const state = useStore.getState();
      const html = buildAccountPdfHtml({
        accountKey,
        accountName: accountNameForKey(state, accountKey),
        transactions: state.transactions || [],
        currentBalanceCents: state.accounts?.[accountKey],
      });
      const fileName = `nova_${accountKey}_${todayStr()}.pdf`;
      await writePdfFile(fileName, html);
      await writeManifestFile(accountKey || 'account', [fileName], 'account_pdf');
    } catch (e) {
      console.warn('exportAccountPdf error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function writeBusinessCsvFiles(options = {}) {
    const {
      businesses,
      genericBusinessIncome,
      genericBusinessExpenses,
      genericBusinessMileage,
      accountRegistry,
      transactions,
    } = useStore.getState();
    const files = [
      { name: 'business_summary', csv: buildBusinessSummaryCsv({ businesses, income: genericBusinessIncome, expenses: genericBusinessExpenses, mileage: genericBusinessMileage }) },
      { name: 'business_income', csv: buildBusinessIncomeCsv({ businesses, income: genericBusinessIncome, accountRegistry }) },
      { name: 'business_expenses', csv: buildBusinessExpenseCsv({ businesses, expenses: genericBusinessExpenses, accountRegistry }) },
      { name: 'business_mileage', csv: buildBusinessMileageCsv({ businesses, mileage: genericBusinessMileage }) },
      { name: 'business_transactions', csv: buildBusinessTransactionsCsv({ businesses, transactions, accountRegistry }) },
    ];
    const fileNames = [];
    for (const { name, csv } of files) {
      const fileName = `nova_${name}_${todayStr()}.csv`;
      await writeCsvFile(fileName, csv, options);
      fileNames.push(fileName);
    }
    return fileNames;
  }

  async function exportBusinessCsvs() {
    try {
      const fileNames = await writeBusinessCsvFiles();
      await writeManifestFile('business', fileNames, 'business_csv');
      useStore.getState().rotateFlavorTextForEvent?.('export_complete');
    } catch (e) {
      console.warn('exportBusinessCsvs error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function exportBundle(options = {}) {
    try {
      const state = useStore.getState();
      const selectedAccountKeys = (options.accountKeys || []).filter(Boolean);
      const fileNames = [];
      const destinationLabel = options.destinationLabel;

      if (options.fullSystemBackup) {
        const data = await readNovaStorage();
        const file = await writeJsonBackupFile('all', data, {
          destinationLabel,
        });
        fileNames.push(file.fileName);
        await saveExportConfig({ lastExportTimestamp: Date.now(), lastAutoExportDate: todayStr() });
      }

      if (options.householdBackup) {
        const file = await writeJsonBackupFile('household', householdBackupData(state), {
          destinationLabel,
        });
        fileNames.push(file.fileName);
      }

      if (options.businessBackup) {
        const file = await writeJsonBackupFile('business', businessBackupData(state), {
          destinationLabel,
        });
        fileNames.push(file.fileName);
      }

      if (options.accountBackup && selectedAccountKeys.length > 0) {
        const file = await writeJsonBackupFile('accounts', selectedAccountsBackupData(state, selectedAccountKeys), {
          destinationLabel,
        });
        fileNames.push(file.fileName);
      }

      if (options.accountCsv) {
        for (const accountKey of selectedAccountKeys) {
          const csv = buildAccountCsv(accountKey, state.transactions || [], state.accounts?.[accountKey]);
          const fileName = `nova_${accountKey}_${todayStr()}.csv`;
          await writeCsvFile(fileName, csv);
          fileNames.push(fileName);
        }
      }

      if (options.accountPdf) {
        for (const accountKey of selectedAccountKeys) {
          const html = buildAccountPdfHtml({
            accountKey,
            accountName: accountNameForKey(state, accountKey),
            transactions: state.transactions || [],
            currentBalanceCents: state.accounts?.[accountKey],
          });
          const fileName = `nova_${accountKey}_${todayStr()}.pdf`;
          await writePdfFile(fileName, html);
          fileNames.push(fileName);
        }
      }

      if (options.businessCsvs) {
        const businessFiles = await writeBusinessCsvFiles();
        fileNames.push(...businessFiles);
      }

      if (fileNames.length === 0) {
        Alert.alert('Nothing selected', 'Choose at least one export option.');
        return;
      }

      await writeManifestFile('bundle', fileNames, 'selected_export', { destinationLabel });
      useStore.getState().rotateFlavorTextForEvent?.('export_complete');
    } catch (e) {
      console.warn('exportBundle error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function checkAndRunAutoExport() {
    try {
      const cfg = await readExportConfig();
      const schedule = cfg.schedule || 'off';
      if (schedule === 'off') return;
      const last = cfg.lastExportTimestamp || 0;
      const elapsed = Date.now() - last;
      const day = 24 * 60 * 60 * 1000;
      const minute = 60 * 1000;
      const today = todayStr();
      const preciseDates = Array.isArray(cfg.preciseDates)
        ? cfg.preciseDates
        : String(cfg.preciseDates || '').split(',').map(item => item.trim()).filter(Boolean);
      const alreadyRanToday = cfg.lastAutoExportDate === today;
      const shouldRun =
        (schedule === 'realtime' && elapsed >= minute) ||
        (schedule === 'daily' && !alreadyRanToday && elapsed >= day) ||
        (schedule === 'weekly' && elapsed >= 7 * day) ||
        (schedule === 'precise' && preciseDates.includes(today) && !alreadyRanToday) ||
        (schedule === 'significant' && elapsed >= day);
      if (shouldRun) {
        await exportAllData({
          destinationLabel: cfg.destinationLabel,
          share: false,
          auto: true,
          backupDirectoryUri: cfg.backupDirectoryUri,
        });
        useStore.getState().rotateFlavorTextForEvent?.('auto_export');
      }
    } catch (e) {
      console.warn('checkAndRunAutoExport error:', e);
    }
  }

  return {
    exportAllData,
    exportBusinessData,
    exportHouseholdData,
    importAllData,
    exportAccountCsv,
    exportAccountPdf,
    exportBusinessCsvs,
    exportBundle,
    checkAndRunAutoExport,
    readExportConfig,
    saveExportConfig,
  };
}
