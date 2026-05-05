import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort, parseBillInput } from '../utils/currency';
import { getActiveSpendingCategoryNames } from './SpendingCategoryManagerCard';
import { CATEGORY_UNCATEGORIZED } from '../utils/spendingCategories';
import {
  RECURRING_FREQUENCIES,
  localDateKey,
  parseLocalDate,
} from '../utils/recurringTransactions';

const DEFAULT_INCOME_CATEGORIES = ['Income', 'Other'];
const REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 7];
const REMINDER_HOUR_OPTIONS = [
  { value: 8, label: '8 AM' },
  { value: 12, label: 'NOON' },
  { value: 18, label: '6 PM' },
];

function unique(items = []) {
  const seen = new Set();
  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function daysUntilLabel(dateValue) {
  const due = parseLocalDate(dateValue);
  const today = parseLocalDate(localDateKey(Date.now()));
  const days = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `${Math.abs(days)}D OVERDUE`;
  if (days === 0) return 'DUE TODAY';
  if (days === 1) return 'DUE TOMORROW';
  return `DUE IN ${days}D`;
}

function dateLabel(dateValue) {
  return parseLocalDate(dateValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function accountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

function getDefaultTitle(scope) {
  if (scope === 'business') return 'Recurring business item';
  if (scope === 'household') return 'Recurring household item';
  return 'Recurring item';
}

function RecurringTemplateModal({
  visible,
  item = null,
  scope,
  accountOptions,
  expenseCategories,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState({});
  const editing = !!item;

  React.useEffect(() => {
    if (!visible) return;
    const defaultAccountKey = item?.accountKey || accountOptions[0]?.key || '';
    const direction = item?.direction || 'expense';
    const category = item?.category || (direction === 'income' ? DEFAULT_INCOME_CATEGORIES[0] : expenseCategories[0] || CATEGORY_UNCATEGORIZED);
    setForm({
      title: item?.title || '',
      amount: item?.amountCents > 0 ? (item.amountCents / 100).toFixed(2) : '',
      direction,
      category,
      accountKey: defaultAccountKey,
      frequency: item?.frequency || 'monthly',
      nextDueDate: item?.nextDueDate || localDateKey(Date.now()),
      reminderEnabled: item?.reminderEnabled !== false,
      reminderDaysBefore: item?.reminderDaysBefore ?? 1,
      reminderHour: item?.reminderHour ?? 9,
      notes: item?.notes || '',
    });
  }, [visible, item?.id, accountOptions, expenseCategories]);

  const categories = form.direction === 'income'
    ? DEFAULT_INCOME_CATEGORIES
    : unique([...(expenseCategories || []), CATEGORY_UNCATEGORIZED]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const amountCents = parseBillInput(form.amount || '');
  const canSave = String(form.title || '').trim() && amountCents > 0 && form.accountKey && form.nextDueDate;

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Missing details', 'Enter a name, amount, account, and next date.');
      return;
    }
    await onSave({
      ...(item || {}),
      title: String(form.title || '').trim(),
      amountCents,
      direction: form.direction || 'expense',
      category: form.category || categories[0] || CATEGORY_UNCATEGORIZED,
      accountKey: form.accountKey,
      frequency: form.frequency || 'monthly',
      nextDueDate: localDateKey(parseLocalDate(form.nextDueDate)),
      startDate: item?.startDate || localDateKey(parseLocalDate(form.nextDueDate)),
      reminderEnabled: form.reminderEnabled !== false,
      reminderDaysBefore: form.reminderDaysBefore ?? 1,
      reminderHour: form.reminderHour ?? 9,
      notes: String(form.notes || '').trim(),
      scope,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editing ? 'EDIT RECURRING ITEM' : 'ADD RECURRING ITEM'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              style={styles.input}
              value={form.title || ''}
              onChangeText={value => setField('title', value)}
              placeholder={getDefaultTitle(scope)}
              placeholderTextColor={theme.textDim}
            />

            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.chipRow}>
              {['expense', 'income'].map(direction => (
                <TouchableOpacity
                  key={direction}
                  style={[styles.chip, form.direction === direction && styles.chipOn]}
                  onPress={() => setForm(prev => ({
                    ...prev,
                    direction,
                    category: direction === 'income' ? DEFAULT_INCOME_CATEGORIES[0] : expenseCategories[0] || CATEGORY_UNCATEGORIZED,
                  }))}
                >
                  <Text style={[styles.chipText, form.direction === direction && styles.chipTextOn]}>{direction.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <TextInput
              style={styles.input}
              value={form.amount || ''}
              onChangeText={value => setField('amount', value)}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>ACCOUNT</Text>
            <View style={styles.chipRow}>
              {accountOptions.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, form.accountKey === option.key && styles.chipOn]}
                  onPress={() => setField('accountKey', option.key)}
                >
                  <Text style={[styles.chipText, form.accountKey === option.key && styles.chipTextOn]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.chipRow}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.chip, form.category === category && styles.chipOn]}
                  onPress={() => setField('category', category)}
                >
                  <Text style={[styles.chipText, form.category === category && styles.chipTextOn]}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={form.category || ''}
              onChangeText={value => setField('category', value)}
              placeholder="Category"
              placeholderTextColor={theme.textDim}
            />

            <Text style={styles.fieldLabel}>REPEATS</Text>
            <View style={styles.chipRow}>
              {RECURRING_FREQUENCIES.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, form.frequency === option.value && styles.chipOn]}
                  onPress={() => setField('frequency', option.value)}
                >
                  <Text style={[styles.chipText, form.frequency === option.value && styles.chipTextOn]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>NEXT DATE</Text>
            <TextInput
              style={styles.input}
              value={form.nextDueDate || ''}
              onChangeText={value => setField('nextDueDate', value)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textDim}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchTextBlock}>
                <Text style={styles.fieldLabel}>REMINDER</Text>
                <Text style={styles.reminderPreview}>
                  {form.reminderEnabled === false ? 'OFF' : `${form.reminderDaysBefore || 0}D BEFORE AT ${REMINDER_HOUR_OPTIONS.find(h => h.value === form.reminderHour)?.label || `${form.reminderHour || 9}:00`}`}
                </Text>
              </View>
              <Switch
                value={form.reminderEnabled !== false}
                onValueChange={value => setField('reminderEnabled', value)}
                trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                thumbColor={form.reminderEnabled !== false ? theme.accent : theme.textDim}
              />
            </View>

            {form.reminderEnabled !== false && (
              <>
                <Text style={styles.fieldLabel}>REMIND</Text>
                <View style={styles.chipRow}>
                  {REMINDER_DAY_OPTIONS.map(days => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.chip, Number(form.reminderDaysBefore) === days && styles.chipOn]}
                      onPress={() => setField('reminderDaysBefore', days)}
                    >
                      <Text style={[styles.chipText, Number(form.reminderDaysBefore) === days && styles.chipTextOn]}>
                        {days === 0 ? 'DAY OF' : `${days}D BEFORE`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>TIME</Text>
                <View style={styles.chipRow}>
                  {REMINDER_HOUR_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.chip, Number(form.reminderHour) === option.value && styles.chipOn]}
                      onPress={() => setField('reminderHour', option.value)}
                    >
                      <Text style={[styles.chipText, Number(form.reminderHour) === option.value && styles.chipTextOn]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.notes || ''}
              onChangeText={value => setField('notes', value)}
              placeholder="Optional"
              placeholderTextColor={theme.textDim}
              multiline
            />
          </ScrollView>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, !canSave && styles.disabled]} onPress={handleSave} disabled={!canSave}>
              <Text style={styles.saveText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RecurringTransactionsCard({ scope = 'personal', accountOptions = [], title = 'RECURRING ITEMS' }) {
  const recurringTransactions = useStore((s) => s.recurringTransactions || []);
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const addRecurringTransaction = useStore((s) => s.addRecurringTransaction);
  const editRecurringTransaction = useStore((s) => s.editRecurringTransaction);
  const deleteRecurringTransaction = useStore((s) => s.deleteRecurringTransaction);
  const completeRecurringTransaction = useStore((s) => s.completeRecurringTransaction);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const resolvedAccountOptions = useMemo(() => {
    if ((accountOptions || []).length > 0) return accountOptions;
    return (accountRegistry || [])
      .filter(account => account && account.isActive !== false && (!scope || scope === 'dashboard' || account.role === scope))
      .map(account => ({ key: accountKey(account), label: String(account.name || account.id).toUpperCase() }))
      .filter(option => option.key);
  }, [accountOptions, accountRegistry, scope]);

  const expenseCategories = useMemo(() => {
    const active = getActiveSpendingCategoryNames(spendingBuckets, scope === 'dashboard' ? null : scope);
    return unique(active.length > 0 ? active : [CATEGORY_UNCATEGORIZED]);
  }, [spendingBuckets, scope]);

  const rows = useMemo(() => (recurringTransactions || [])
    .filter(item => item && !item.deleted && item.isActive !== false && (scope === 'dashboard' || item.scope === scope))
    .sort((a, b) => parseLocalDate(a.nextDueDate).getTime() - parseLocalDate(b.nextDueDate).getTime())
    .slice(0, 12), [recurringTransactions, scope]);

  const accountLabel = (key) => resolvedAccountOptions.find(option => option.key === key)?.label || key || 'UNASSIGNED';

  const openAdd = () => {
    setEditingItem(null);
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalVisible(true);
  };

  const handleSave = async (payload) => {
    if (editingItem) await editRecurringTransaction(editingItem.id, payload);
    else await addRecurringTransaction(payload);
  };

  const confirmDelete = (item) => {
    Alert.alert('Delete recurring item?', item.title || 'Recurring item', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecurringTransaction(item.id) },
    ]);
  };

  const completeItem = async (item, logTransaction = true) => {
    await completeRecurringTransaction(item.id, { logTransaction });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardMeta}>{rows.length} ACTIVE</Text>
        </View>
        <TouchableOpacity style={styles.addSmallBtn} onPress={openAdd}>
          <Text style={styles.addSmallText}>+ ADD</Text>
        </TouchableOpacity>
      </View>

      {rows.length === 0 && (
        <Text style={styles.emptyText}>No recurring items yet.</Text>
      )}

      {rows.map(item => {
        const isIncome = item.direction === 'income';
        return (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.itemAmount, { color: isIncome ? theme.statusPositive : theme.statusDanger }]}>
                  {isIncome ? '+' : '-'}{formatCentsShort(item.amountCents || 0)}
                </Text>
              </View>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {dateLabel(item.nextDueDate)} - {daysUntilLabel(item.nextDueDate)} - {String(item.frequency || 'monthly').toUpperCase()}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {accountLabel(item.accountKey)} - {item.category || CATEGORY_UNCATEGORIZED}
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.logBtn} onPress={() => completeItem(item, true)}>
                  <Text style={styles.logText}>LOG</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dimBtn} onPress={() => completeItem(item, false)}>
                  <Text style={styles.dimText}>SKIP</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dimBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.dimText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
                  <Text style={styles.deleteText}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      <RecurringTemplateModal
        visible={modalVisible}
        item={editingItem}
        scope={scope}
        accountOptions={resolvedAccountOptions}
        expenseCategories={expenseCategories}
        onSave={handleSave}
        onClose={() => {
          setModalVisible(false);
          setEditingItem(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  headerTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  addSmallBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    backgroundColor: theme.accentGlow,
  },
  addSmallText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
  },
  emptyText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingTop: theme.spacingSM,
    marginTop: theme.spacingSM,
  },
  itemMain: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
  },
  itemTitle: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  itemAmount: {
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  itemMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginTop: theme.spacingSM,
  },
  logBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    backgroundColor: theme.accentGlow,
  },
  logText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  dimBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  dimText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  deleteText: {
    color: theme.statusDanger,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.overlayBg,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: theme.backgroundSecondary,
    borderTopLeftRadius: theme.borderRadiusLG,
    borderTopRightRadius: theme.borderRadiusLG,
    borderWidth: 1,
    borderColor: theme.borderColor,
    padding: theme.spacingLG,
  },
  sheetTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: theme.spacingSM,
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    letterSpacing: 1,
    marginTop: theme.spacingXS,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    backgroundColor: theme.backgroundPanel,
    marginBottom: theme.spacingXS,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  chipOn: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  chipTextOn: {
    color: theme.accent,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    marginVertical: theme.spacingXS,
    backgroundColor: theme.backgroundPanel,
  },
  switchTextBlock: {
    flex: 1,
  },
  reminderPreview: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: theme.spacingMD,
    marginTop: theme.spacingSM,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: theme.spacingMD,
    alignItems: 'center',
  },
  cancelText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  saveBtn: {
    flex: 2,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: theme.spacingMD,
    alignItems: 'center',
    backgroundColor: theme.accentGlow,
  },
  saveText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
});
