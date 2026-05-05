import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import useTransactionSearch from '../hooks/useTransactionSearch';
import { formatCentsShort } from '../utils/currency';
import { getCurrentCycleId, getCycleBounds } from '../utils/forecasting';
import { EditTransactionModal } from '../components/TransactionModal';
import { TransactionReceiptModal } from '../components/ReceiptAttachmentsCard';
import { receiptCount } from '../utils/receiptFiles';

const copy = personality.transactionSearch;
const RANGE_OPTIONS = [
  { key: 'cycle', labelKey: 'thisCycle' },
  { key: '30', labelKey: 'last30Days' },
  { key: '90', labelKey: 'last90Days' },
  { key: 'all', labelKey: 'allTime' },
];

function isoFromMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRangeDates(rangeKey) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (rangeKey === 'all') return { dateFrom: null, dateTo: null };
  if (rangeKey === '90' || rangeKey === '30') {
    const start = new Date(end);
    start.setDate(start.getDate() - (rangeKey === '90' ? 90 : 30));
    start.setHours(0, 0, 0, 0);
    return { dateFrom: isoFromMs(start.getTime()), dateTo: isoFromMs(end.getTime()) };
  }
  const { startMs, endMs } = getCycleBounds(getCurrentCycleId(Date.now()));
  return { dateFrom: isoFromMs(startMs), dateTo: isoFromMs(endMs) };
}

function getTxAmount(tx) {
  return tx?.amountCents ?? tx?.amount ?? 0;
}

function getTxTimestamp(tx) {
  return tx?.timestamp ?? tx?.date ?? 0;
}

function formatShortDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function uniqueCategories(transactions) {
  const seen = new Set();
  return (transactions || [])
    .filter(tx => tx && !tx.deleted)
    .map(tx => String(tx.category || '').trim())
    .filter(Boolean)
    .filter(category => {
      const key = category.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

export default function TransactionSearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const editTransaction = useStore((s) => s.editTransaction);
  const rotateFlavorTextForEvent = useStore((s) => s.rotateFlavorTextForEvent);
  const initialFilters = route?.params?.initialFilters || {};
  const [rangeKey, setRangeKey] = useState('cycle');
  const [editingTx, setEditingTx] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);
  const [filters, setFilters] = useState(() => ({
    query: '',
    accountKey: null,
    category: null,
    dateFrom: null,
    dateTo: null,
    minAmount: null,
    maxAmount: null,
    type: null,
    ...initialFilters,
    ...getRangeDates('cycle'),
  }));

  useEffect(() => {
    rotateFlavorTextForEvent?.('transaction_search');
  }, [rotateFlavorTextForEvent]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus?.(), 250);
    return () => clearTimeout(timer);
  }, []);

  const accountLabelByKey = useMemo(() => {
    const map = new Map();
    (accountRegistry || []).forEach(account => {
      const key = account.legacyKey || account.id;
      if (key) map.set(key, account.name || account.id);
      if (account.id) map.set(account.id, account.name || account.id);
    });
    return map;
  }, [accountRegistry]);
  const accountPills = useMemo(() => {
    const active = (accountRegistry || [])
      .filter(account => account.isActive !== false)
      .map(account => ({ label: account.name || account.id, accountKey: account.legacyKey || account.id }))
      .filter(pill => pill.accountKey);
    const source = active.length > 0
      ? active
      : Object.keys(accounts || {}).map(key => ({ label: key, accountKey: key }));
    return [{ label: copy.allAccounts, accountKey: null }, ...source];
  }, [accountRegistry, accounts]);

  const categories = useMemo(() => uniqueCategories(transactions), [transactions]);
  const results = useTransactionSearch(transactions, filters);
  const totalTransactions = useMemo(
    () => (transactions || []).filter(tx => tx && !tx.deleted).length,
    [transactions],
  );
  const resultCount = copy.resultCount
    .replace('{shown}', String(results.length))
    .replace('{total}', String(totalTransactions));

  const setQuery = (query) => setFilters(prev => ({ ...prev, query }));
  const setAccount = (accountKey) => {
    setFilters(prev => ({
      ...prev,
      accountKey,
      accountKeys: null,
      sources: null,
      matchScope: null,
    }));
  };
  const setCategory = (category) => setFilters(prev => ({ ...prev, category }));
  const setRange = (key) => {
    setRangeKey(key);
    setFilters(prev => ({ ...prev, ...getRangeDates(key) }));
  };
  const getAccountName = (key) => accountLabelByKey.get(key) || key || copy.unknownAccount;

  const renderTransaction = ({ item }) => {
    const amount = getTxAmount(item);
    const isPositive = amount > 0;
    const receipts = receiptCount(item);
    return (
      <TouchableOpacity
        style={styles.txRow}
        onPress={() => receipts > 0 ? setReceiptTx(item) : setEditingTx(item)}
        onLongPress={() => setEditingTx(item)}
        activeOpacity={0.75}
      >
        <Text style={styles.txDate}>{formatShortDate(getTxTimestamp(item))}</Text>
        <View style={styles.txMain}>
          <Text style={styles.txDescription} numberOfLines={1}>
            {item.description || copy.transaction}
          </Text>
          <View style={styles.txMetaRow}>
            <Text style={styles.categoryTag} numberOfLines={1}>{item.category || copy.uncategorized}</Text>
            <Text style={styles.accountTag} numberOfLines={1}>{getAccountName(item.accountKey)}</Text>
            {receipts > 0 && <Text style={styles.receiptTag}>{receipts} PHOTO{receipts === 1 ? '' : 'S'}</Text>}
          </View>
        </View>
        <Text style={[styles.txAmount, { color: isPositive ? theme.statusPositive : theme.statusDanger }]}>
          {isPositive ? '+' : ''}{formatCentsShort(amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{copy.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{copy.title}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={copy.searchPlaceholder}
          placeholderTextColor={theme.textDim}
          value={filters.query || ''}
          onChangeText={setQuery}
        />
        <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')}>
          <Text style={styles.clearText}>{copy.clear}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {accountPills.map(pill => {
          const active = filters.accountKey === pill.accountKey && !filters.accountKeys;
          const allActive = pill.accountKey === null && !filters.accountKey && !filters.accountKeys;
          return (
            <TouchableOpacity
              key={pill.accountKey || 'all'}
              style={[styles.pill, (active || allActive) && styles.pillActive]}
              onPress={() => setAccount(pill.accountKey)}
            >
              <Text style={[styles.pillText, (active || allActive) && styles.pillTextActive]}>{pill.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        <TouchableOpacity
          style={[styles.pill, !filters.category && styles.pillActive]}
          onPress={() => setCategory(null)}
        >
          <Text style={[styles.pillText, !filters.category && styles.pillTextActive]}>{copy.allCategories}</Text>
        </TouchableOpacity>
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[styles.pill, filters.category === category && styles.pillActive]}
            onPress={() => setCategory(category)}
          >
            <Text style={[styles.pillText, filters.category === category && styles.pillTextActive]}>{category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.segmentRow}>
        {RANGE_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[styles.segment, rangeKey === option.key && styles.segmentActive]}
            onPress={() => setRange(option.key)}
          >
            <Text style={[styles.segmentText, rangeKey === option.key && styles.segmentTextActive]}>{copy[option.labelKey]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.resultCount}>{resultCount}</Text>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={[styles.listContent, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
        ListEmptyComponent={<Text style={styles.emptyText}>{copy.searchEmpty}</Text>}
      />

      <EditTransactionModal
        visible={editingTx !== null}
        transaction={editingTx}
        onSubmit={async (updates) => { await editTransaction(editingTx.id, updates); setEditingTx(null); }}
        onClose={() => setEditingTx(null)}
      />
      <TransactionReceiptModal
        visible={receiptTx !== null}
        transaction={receiptTx}
        onClose={() => setReceiptTx(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: theme.spacingMD,
    paddingTop: theme.spacingMD,
    paddingBottom: theme.spacingSM,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  backText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingSM,
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingSM,
    backgroundColor: theme.surface,
  },
  clearText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  pillRow: {
    gap: theme.spacingXS,
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingSM,
  },
  pill: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    backgroundColor: theme.surface,
  },
  pillActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  pillText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  pillTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingSM,
    gap: theme.spacingXS,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.surface,
    paddingHorizontal: theme.spacingXS,
  },
  segmentActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  segmentText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
  },
  segmentTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  resultCount: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingXS,
  },
  listContent: {
    paddingHorizontal: theme.spacingMD,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    paddingVertical: theme.spacingSM,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  txDate: {
    width: 48,
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  txMain: {
    flex: 1,
  },
  txDescription: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: 2,
  },
  txMetaRow: {
    flexDirection: 'row',
    gap: theme.spacingXS,
  },
  categoryTag: {
    maxWidth: 110,
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  accountTag: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  receiptTag: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  txAmount: {
    width: 82,
    textAlign: 'right',
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    paddingTop: theme.spacingXL,
    textAlign: 'center',
  },
});
