import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import {
  AUTO_ACTIVE_SPENDING_CATEGORIES,
  CATEGORY_UNCATEGORIZED,
  SPENDING_CATEGORY_SUGGESTIONS,
  canonicalCategoryLabel,
  categoryKey,
  dedupeCategoryLabels,
} from '../utils/spendingCategories';
import { getActiveSpendingCategoryNames } from './SpendingCategoryManagerCard';
import {
  applyCategoryRules,
  flagDuplicateRows,
  normalizeImportDescription,
  parseStatementText,
} from '../utils/statementImport';

const INCOME_CATEGORY = 'Income';
const MAX_PREVIEW_ROWS = 18;

function getAccountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

function compactFileName(name = '') {
  if (!name || name.length <= 34) return name || 'statement file';
  return `${name.slice(0, 18)}...${name.slice(-12)}`;
}

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function rowGroupKey(row) {
  return row.normalizedDescription || normalizeImportDescription(row.rawDescription || row.description);
}

function defaultCategoryForRow(row) {
  if (row.suggestedByRule || row.importedCategory) {
    return canonicalCategoryLabel(row.category || row.importedCategory || CATEGORY_UNCATEGORIZED);
  }
  if ((row.amountCents || 0) > 0) return INCOME_CATEGORY;
  return canonicalCategoryLabel(row.category || CATEGORY_UNCATEGORIZED);
}

function seedCategoryMap(rows = [], previous = {}) {
  const next = { ...previous };
  rows.forEach(row => {
    const key = rowGroupKey(row);
    if (!key) return;
    if (!next[key]) next[key] = defaultCategoryForRow(row);
  });
  return next;
}

