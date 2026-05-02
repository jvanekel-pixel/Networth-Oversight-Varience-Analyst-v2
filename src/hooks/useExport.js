import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import useStore from '../store/useStore';
import {
  buildFullJsonExport,
  buildAccountCsv,
  buildMassageIncomeCsv,
  buildMassageExpenseCsv,
  buildCleaningIncomeCsv,
  buildCleaningExpenseCsv,
  buildCleaningMileageCsv,
  validateImportJson,
} from '../utils/exportUtils';

const EXPORT_CONFIG_KEY = 'nova_v2_export_config';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function shareFile(uri, mimeType = 'application/octet-stream') {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('Sharing unavailable', 'This device does not support file sharing.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Share N.O.V.A. export' });
}

export function useExport() {
  const store = useStore.getState;

  async function exportAllData() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const novaKeys = allKeys.filter(k => k.startsWith('nova_v2_'));
      const pairs = await AsyncStorage.multiGet(novaKeys);
      const data = {};
      for (const [k, v] of pairs) {
        try { data[k] = JSON.parse(v); } catch { data[k] = v; }
      }
      const json = buildFullJsonExport(data);
      const path = `${FileSystem.cacheDirectory}nova_backup_${todayStr()}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });
      await shareFile(path, 'application/json');

      // Update last export timestamp
      const raw = await AsyncStorage.getItem(EXPORT_CONFIG_KEY);
      const cfg = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(EXPORT_CONFIG_KEY, JSON.stringify({ ...cfg, lastExportTimestamp: Date.now() }));
    } catch (e) {
      console.warn('exportAllData error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function importAllData() {
    try {
      const { default: DocumentPicker } = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
      const parsed = JSON.parse(raw);
      const { valid, reason } = validateImportJson(parsed);
      if (!valid) {
        Alert.alert('Invalid file', reason || 'Not a valid N.O.V.A. backup.');
        return;
      }
      Alert.alert(
        'Overwrite all data?',
        'This will replace all current N.O.V.A. data with the imported backup. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              const entries = Object.entries(parsed.data).map(([k, v]) => [k, JSON.stringify(v)]);
              await AsyncStorage.multiSet(entries);
              await useStore.getState().initStore();
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
      const { transactions } = useStore.getState();
      const csv = buildAccountCsv(accountKey, transactions || []);
      const path = `${FileSystem.cacheDirectory}nova_${accountKey}_${todayStr()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      await shareFile(path, 'text/csv');
    } catch (e) {
      console.warn('exportAccountCsv error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function exportBusinessCsvs() {
    try {
      const { massageIncome, massageExpenses, cleaningIncome, cleaningExpenses, cleaningMileage } = useStore.getState();
      const files = [
        { name: 'massage_income', csv: buildMassageIncomeCsv(massageIncome || []) },
        { name: 'massage_expenses', csv: buildMassageExpenseCsv(massageExpenses || []) },
        { name: 'cleaning_income', csv: buildCleaningIncomeCsv(cleaningIncome || []) },
        { name: 'cleaning_expenses', csv: buildCleaningExpenseCsv(cleaningExpenses || []) },
        { name: 'cleaning_mileage', csv: buildCleaningMileageCsv(cleaningMileage || []) },
      ];
      for (const { name, csv } of files) {
        const path = `${FileSystem.cacheDirectory}nova_${name}_${todayStr()}.csv`;
        await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
        await shareFile(path, 'text/csv');
      }
    } catch (e) {
      console.warn('exportBusinessCsvs error:', e);
      Alert.alert('Export failed', e.message);
    }
  }

  async function checkAndRunAutoExport() {
    try {
      const raw = await AsyncStorage.getItem(EXPORT_CONFIG_KEY);
      const cfg = raw ? JSON.parse(raw) : {};
      const schedule = cfg.schedule || 'off';
      if (schedule === 'off') return;
      const last = cfg.lastExportTimestamp || 0;
      const elapsed = Date.now() - last;
      const day = 24 * 60 * 60 * 1000;
      if (schedule === 'daily' && elapsed > day) await exportAllData();
      if (schedule === 'weekly' && elapsed > 7 * day) await exportAllData();
    } catch (e) {
      console.warn('checkAndRunAutoExport error:', e);
    }
  }

  return { exportAllData, importAllData, exportAccountCsv, exportBusinessCsvs, checkAndRunAutoExport };
}
