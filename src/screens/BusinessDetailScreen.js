import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort, parseBillInput } from '../utils/currency';
import { useExport } from '../hooks/useExport';
import DatePickerField from '../components/DatePickerField';
import CardOrderSheet from '../components/settings/CardOrderSheet';
import CardOrderLink from '../components/settings/CardOrderLink';
import SpendingChartsSection from '../components/SpendingChartsSection';
import SpendingCategoryManagerCard, { getActiveSpendingCategoryNames } from '../components/SpendingCategoryManagerCard';
import ReceiptAttachmentsCard, { TransactionReceiptModal } from '../components/ReceiptAttachmentsCard';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import { makeSplitGroupId } from '../utils/splitTransactions';
import { SAVINGS_GOALS_CARD_ID, savingsGoalsForScope } from '../utils/savingsGoals';
import { receiptCount } from '../utils/receiptFiles';

const DEFAULT_INCOME_CATEGORY = 'business_income';
const DEFAULT_EXPENSE_CATEGORY = 'business_expense';
const DEFAULT_MILEAGE_CATEGORY = 'business_mileage';

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AddEntryModal({ visible, title, fields, initialValues = {}, submitLabel = 'ADD', onSubmit, onClose }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (visible) setValues(initialValues || {});
  }, [visible]);

  const splitField = fields.find(f => f.type === 'split');
  const splitTotalCents = splitField ? parseBillInput(values[splitField.amountKey || 'amount'] || '0') : 0;
  const splitOneCents = splitField ? parseBillInput(values.splitOneAmount || '0') : 0;
  const splitTwoCents = splitField ? parseBillInput(values.splitTwoAmount || '0') : 0;
  const splitRemainderCents = splitTotalCents - splitOneCents - splitTwoCents;
  const splitEnabled = !!values.splitEnabled;
  const splitInvalid = splitEnabled && (
    splitTotalCents <= 0 ||
    splitOneCents <= 0 ||
    splitTwoCents <= 0 ||
    splitRemainderCents !== 0 ||
    !(values.splitOneAccountKey || values.accountKey || splitField?.defaultAccountKey) ||
    !(values.splitTwoAccountKey || values.accountKey || splitField?.defaultAccountKey)
  );

  function handleClose() { setValues({}); onClose(); }
  async function handleSubmit() {
    if (splitInvalid) {
      Alert.alert('Split does not match', 'Both split amounts must be above zero and equal the total amount.');
      return;
    }
    const didSave = await onSubmit(values);
    if (didSave === false) return;
    setValues({});
    onClose();
  }

  function setSplitEnabledValue(next, field) {
    setValues((prev) => ({
      ...prev,
      splitEnabled: next,
      splitOneAccountKey: prev.splitOneAccountKey || prev.accountKey || field.defaultAccountKey || '',
      splitTwoAccountKey: prev.splitTwoAccountKey || prev.accountKey || field.defaultAccountKey || '',
      splitOneCategory: prev.splitOneCategory || prev.category || field.defaultCategory || field.categoryOptions?.[0] || '',
      splitTwoCategory: prev.splitTwoCategory || prev.category || field.defaultCategory || field.categoryOptions?.[0] || '',
    }));
  }

  function renderSplitLine(field, lineNumber, amountKey, accountKey, categoryKey) {
    const accountOptions = field.accountOptions || [];
    const categoryOptions = field.categoryOptions || [];
    return (
      <View style={styles.splitBox} key={`split_${lineNumber}`}>
        <View style={styles.splitHeader}>
          <Text style={styles.splitTitle}>SPLIT {lineNumber}</Text>
          <TextInput
            style={styles.splitAmountInput}
            value={values[amountKey] || ''}
            onChangeText={(v) => setValues((p) => ({ ...p, [amountKey]: v }))}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.fieldLabel}>ACCOUNT</Text>
        <View style={styles.chipRow}>
          {accountOptions.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, (values[accountKey] || values.accountKey) === opt.key && styles.chipOn]}
              onPress={() => setValues((p) => ({ ...p, [accountKey]: opt.key }))}
            >
              <Text style={[styles.chipText, (values[accountKey] || values.accountKey) === opt.key && styles.chipTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {categoryOptions.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.chipRow}>
              {categoryOptions.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, (values[categoryKey] || values.category || field.defaultCategory) === opt && styles.chipOn]}
                  onPress={() => setValues((p) => ({ ...p, [categoryKey]: opt }))}
                >
                  <Text style={[styles.chipText, (values[categoryKey] || values.category || field.defaultCategory) === opt && styles.chipTextOn]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {fields.map((f) => (
              <View key={f.key}>
              {f.type === 'date' ? (
                <DatePickerField
                  label={f.label}
                  value={values[f.key] || ''}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                />
              ) : f.type === 'account' ? (
                <>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  {(f.options || []).length === 0 ? (
                    <Text style={styles.emptyNote}>No accounts configured for this profile.</Text>
                  ) : (
                    <View style={styles.chipRow}>
                      {(f.options || []).map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, values[f.key] === opt.key && styles.chipOn]}
                          onPress={() => setValues((p) => ({ ...p, [f.key]: opt.key }))}
                        >
                          <Text style={[styles.chipText, values[f.key] === opt.key && styles.chipTextOn]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              ) : f.type === 'category' ? (
                <>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <View style={styles.chipRow}>
                    {(f.options || []).map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.chip, values[f.key] === opt && styles.chipOn]}
                        onPress={() => setValues((p) => ({ ...p, [f.key]: opt }))}
                      >
                        <Text style={[styles.chipText, values[f.key] === opt && styles.chipTextOn]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={values[f.key] || ''}
                    onChangeText={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder || ''}
                    placeholderTextColor={theme.textDim}
                  />
                </>
              ) : f.type === 'toggle' ? (
                <>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, values[f.key] !== false && styles.chipOn]}
                      onPress={() => setValues((p) => ({ ...p, [f.key]: true }))}
                    >
                      <Text style={[styles.chipText, values[f.key] !== false && styles.chipTextOn]}>{f.trueLabel || 'YES'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chip, values[f.key] === false && styles.chipOn]}
                      onPress={() => setValues((p) => ({ ...p, [f.key]: false }))}
                    >
                      <Text style={[styles.chipText, values[f.key] === false && styles.chipTextOn]}>{f.falseLabel || 'NO'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : f.type === 'split' ? (
                <>
                  <View style={styles.splitToggleRow}>
                    <View style={styles.splitToggleText}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <Text style={styles.splitHint}>Two lines max. Totals must match.</Text>
                    </View>
                    <Switch
                      value={splitEnabled}
                      onValueChange={(next) => setSplitEnabledValue(next, f)}
                      trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                      thumbColor={splitEnabled ? theme.accent : theme.textDim}
                    />
                  </View>
                  {splitEnabled && (
                    <>
                      {renderSplitLine(f, 1, 'splitOneAmount', 'splitOneAccountKey', 'splitOneCategory')}
                      {renderSplitLine(f, 2, 'splitTwoAmount', 'splitTwoAccountKey', 'splitTwoCategory')}
                      <View style={[styles.splitMathRow, splitRemainderCents !== 0 && styles.splitMathRowWarn]}>
                        <View>
                          <Text style={styles.splitMathLabel}>SPLIT TOTAL</Text>
                          <Text style={styles.splitMathMeta}>{formatCentsShort(splitOneCents + splitTwoCents)} OF {formatCentsShort(splitTotalCents)}</Text>
                        </View>
                        <Text style={[styles.splitMathValue, splitRemainderCents !== 0 && styles.splitMathValueWarn]}>
                          {splitRemainderCents === 0 ? 'MATCH' : formatCentsShort(splitRemainderCents)}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, f.multiline && styles.textArea]}
                    value={values[f.key] || ''}
                    onChangeText={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder || ''}
                    placeholderTextColor={theme.textDim}
                    keyboardType={f.numeric ? 'decimal-pad' : 'default'}
                    multiline={!!f.multiline}
                  />
                </>
              )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, splitInvalid && styles.disabledBtn]} onPress={handleSubmit} activeOpacity={0.8} disabled={splitInvalid}>
              <Text style={styles.addBtnText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BusinessDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { businessId } = route.params || {};
  const businesses = useStore((s) => s.businesses);
  const genericBusinessIncome = useStore((s) => s.genericBusinessIncome);
  const genericBusinessExpenses = useStore((s) => s.genericBusinessExpenses);
  const genericBusinessMileage = useStore((s) => s.genericBusinessMileage);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const novaConfig = useStore((s) => s.novaConfig);
  const logGenericBusinessIncome = useStore((s) => s.logGenericBusinessIncome);
  const logGenericBusinessExpense = useStore((s) => s.logGenericBusinessExpense);
  const logGenericBusinessMileage = useStore((s) => s.logGenericBusinessMileage);
  const editGenericBusinessIncome = useStore((s) => s.editGenericBusinessIncome);
  const deleteGenericBusinessIncome = useStore((s) => s.deleteGenericBusinessIncome);
  const editGenericBusinessExpense = useStore((s) => s.editGenericBusinessExpense);
  const deleteGenericBusinessExpense = useStore((s) => s.deleteGenericBusinessExpense);
  const editGenericBusinessMileage = useStore((s) => s.editGenericBusinessMileage);
  const deleteGenericBusinessMileage = useStore((s) => s.deleteGenericBusinessMileage);
  const businessCardOrder = useStore((s) => s.businessCardOrder);
  const businessHiddenCards = useStore((s) => s.businessHiddenCards);
  const businessVariance = useStore((s) => s.varianceCache.business);
  const updateBusinessCardOrder = useStore((s) => s.updateBusinessCardOrder);
  const updateBusinessHiddenCards = useStore((s) => s.updateBusinessHiddenCards);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const irsRatePerMile = useStore((s) => s.irsRatePerMile);
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const { exportBusinessCsvs } = useExport();

  const biz = (businesses || []).find((b) => b.id === businessId);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingMileage, setEditingMileage] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);
  const [cardOrderVisible, setCardOrderVisible] = useState(false);

  const accountOptions = useMemo(() => {
    const active = (accountRegistry || []).filter(account => account.isActive !== false);
    const businessAccounts = active.filter(account => account.role === 'business');
    return businessAccounts
      .map(account => ({ key: account.legacyKey || account.id, label: (account.name || account.id).toUpperCase() }))
      .filter(option => option.key);
  }, [accountRegistry]);
  const businessCategoryOptions = useMemo(
    () => {
      const active = getActiveSpendingCategoryNames(spendingBuckets, 'business');
      return active.length > 0 ? active : [DEFAULT_EXPENSE_CATEGORY];
    },
    [spendingBuckets],
  );
  const businessSavingsGoals = savingsGoalsForScope(novaConfig?.savingsGoals, 'business');

  if (!biz) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Business not found.</Text>
      </View>
    );
  }

  const bizIncome = (genericBusinessIncome || []).filter((r) => r.businessId === biz.id);
  const bizExpenses = (genericBusinessExpenses || []).filter((r) => r.businessId === biz.id);
  const bizMileage = (genericBusinessMileage || []).filter((r) => r.businessId === biz.id);

  const activeIncome = (bizIncome || []).filter((r) => !r.deleted);
  const activeExpenses = (bizExpenses || []).filter((r) => !r.deleted);
  const activeMileage = (bizMileage || []).filter((r) => !r.deleted);
  const defaultAccountKey = accountOptions.find(option => option.key === biz.defaultAccountKey)?.key || accountOptions[0]?.key || '';
  const accountLabel = (key) => accountOptions.find(opt => opt.key === key)?.label || key || 'UNASSIGNED';
  const txForRecord = (record) => (transactions || []).find(tx =>
    !tx.deleted && (tx.id === record?.transactionId || (record?.id && tx.sourceId === record.id))
  );
  const businessReceiptTransactions = (transactions || []).filter(tx =>
    !tx.deleted && (tx.businessId === biz.id || (tx.source === 'business' && tx.businessId === biz.id))
  );

  const totalIncome = activeIncome.reduce((s, r) => s + (r.amountCents || 0), 0);
  const totalExpenses = activeExpenses.reduce((s, r) => s + (r.amountCents || 0), 0);
  const totalMileage = activeMileage.reduce((s, r) => s + (r.miles || 0), 0);
  const deductibleExpenses = activeExpenses
    .filter((r) => r.taxDeductible !== false)
    .reduce((s, r) => s + (r.amountCents || 0), 0);
  const nonDeductibleExpenses = activeExpenses
    .filter((r) => r.taxDeductible === false)
    .reduce((s, r) => s + (r.amountCents || 0), 0);
  const mileageDeductionCents = activeMileage
    .filter((r) => r.taxDeductible !== false)
    .reduce((s, r) => s + (r.deductionCents || 0), 0);
  const irsRateDisplay = `$${((irsRatePerMile || 0) / 100).toFixed(2)}/mi`;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const recordDate = (record) => {
    const raw = record?.date ?? record?.timestamp ?? record?.createdAt ?? null;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(raw);
  };
  const isThisMonth = (r) => {
    const d = recordDate(r);
    if (!Number.isFinite(d.getTime())) return false;
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const monthIncome = activeIncome.filter(isThisMonth).reduce((s, r) => s + (r.amountCents || 0), 0);
  const monthExpenses = activeExpenses.filter(isThisMonth).reduce((s, r) => s + (r.amountCents || 0), 0);

  const dateToday = () => new Date().toISOString().slice(0, 10);
  const moneyInitial = (record) => record?.amountCents > 0 ? (record.amountCents / 100).toFixed(2) : '';
  const cleanText = (value) => String(value || '').trim();
  const isAccountOption = (key) => !!key && accountOptions.some(option => option.key === key);
  const resolveEntryAccountKey = (key) => isAccountOption(key) ? key : defaultAccountKey;
  const getSplitLines = (vals, amountCents, fallbackAccountKey, fallbackCategory) => {
    if (!vals.splitEnabled) return null;
    const oneAmountCents = parseBillInput(vals.splitOneAmount || '0');
    const twoAmountCents = parseBillInput(vals.splitTwoAmount || '0');
    if (oneAmountCents <= 0 || twoAmountCents <= 0 || oneAmountCents + twoAmountCents !== amountCents) return false;
    return [
      {
        amountCents: oneAmountCents,
        accountKey: resolveEntryAccountKey(vals.splitOneAccountKey) || fallbackAccountKey,
        category: cleanText(vals.splitOneCategory) || fallbackCategory,
      },
      {
        amountCents: twoAmountCents,
        accountKey: resolveEntryAccountKey(vals.splitTwoAccountKey) || fallbackAccountKey,
        category: cleanText(vals.splitTwoCategory) || fallbackCategory,
      },
    ];
  };

  const saveIncome = async (vals, existing = null) => {
    const amountCents = parseBillInput(vals.amount || '0');
    const accountKey = resolveEntryAccountKey(vals.accountKey);
    const clientName = cleanText(vals.clientName);
    if (amountCents <= 0 || !accountKey || !clientName) {
      Alert.alert('Missing details', 'Enter a source/client, amount, and account.');
      return false;
    }
    const entry = {
      ...(existing || {}),
      clientName,
      description: clientName,
      category: cleanText(vals.category) || DEFAULT_INCOME_CATEGORY,
      notes: cleanText(vals.notes),
      amountCents,
      accountKey,
      date: vals.date || existing?.date || dateToday(),
    };
    const splitLines = !existing ? getSplitLines(vals, amountCents, accountKey, entry.category) : null;
    if (splitLines === false) {
      Alert.alert('Split does not match', 'Both split amounts must be above zero and equal the total amount.');
      return false;
    }
    if (existing) await editGenericBusinessIncome(existing.id, entry);
    else if (splitLines) {
      const splitGroupId = makeSplitGroupId('biz_split');
      for (let index = 0; index < splitLines.length; index += 1) {
        const line = splitLines[index];
        await logGenericBusinessIncome(biz.id, {
          ...entry,
          ...line,
          id: `inc_${Date.now()}_${index + 1}`,
          splitGroupId,
          splitPart: index + 1,
          splitTotalParts: 2,
          splitTotalCents: amountCents,
          splitParentDescription: clientName,
        });
      }
    } else await logGenericBusinessIncome(biz.id, { ...entry, id: `inc_${Date.now()}` });
    return true;
  };
  const saveExpense = async (vals, existing = null) => {
    const amountCents = parseBillInput(vals.amount || '0');
    const accountKey = resolveEntryAccountKey(vals.accountKey);
    const vendor = cleanText(vals.vendor || vals.description);
    if (amountCents <= 0 || !accountKey || !vendor) {
      Alert.alert('Missing details', 'Enter a vendor/payee, amount, and account.');
      return false;
    }
    const entry = {
      ...(existing || {}),
      vendor,
      description: vendor,
      category: cleanText(vals.category) || DEFAULT_EXPENSE_CATEGORY,
      taxDeductible: vals.taxDeductible !== false,
      notes: cleanText(vals.notes),
      receiptNote: cleanText(vals.notes),
      amountCents,
      accountKey,
      date: vals.date || existing?.date || dateToday(),
    };
    const splitLines = !existing ? getSplitLines(vals, amountCents, accountKey, entry.category) : null;
    if (splitLines === false) {
      Alert.alert('Split does not match', 'Both split amounts must be above zero and equal the total amount.');
      return false;
    }
    if (existing) await editGenericBusinessExpense(existing.id, entry);
    else if (splitLines) {
      const splitGroupId = makeSplitGroupId('biz_split');
      for (let index = 0; index < splitLines.length; index += 1) {
        const line = splitLines[index];
        await logGenericBusinessExpense(biz.id, {
          ...entry,
          ...line,
          id: `exp_${Date.now()}_${index + 1}`,
          splitGroupId,
          splitPart: index + 1,
          splitTotalParts: 2,
          splitTotalCents: -amountCents,
          splitParentDescription: vendor,
        });
      }
    } else {
      await logGenericBusinessExpense(biz.id, { ...entry, id: `exp_${Date.now()}` });
    }
    return true;
  };
  const saveMileage = async (vals, existing = null) => {
    const miles = parseFloat(vals.miles || '0') || 0;
    const purpose = cleanText(vals.description || vals.purpose);
    if (miles <= 0 || !purpose) {
      Alert.alert('Missing details', 'Enter a trip purpose and miles greater than zero.');
      return false;
    }
    const entry = {
      ...(existing || {}),
      description: purpose,
      purpose,
      category: cleanText(vals.category) || DEFAULT_MILEAGE_CATEGORY,
      taxDeductible: vals.taxDeductible !== false,
      notes: cleanText(vals.notes),
      miles,
      irsRateCents: irsRatePerMile || existing?.irsRateCents || 0,
      date: vals.date || existing?.date || dateToday(),
    };
    if (existing) await editGenericBusinessMileage(existing.id, entry);
    else await logGenericBusinessMileage(biz.id, { ...entry, id: `mile_${Date.now()}` });
    return true;
  };
  const confirmDelete = (label, onDelete) => {
    Alert.alert(`Delete ${label}?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const activeBusinessCardIds = [
    'variance',
    'spending_chart',
    'spending_categories',
    SAVINGS_GOALS_CARD_ID,
    'business_balance',
    'tax_summary',
    'receipt_attachments',
    ...(biz.trackIncome ? ['income'] : []),
    ...(biz.trackExpenses ? ['expenses'] : []),
    ...(biz.trackMileage ? ['mileage'] : []),
  ];
  const orderedBusinessCards = [
    ...(businessCardOrder || []).filter((id) => activeBusinessCardIds.includes(id)),
    ...activeBusinessCardIds.filter((id) => !(businessCardOrder || []).includes(id)),
  ];
  const businessDisplayCards = [
    { id: 'variance', label: 'Variance Summary' },
    { id: 'spending_chart', label: 'Spending Chart' },
    { id: 'spending_categories', label: 'Spending Categories' },
    { id: SAVINGS_GOALS_CARD_ID, label: 'Savings Goals' },
    { id: 'business_balance', label: 'Business Summary' },
    { id: 'tax_summary', label: 'Tax Records' },
    { id: 'receipt_attachments', label: 'Receipt Photos' },
    ...(biz.trackIncome ? [{ id: 'income', label: 'Income' }] : []),
    ...(biz.trackExpenses ? [{ id: 'expenses', label: 'Expenses' }] : []),
    ...(biz.trackMileage ? [{ id: 'mileage', label: 'Mileage' }] : []),
  ];

  const renderBusinessCard = (id) => {
    if (id === 'variance') {
      if (!businessVariance) return null;
      const bv = businessVariance;
      const borderColor = bv.state === 'green' ? theme.statusPositive : bv.state === 'yellow' ? theme.statusWarning : bv.state === 'red' ? theme.statusDanger : theme.borderColorDim;
      const bgColor = bv.state === 'green' ? theme.statusPositiveBg : bv.state === 'yellow' ? theme.statusWarningBg : bv.state === 'red' ? theme.statusDangerBg : theme.backgroundCard;
      const varSign = bv.variance > 0 ? '+' : '';
      const varColor = bv.variance > 0 ? theme.statusPositive : bv.variance < 0 ? theme.statusDanger : theme.textSecondary;
      return (
        <View style={[styles.varianceCard, { borderColor, backgroundColor: bgColor }]}>
          <Text style={styles.varianceLabel}>BUSINESS VARIANCE</Text>
          <Text style={styles.varianceBalance}>{formatCentsShort(bv.balance)}</Text>
          <Text style={[styles.varianceAmt, { color: varColor }]}>{varSign}{formatCentsShort(bv.variance)}</Text>
          <Text style={styles.varianceAnnotation}>{bv.annotation}</Text>
        </View>
      );
    }
    if (id === 'spending_chart') return <SpendingChartsSection profile="business" />;
    if (id === 'spending_categories') return <SpendingCategoryManagerCard profile="business" style={styles.cardOrderInset} />;
    if (id === SAVINGS_GOALS_CARD_ID) {
      return (
        <View style={styles.cardOrderInset}>
          <SavingsGoalsCard
            goals={businessSavingsGoals}
            accounts={accounts}
            accountRegistry={accountRegistry}
            scope="business"
            title="SAVINGS GOALS"
          />
        </View>
      );
    }
    if (id === 'business_balance') {
      return (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>THIS MONTH</Text>
            <Text style={[styles.summaryAmt, { color: monthIncome - monthExpenses >= 0 ? theme.statusPositive : theme.statusDanger }]}>
              {monthIncome - monthExpenses >= 0 ? '+' : ''}{formatCentsShort(monthIncome - monthExpenses)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>INCOME</Text>
            <Text style={[styles.summaryAmt, { color: theme.statusPositive }]}>{formatCentsShort(totalIncome)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>EXPENSES</Text>
            <Text style={[styles.summaryAmt, { color: theme.statusDanger }]}>{formatCentsShort(totalExpenses)}</Text>
          </View>
        </View>
      );
    }
    if (id === 'tax_summary') {
      return (
        <Section title="TAX RECORDS">
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>TAX DEDUCTIBLE EXPENSES</Text>
            <Text style={styles.taxValue}>{formatCentsShort(deductibleExpenses)}</Text>
          </View>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>NON-DEDUCTIBLE EXPENSES</Text>
            <Text style={styles.taxValue}>{formatCentsShort(nonDeductibleExpenses)}</Text>
          </View>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>MILEAGE DEDUCTION</Text>
            <Text style={styles.taxValue}>{formatCentsShort(mileageDeductionCents)}</Text>
          </View>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>IRS MILEAGE RATE</Text>
            <Text style={styles.taxValue}>{irsRateDisplay}</Text>
          </View>
          <Text style={styles.taxNote}>
            CSV exports include category, tax deductible flag, vendor/client, account, notes, IRS rate, and mileage deduction fields.
          </Text>
          <TouchableOpacity style={styles.taxExportBtn} onPress={exportBusinessCsvs}>
            <Text style={styles.taxExportText}>EXPORT TAX CSVs</Text>
          </TouchableOpacity>
        </Section>
      );
    }
    if (id === 'receipt_attachments') {
      return (
        <ReceiptAttachmentsCard
          title="RECEIPT PHOTOS"
          transactions={businessReceiptTransactions}
          getAccountLabel={(tx) => accountLabel(tx.accountKey)}
          style={styles.cardOrderInset}
        />
      );
    }
    if (id === 'income') {
      return (
        <Section title="INCOME">
          <TouchableOpacity style={styles.addRowBtn} onPress={() => setShowIncomeModal(true)}>
            <Text style={styles.addRowBtnText}>+ ADD INCOME</Text>
          </TouchableOpacity>
          <Text style={styles.receiptHint}>Tap a saved income row to add or view receipt photos. Long press to edit/delete.</Text>
          {activeIncome.slice(0, 10).map((r, i) => (
            <TouchableOpacity
              key={r.id || i}
              style={styles.entryRow}
              onPress={() => {
                const tx = txForRecord(r);
                if (tx) setReceiptTx(tx);
              }}
              onLongPress={() => Alert.alert(r.clientName || 'Income', accountLabel(r.accountKey), [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Edit', onPress: () => setEditingIncome(r) },
                { text: 'Delete', style: 'destructive', onPress: () => confirmDelete('income', () => deleteGenericBusinessIncome(r.id)) },
              ])}
            >
              <View style={styles.entryMain}>
                <Text style={styles.entryLabel}>{r.clientName || r.description || 'Income'}</Text>
                <Text style={styles.entryMeta}>{r.category || DEFAULT_INCOME_CATEGORY} - {accountLabel(r.accountKey)}</Text>
              </View>
              <View style={styles.entrySide}>
                <Text style={[styles.entryAmt, { color: theme.statusPositive }]}>{formatCentsShort(r.amountCents)}</Text>
                <Text style={[styles.receiptTag, receiptCount(r) > 0 && styles.receiptTagOn]}>
                  {receiptCount(r) > 0 ? `${receiptCount(r)} PHOTO${receiptCount(r) === 1 ? '' : 'S'}` : 'ADD RECEIPT'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {activeIncome.length === 0 && <Text style={styles.emptyNote}>No income recorded yet.</Text>}
        </Section>
      );
    }
    if (id === 'expenses') {
      return (
        <Section title="EXPENSES">
          <TouchableOpacity style={styles.addRowBtn} onPress={() => setShowExpenseModal(true)}>
            <Text style={styles.addRowBtnText}>+ ADD EXPENSE</Text>
          </TouchableOpacity>
          <Text style={styles.receiptHint}>Tap a saved expense row to take a receipt photo or upload one from gallery/files.</Text>
          {activeExpenses.slice(0, 10).map((r, i) => (
            <TouchableOpacity
              key={r.id || i}
              style={styles.entryRow}
              onPress={() => {
                const tx = txForRecord(r);
                if (tx) setReceiptTx(tx);
              }}
              onLongPress={() => Alert.alert(r.description || 'Expense', accountLabel(r.accountKey), [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Edit', onPress: () => setEditingExpense(r) },
                { text: 'Delete', style: 'destructive', onPress: () => confirmDelete('expense', () => deleteGenericBusinessExpense(r.id)) },
              ])}
            >
              <View style={styles.entryMain}>
                <Text style={styles.entryLabel}>{r.description || r.vendor || 'Expense'}</Text>
                <Text style={styles.entryMeta}>{r.category || DEFAULT_EXPENSE_CATEGORY} - {r.taxDeductible === false ? 'not tax deductible' : 'tax deductible'} - {accountLabel(r.accountKey)}</Text>
              </View>
              <View style={styles.entrySide}>
                <Text style={[styles.entryAmt, { color: theme.statusDanger }]}>{formatCentsShort(r.amountCents)}</Text>
                <Text style={[styles.receiptTag, receiptCount(r) > 0 && styles.receiptTagOn]}>
                  {receiptCount(r) > 0 ? `${receiptCount(r)} PHOTO${receiptCount(r) === 1 ? '' : 'S'}` : 'ADD RECEIPT'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {activeExpenses.length === 0 && <Text style={styles.emptyNote}>No expenses recorded yet.</Text>}
        </Section>
      );
    }
    if (id === 'mileage') {
      return (
        <Section title={`MILEAGE (${totalMileage.toFixed(1)} mi total)`}>
          <TouchableOpacity style={styles.addRowBtn} onPress={() => setShowMileageModal(true)}>
            <Text style={styles.addRowBtnText}>+ ADD MILEAGE</Text>
          </TouchableOpacity>
          {activeMileage.slice(0, 10).map((r, i) => (
            <TouchableOpacity
              key={r.id || i}
              style={styles.entryRow}
              onLongPress={() => Alert.alert(r.description || 'Mileage', `${r.miles || 0} mi`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Edit', onPress: () => setEditingMileage(r) },
                { text: 'Delete', style: 'destructive', onPress: () => confirmDelete('mileage', () => deleteGenericBusinessMileage(r.id)) },
              ])}
            >
              <View style={styles.entryMain}>
                <Text style={styles.entryLabel}>{r.date || '--'} - {r.description || ''}</Text>
                <Text style={styles.entryMeta}>
                  {r.taxDeductible === false ? 'not tax deductible' : 'tax deductible'} - {((r.irsRateCents || irsRatePerMile || 0) / 100).toFixed(2)}/mi - deduction {formatCentsShort(r.deductionCents || 0)}
                </Text>
              </View>
              <Text style={styles.entryAmt}>{r.miles} mi</Text>
            </TouchableOpacity>
          ))}
          {activeMileage.length === 0 && <Text style={styles.emptyNote}>No mileage recorded yet.</Text>}
        </Section>
      );
    }
    return null;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'< BACK'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{biz.name.toUpperCase()}</Text>
        <Text style={styles.trackingText}>
          Tracking: {[
            biz.trackIncome ? 'income' : null,
            biz.trackExpenses ? 'expenses' : null,
            biz.trackMileage ? 'mileage' : null,
          ].filter(Boolean).join(' / ') || 'nothing enabled'}
        </Text>
      </View>

      {orderedBusinessCards
        .filter((id) => !(businessHiddenCards || []).includes(id))
        .map((id) => (
          <React.Fragment key={id}>
            {renderBusinessCard(id)}
          </React.Fragment>
        ))}

      <CardOrderLink
        onPress={() => setCardOrderVisible(true)}
        style={styles.cardOrderInset}
      />

      <AddEntryModal
        visible={showIncomeModal}
        title="ADD INCOME"
        initialValues={{ accountKey: defaultAccountKey, date: dateToday(), category: DEFAULT_INCOME_CATEGORY, splitOneAccountKey: defaultAccountKey, splitTwoAccountKey: defaultAccountKey, splitOneCategory: DEFAULT_INCOME_CATEGORY, splitTwoCategory: DEFAULT_INCOME_CATEGORY }}
        fields={[
          { key: 'clientName', label: 'VENDOR / CLIENT / SOURCE', placeholder: 'Client, platform, or payer' },
          { key: 'category', label: 'CATEGORY', placeholder: DEFAULT_INCOME_CATEGORY },
          { key: 'amount', label: 'AMOUNT', placeholder: '0.00', numeric: true },
          { key: 'split', label: 'SPLIT TRANSACTION', type: 'split', amountKey: 'amount', accountOptions, categoryOptions: [DEFAULT_INCOME_CATEGORY, 'income'], defaultAccountKey, defaultCategory: DEFAULT_INCOME_CATEGORY },
          { key: 'accountKey', label: 'MONEY GOES TO', type: 'account', options: accountOptions },
          { key: 'date', label: 'DATE', type: 'date' },
          { key: 'notes', label: 'NOTES', placeholder: 'Optional details', multiline: true },
        ]}
        onSubmit={(vals) => saveIncome(vals)}
        onClose={() => setShowIncomeModal(false)}
      />

      <AddEntryModal
        visible={showExpenseModal}
        title="ADD EXPENSE"
        initialValues={{ accountKey: defaultAccountKey, date: dateToday(), category: DEFAULT_EXPENSE_CATEGORY, taxDeductible: true, splitOneAccountKey: defaultAccountKey, splitTwoAccountKey: defaultAccountKey, splitOneCategory: DEFAULT_EXPENSE_CATEGORY, splitTwoCategory: DEFAULT_EXPENSE_CATEGORY }}
        fields={[
          { key: 'vendor', label: 'VENDOR / CLIENT / PAYEE', placeholder: 'Vendor, store, or payee' },
          { key: 'category', label: 'CATEGORY', type: 'category', options: businessCategoryOptions, placeholder: DEFAULT_EXPENSE_CATEGORY },
          { key: 'taxDeductible', label: 'TAX DEDUCTIBLE?', type: 'toggle', trueLabel: 'YES', falseLabel: 'NO' },
          { key: 'amount', label: 'AMOUNT', placeholder: '0.00', numeric: true },
          { key: 'split', label: 'SPLIT TRANSACTION', type: 'split', amountKey: 'amount', accountOptions, categoryOptions: businessCategoryOptions, defaultAccountKey, defaultCategory: DEFAULT_EXPENSE_CATEGORY },
          { key: 'accountKey', label: 'PAID FROM', type: 'account', options: accountOptions },
          { key: 'date', label: 'DATE', type: 'date' },
          { key: 'notes', label: 'NOTES / RECEIPT', placeholder: 'Receipt, reason, or supporting detail', multiline: true },
        ]}
        onSubmit={(vals) => saveExpense(vals)}
        onClose={() => setShowExpenseModal(false)}
      />
      <AddEntryModal
        visible={showMileageModal}
        title="ADD MILEAGE"
        initialValues={{ date: dateToday(), category: DEFAULT_MILEAGE_CATEGORY, taxDeductible: true }}
        fields={[
          { key: 'description', label: 'VENDOR / CLIENT / PURPOSE', placeholder: 'Client visit, delivery route, errand' },
          { key: 'category', label: 'CATEGORY', type: 'category', options: businessCategoryOptions, placeholder: DEFAULT_MILEAGE_CATEGORY },
          { key: 'taxDeductible', label: 'TAX DEDUCTIBLE?', type: 'toggle', trueLabel: 'YES', falseLabel: 'NO' },
          { key: 'miles', label: 'MILES', placeholder: '0.0', numeric: true },
          { key: 'date', label: 'DATE', type: 'date' },
          { key: 'notes', label: 'NOTES', placeholder: 'Optional trip details', multiline: true },
        ]}
        onSubmit={(vals) => saveMileage(vals)}
        onClose={() => setShowMileageModal(false)}
      />
      <AddEntryModal
        visible={editingIncome !== null}
        title="EDIT INCOME"
        submitLabel="SAVE"
        initialValues={{
          clientName: editingIncome?.clientName || '',
          category: editingIncome?.category || DEFAULT_INCOME_CATEGORY,
          amount: moneyInitial(editingIncome),
          accountKey: editingIncome?.accountKey || defaultAccountKey,
          date: editingIncome?.date || dateToday(),
          notes: editingIncome?.notes || '',
        }}
        fields={[
          { key: 'clientName', label: 'VENDOR / CLIENT / SOURCE', placeholder: 'Client, platform, or payer' },
          { key: 'category', label: 'CATEGORY', placeholder: DEFAULT_INCOME_CATEGORY },
          { key: 'amount', label: 'AMOUNT', placeholder: '0.00', numeric: true },
          { key: 'accountKey', label: 'MONEY GOES TO', type: 'account', options: accountOptions },
          { key: 'date', label: 'DATE', type: 'date' },
          { key: 'notes', label: 'NOTES', placeholder: 'Optional details', multiline: true },
        ]}
        onSubmit={(vals) => saveIncome(vals, editingIncome)}
        onClose={() => setEditingIncome(null)}
      />
      <AddEntryModal
        visible={editingExpense !== null}
        title="EDIT EXPENSE"
        submitLabel="SAVE"
        initialValues={{
          vendor: editingExpense?.vendor || editingExpense?.description || '',
          category: editingExpense?.category || DEFAULT_EXPENSE_CATEGORY,
          taxDeductible: editingExpense?.taxDeductible !== false,
          amount: moneyInitial(editingExpense),
          accountKey: editingExpense?.accountKey || defaultAccountKey,
          date: editingExpense?.date || dateToday(),
          notes: editingExpense?.notes || editingExpense?.receiptNote || '',
        }}
        fields={[
          { key: 'vendor', label: 'VENDOR / CLIENT / PAYEE', placeholder: 'Vendor, store, or payee' },
          { key: 'category', label: 'CATEGORY', type: 'category', options: businessCategoryOptions, placeholder: DEFAULT_EXPENSE_CATEGORY },
          { key: 'taxDeductible', label: 'TAX DEDUCTIBLE?', type: 'toggle', trueLabel: 'YES', falseLabel: 'NO' },
          { key: 'amount', label: 'AMOUNT', placeholder: '0.00', numeric: true },
          { key: 'accountKey', label: 'PAID FROM', type: 'account', options: accountOptions },
          { key: 'date', label: 'DATE', type: 'date' },
          { key: 'notes', label: 'NOTES / RECEIPT', placeholder: 'Receipt, reason, or supporting detail', multiline: true },
        ]}
        onSubmit={(vals) => saveExpense(vals, editingExpense)}
        onClose={() => setEditingExpense(null)}
      />
      <AddEntryModal
        visible={editingMileage !== null}
        title="EDIT MILEAGE"
        submitLabel="SAVE"
        initialValues={{
          description: editingMileage?.description || '',
          category: editingMileage?.category || DEFAULT_MILEAGE_CATEGORY,
          taxDeductible: editingMileage?.taxDeductible !== false,
          miles: editingMileage?.miles != null ? String(editingMileage.miles) : '',
          date: editingMileage?.date || dateToday(),
          notes: editingMileage?.notes || '',
        }}
        fields={[
          { key: 'description', label: 'VENDOR / CLIENT / PURPOSE', placeholder: 'Client visit, delivery route, errand' },
          { key: 'category', label: 'CATEGORY', type: 'category', options: businessCategoryOptions, placeholder: DEFAULT_MILEAGE_CATEGORY },
          { key: 'taxDeductible', label: 'TAX DEDUCTIBLE?', type: 'toggle', trueLabel: 'YES', falseLabel: 'NO' },
          { key: 'miles', label: 'MILES', placeholder: '0.0', numeric: true },
          { key: 'date', label: 'DATE', type: 'date' },
          { key: 'notes', label: 'NOTES', placeholder: 'Optional trip details', multiline: true },
        ]}
        onSubmit={(vals) => saveMileage(vals, editingMileage)}
        onClose={() => setEditingMileage(null)}
      />
      <TransactionReceiptModal
        visible={receiptTx !== null}
        transaction={receiptTx}
        onClose={() => setReceiptTx(null)}
      />
      <CardOrderSheet
        visible={cardOrderVisible}
        title="BUSINESS CARD ORDER"
        cards={businessDisplayCards}
        currentOrder={businessCardOrder}
        currentHidden={businessHiddenCards}
        onSave={async (order, hidden) => {
          await updateBusinessCardOrder(order);
          await updateBusinessHiddenCards(hidden);
        }}
        onClose={() => setCardOrderVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  backBtn: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: 8 },
  title: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  trackingText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 4 },
  errorText: { color: theme.statusDanger, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, margin: 24 },
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, backgroundColor: theme.backgroundCard, overflow: 'hidden' },
  summaryCell: { flex: 1, padding: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.borderColorDim },
  summaryLabel: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginBottom: 4 },
  summaryAmt: { color: theme.textPrimary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.borderColorDim, gap: theme.spacingSM },
  taxLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, flex: 1 },
  taxValue: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', textAlign: 'right' },
  taxNote: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, lineHeight: 18, padding: 12, borderTopWidth: 1, borderTopColor: theme.borderColorDim },
  taxExportBtn: { margin: 12, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, padding: 10, alignItems: 'center', backgroundColor: theme.accentGlow },
  taxExportText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  section: { marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, backgroundColor: theme.backgroundCard, overflow: 'hidden' },
  sectionTitle: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim, backgroundColor: theme.backgroundPanel },
  addRowBtn: { margin: 12, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: 10, alignItems: 'center', borderStyle: 'dashed' },
  addRowBtnText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.borderColorDim },
  entryMain: { flex: 1, marginRight: theme.spacingSM },
  entryLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, flex: 1 },
  entryMeta: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 2 },
  entrySide: { alignItems: 'flex-end', minWidth: 86 },
  entryAmt: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  receiptHint: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, lineHeight: 16, paddingHorizontal: 12, paddingBottom: 8 },
  receiptTag: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 2 },
  receiptTagOn: { color: theme.accent },
  emptyNote: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, padding: 12, fontStyle: 'italic' },
  varianceCard: { marginHorizontal: 16, marginBottom: 16, padding: theme.spacingLG, borderRadius: theme.borderRadiusMD, borderWidth: 2 },
  varianceLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  varianceBalance: { color: theme.textPrimary, fontSize: theme.fontSizeXXL, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: 4 },
  varianceAmt: { fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, marginBottom: 2 },
  varianceAnnotation: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cardOrderInset: { marginHorizontal: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlayBg },
  sheet: { backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: theme.borderRadiusLG, borderTopRightRadius: theme.borderRadiusLG, padding: theme.spacingLG, gap: theme.spacingSM, maxHeight: '92%' },
  sheetScroll: { maxHeight: '82%' },
  sheetTitle: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingSM },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingXS },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingXS, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4 },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipTextOn: { color: theme.accent },
  sheetActions: { flexDirection: 'row', gap: theme.spacingMD, marginTop: theme.spacingSM },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  cancelText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  addBtn: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  disabledBtn: { opacity: 0.5 },
  addBtnText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  splitToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacingSM, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, backgroundColor: theme.backgroundPanel, marginTop: theme.spacingXS },
  splitToggleText: { flex: 1 },
  splitHint: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 2 },
  splitBox: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, backgroundColor: theme.backgroundPanel, marginTop: theme.spacingSM },
  splitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacingSM },
  splitTitle: { color: theme.accent, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1, flexShrink: 1 },
  splitAmountInput: { width: 96, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundCard, textAlign: 'right' },
  splitMathRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacingSM, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, backgroundColor: theme.accentGlow, padding: theme.spacingSM, marginTop: theme.spacingSM },
  splitMathRowWarn: { borderColor: theme.statusWarning, backgroundColor: theme.statusWarningBg },
  splitMathLabel: { color: theme.textPrimary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  splitMathMeta: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: 2 },
  splitMathValue: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', textAlign: 'right' },
  splitMathValueWarn: { color: theme.statusWarning },
});