export default function StatementImportPanel() {
  const accounts = useStore((s) => s.accounts);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const transactions = useStore((s) => s.transactions);
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const importCategoryRules = useStore((s) => s.importCategoryRules);
  const importStatementTransactions = useStore((s) => s.importStatementTransactions);

  const [selectedAccountKey, setSelectedAccountKey] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [groupCategories, setGroupCategories] = useState({});
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [invertSigns, setInvertSigns] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeAccounts = useMemo(() => {
    const fromRegistry = (accountRegistry || [])
      .filter(account => account && account.isActive !== false)
      .map(account => ({
        key: getAccountKey(account),
        name: account.name || account.id || account.legacyKey,
        role: account.role || null,
      }))
      .filter(account => account.key);
    const known = new Set(fromRegistry.map(account => account.key));
    const fallback = Object.keys(accounts || {})
      .filter(key => !known.has(key))
      .map(key => ({ key, name: key, role: null }));
    return [...fromRegistry, ...fallback];
  }, [accountRegistry, accounts]);

  useEffect(() => {
    if (!selectedAccountKey && activeAccounts.length > 0) {
      setSelectedAccountKey(activeAccounts[0].key);
    }
  }, [activeAccounts, selectedAccountKey]);

  const selectedAccount = activeAccounts.find(account => account.key === selectedAccountKey);
  const selectedRole = selectedAccount?.role || null;

  const prepareRows = useCallback((baseRows, format) => {
    if (!selectedAccountKey) return [];
    const signedRows = (baseRows || []).map(row => ({
      ...row,
      amountCents: invertSigns ? -Math.trunc(row.amountCents || 0) : Math.trunc(row.amountCents || 0),
    }));
    const categorized = applyCategoryRules(signedRows, importCategoryRules, CATEGORY_UNCATEGORIZED)
      .map(row => ({ ...row, category: defaultCategoryForRow(row) }));
    return flagDuplicateRows(categorized, transactions || [], selectedAccountKey, format);
  }, [importCategoryRules, invertSigns, selectedAccountKey, transactions]);

  useEffect(() => {
    if (!parsedRows.length || !selectedAccountKey) {
      setRows([]);
      return;
    }
    const prepared = prepareRows(parsedRows, fileMeta?.format);
    setRows(prepared);
    setGroupCategories(prev => seedCategoryMap(prepared, prev));
  }, [fileMeta?.format, parsedRows, prepareRows, selectedAccountKey]);

  const groupedDescriptions = useMemo(() => {
    const map = new Map();
    rows.forEach(row => {
      const key = rowGroupKey(row);
      if (!key) return;
      const current = map.get(key) || {
        key,
        label: row.description || row.rawDescription || 'Imported transaction',
        count: 0,
        duplicateCount: 0,
        exampleAmount: row.amountCents,
        suggestedByRule: row.suggestedByRule,
      };
      current.count += 1;
      if (row.duplicate) current.duplicateCount += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rows]);

  const categoryOptions = useMemo(() => {
    const active = getActiveSpendingCategoryNames(spendingBuckets || [], selectedRole);
    const imported = rows.map(row => row.importedCategory || row.category).filter(Boolean);
    return dedupeCategoryLabels([
      ...active,
      ...AUTO_ACTIVE_SPENDING_CATEGORIES,
      ...SPENDING_CATEGORY_SUGGESTIONS,
      INCOME_CATEGORY,
      CATEGORY_UNCATEGORIZED,
      ...imported,
    ]);
  }, [rows, selectedRole, spendingBuckets]);

  const duplicateCount = rows.filter(row => row.duplicate).length;
  const rowsForImport = rows
    .filter(row => includeDuplicates || !row.duplicate)
    .map(row => ({
      ...row,
      duplicate: false,
      category: canonicalCategoryLabel(groupCategories[rowGroupKey(row)] || row.category || CATEGORY_UNCATEGORIZED),
    }));
  const totalCents = rowsForImport.reduce((sum, row) => sum + (row.amountCents || 0), 0);

  async function handlePickFile() {
    if (!selectedAccountKey) {
      Alert.alert('Choose an account', 'Create or select an account before importing a bank statement.');
      return;
    }
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      const parsed = parseStatementText(raw, asset.name || '');
      if (!parsed.rows?.length) {
        Alert.alert('No transactions found', (parsed.warnings || []).slice(0, 3).join('\n') || 'NOVA could not read dated transactions with amounts from this file.');
        return;
      }
      const prepared = prepareRows(parsed.rows, parsed.format);
      setFileMeta({
        fileName: asset.name || 'statement',
        format: parsed.format || 'csv',
        warnings: parsed.warnings || [],
        delimiter: parsed.delimiter,
        inferredHeader: parsed.inferredHeader,
      });
      setParsedRows(parsed.rows || []);
      setRows(prepared);
      setGroupCategories(seedCategoryMap(prepared, {}));
      setIncludeDuplicates(false);
    } catch (error) {
      console.warn('statement import parse error:', error);
      Alert.alert('Import failed', error?.message || 'NOVA could not read this statement file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!selectedAccountKey || rowsForImport.length === 0) return;
    try {
      setBusy(true);
      const result = await importStatementTransactions({
        accountKey: selectedAccountKey,
        rows: rowsForImport,
        fileName: fileMeta?.fileName || '',
        format: fileMeta?.format || 'statement',
        learnRules: true,
      });
      Alert.alert(
        'Statement imported',
        `${result.imported || 0} transactions added. ${duplicateCount && !includeDuplicates ? `${duplicateCount} duplicates skipped.` : 'Category rules updated.'}`,
      );
      setFileMeta(null);
      setParsedRows([]);
      setRows([]);
      setGroupCategories({});
      setIncludeDuplicates(false);
      setInvertSigns(false);
    } catch (error) {
      console.warn('statement import commit error:', error);
      Alert.alert('Import failed', error?.message || 'NOVA could not save these transactions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>BANK STATEMENT IMPORT</Text>
      <Text style={styles.copy}>CSV, OFX, QFX and QIF are read locally, reviewed here, then added to the account you choose.</Text>

      <Text style={styles.label}>Import account</Text>
      <View style={styles.chipGrid}>
        {activeAccounts.map(account => (
          <TouchableOpacity
            key={account.key}
            style={[styles.chip, selectedAccountKey === account.key && styles.chipActive]}
            onPress={() => setSelectedAccountKey(account.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, selectedAccountKey === account.key && styles.chipTextActive]}>
              {(account.name || account.key).toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={handlePickFile} disabled={busy || !activeAccounts.length}>
        <Text style={styles.primaryBtnText}>{fileMeta ? 'CHOOSE DIFFERENT FILE' : 'CHOOSE CSV / OFX / QIF'}</Text>
      </TouchableOpacity>

      {fileMeta ? (
        <View style={styles.review}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>FILE</Text>
              <Text style={styles.summaryValue}>{compactFileName(fileMeta.fileName)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ROWS</Text>
              <Text style={styles.summaryValue}>{rows.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>DUPES</Text>
              <Text style={[styles.summaryValue, duplicateCount > 0 && styles.warningText]}>{duplicateCount}</Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Invert signs</Text>
              <Text style={styles.toggleSubtitle}>Use when a bank exports charges as positive values.</Text>
            </View>
            <Switch
              value={invertSigns}
              onValueChange={setInvertSigns}
              trackColor={{ false: theme.borderColorDim, true: theme.accent }}
              thumbColor={theme.background}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Import flagged duplicates</Text>
              <Text style={styles.toggleSubtitle}>Off by default. Same IDs and close date/amount matches are skipped.</Text>
            </View>
            <Switch
              value={includeDuplicates}
              onValueChange={setIncludeDuplicates}
              trackColor={{ false: theme.borderColorDim, true: theme.accent }}
              thumbColor={theme.background}
            />
          </View>

          <Text style={styles.subhead}>DESCRIPTION RULES</Text>
          {groupedDescriptions.map(group => (
            <View key={group.key} style={styles.groupBlock}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle} numberOfLines={2}>{group.label}</Text>
                <Text style={styles.groupMeta}>
                  {group.count} x {formatCentsShort(group.exampleAmount)}
                  {group.duplicateCount ? ` / ${group.duplicateCount} dupes` : ''}
                </Text>
              </View>
              <View style={styles.categoryGrid}>
                {categoryOptions.map(category => {
                  const active = categoryKey(groupCategories[group.key]) === categoryKey(category);
                  return (
                    <TouchableOpacity
                      key={`${group.key}_${category}`}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => setGroupCategories(prev => ({ ...prev, [group.key]: category }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <Text style={styles.subhead}>PREVIEW</Text>
          {rows.slice(0, MAX_PREVIEW_ROWS).map(row => (
            <View key={row.id} style={[styles.rowPreview, row.duplicate && styles.rowDuplicate]}>
              <View style={styles.rowMain}>
                <Text style={styles.rowDescription} numberOfLines={1}>{row.description}</Text>
                <Text style={styles.rowMeta}>
                  {formatDate(row.timestamp)} / {groupCategories[rowGroupKey(row)] || row.category || CATEGORY_UNCATEGORIZED}
                  {row.duplicate ? ` / ${row.duplicateReason}` : ''}
                </Text>
              </View>
              <Text style={[styles.rowAmount, row.amountCents >= 0 && styles.rowAmountPositive]}>
                {formatCentsShort(row.amountCents)}
              </Text>
            </View>
          ))}
          {rows.length > MAX_PREVIEW_ROWS ? (
            <Text style={styles.moreRows}>+{rows.length - MAX_PREVIEW_ROWS} more rows</Text>
          ) : null}

          {fileMeta.warnings?.length ? (
            <Text style={styles.warningText}>{fileMeta.warnings.slice(0, 3).join(' ')}</Text>
          ) : null}

          <View style={styles.importSummary}>
            <Text style={styles.importSummaryText}>{rowsForImport.length} ready / {formatCentsShort(totalCents)} net</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, rowsForImport.length === 0 && styles.disabled]}
            onPress={handleImport}
            disabled={busy || rowsForImport.length === 0}
          >
            <Text style={styles.primaryBtnText}>IMPORT REVIEWED TRANSACTIONS</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginTop: theme.spacingMD,
  },
  header: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  copy: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  label: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginBottom: theme.spacingXS,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 5,
    backgroundColor: theme.backgroundCard,
  },
  chipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  chipTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginTop: theme.spacingSM,
  },
  primaryBtnText: {
    color: theme.background,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.45,
  },
  review: {
    marginTop: theme.spacingMD,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingTop: theme.spacingMD,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  summaryItem: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    backgroundColor: theme.backgroundCard,
  },
  summaryLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  summaryValue: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    marginTop: theme.spacingXS,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    paddingVertical: theme.spacingSM,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  toggleSubtitle: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 2,
  },
  subhead: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    letterSpacing: 1,
    marginTop: theme.spacingMD,
    marginBottom: theme.spacingSM,
  },
  groupBlock: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    marginBottom: theme.spacingSM,
    backgroundColor: theme.backgroundCard,
  },
  groupHeader: {
    marginBottom: theme.spacingSM,
  },
  groupTitle: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  groupMeta: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 5,
    backgroundColor: theme.backgroundPanel,
  },
  categoryChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  categoryText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  categoryTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  rowPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    paddingVertical: theme.spacingSM,
  },
  rowDuplicate: {
    opacity: 0.62,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowDescription: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  rowMeta: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 2,
  },
  rowAmount: {
    color: theme.statusDanger,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  rowAmountPositive: {
    color: theme.statusPositive,
  },
  moreRows: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    textAlign: 'center',
    marginTop: theme.spacingSM,
  },
  warningText: {
    color: theme.statusWarning,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: theme.spacingSM,
  },
  importSummary: {
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    marginTop: theme.spacingMD,
    paddingTop: theme.spacingSM,
  },
  importSummaryText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
