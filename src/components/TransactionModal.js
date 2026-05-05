import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Alert, ScrollView } from 'react-native';
import theme from '../config/theme.config';
import { parseCentsInput, formatCents, formatCentsInputValue, formatCentsShort, parseBillInput } from '../utils/currency';
import useStore from '../store/useStore';
import { getActiveSpendingCategoryNames } from './SpendingCategoryManagerCard';
import {
  CATEGORY_UNCATEGORIZED,
  categoryKey,
} from '../utils/spendingCategories';
import { buildActiveAccountOptions } from '../utils/splitTransactions';

const DEFAULT_INCOME_CATEGORIES = ['Income', 'Other'];

function getExpenseCategories(spendingBuckets, profile, accountKey = null) {
  const active = getActiveSpendingCategoryNames(spendingBuckets, profile, accountKey);
  return active.length > 0 ? active : [CATEGORY_UNCATEGORIZED];
}

function getSubmittedCategory(isIncome, category, categories) {
  if (isIncome) return category || categories[0] || 'Income';
  return category || CATEGORY_UNCATEGORIZED;
}

function defaultScheduledItemType(profile) {
  return profile === 'personal' ? 'subscription' : 'bill';
}

function scheduledItemTypeLabel(type) {
  return type === 'subscription' ? 'Subscription' : 'Bill';
}

function normalizeScheduledItemType(value, fallback = 'bill') {
  return String(value || fallback).toLowerCase().includes('subscription') ? 'subscription' : 'bill';
}

function billAutoPostEnabled(bill) {
  if (!(bill?.amountType === 'static' || bill?.isStaticAmount === true)) return false;
  if (bill?.autoPostEnabled !== undefined) return bill.autoPostEnabled === true;
  if (bill?.isAutoPost !== undefined) return bill.isAutoPost === true;
  if (bill?.isAutoDraft !== undefined) return bill.isAutoDraft !== false;
  return true;
}

function uniqueCategories(items) {
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

function normalizeAccountOptions(options = []) {
  const seen = new Set();
  return (options || [])
    .map(option => ({
      ...option,
      key: option?.key || option?.legacyKey || option?.id,
      label: option?.label || option?.name || option?.id || option?.key,
    }))
    .filter(option => {
      if (!option.key || seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    });
}

function getAccountOptionsKey(options = []) {
  return (options || []).map(option => option.key).join('|');
}

function getScopedAccountChoices({ accountOptions = [], accountRegistry = [], accounts = {}, profile = null, defaultAccountKey = null, accountName = null }) {
  const propOptions = normalizeAccountOptions(accountOptions);
  if (propOptions.length > 0) return propOptions;

  const storeOptions = normalizeAccountOptions(buildActiveAccountOptions(accountRegistry, accounts, profile));
  if (storeOptions.length > 0) return storeOptions;

  if (defaultAccountKey) {
    return normalizeAccountOptions([{ key: defaultAccountKey, label: accountName || defaultAccountKey || 'Account' }]);
  }
  return [];
}

export function LogTransactionModal({
  visible,
  type,
  accountName,
  profile = null,
  defaultAccountKey = null,
  accountOptions = [],
  initialDraft = null,
  onSubmit,
  onClose,
}) {
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const scheduledIncomeEvents = useStore((s) => s.incomeEvents?.scheduledIncomeEvents || []);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = useStore((s) => s.accounts);
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitOneAmountRaw, setSplitOneAmountRaw] = useState('');
  const [splitTwoAmountRaw, setSplitTwoAmountRaw] = useState('');
  const [splitOneCategory, setSplitOneCategory] = useState('');
  const [splitTwoCategory, setSplitTwoCategory] = useState('');
  const [splitOneAccountKey, setSplitOneAccountKey] = useState('');
  const [splitTwoAccountKey, setSplitTwoAccountKey] = useState('');
  const [selectedAccountKey, setSelectedAccountKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const incomeCategories = uniqueCategories([
    ...(scheduledIncomeEvents || []).filter(e => e.isActive !== false).map(e => e.label),
    ...DEFAULT_INCOME_CATEGORIES,
  ]);
  const previewCents = parseBillInput(amountRaw);
  const splitOneCents = parseBillInput(splitOneAmountRaw);
  const splitTwoCents = parseBillInput(splitTwoAmountRaw);
  const splitSumCents = splitOneCents + splitTwoCents;
  const splitRemainderCents = previewCents - splitSumCents;
  const accountChoices = useMemo(() => {
    return getScopedAccountChoices({ accountOptions, accountRegistry, accounts, profile, defaultAccountKey, accountName });
  }, [accountOptions, accountRegistry, accounts, profile, defaultAccountKey, accountName]);
  const fallbackSplitAccountKey =
    accountChoices.find(option => option.key === defaultAccountKey)?.key ||
    accountChoices[0]?.key ||
    '';
  const selectedSingleAccountKey = selectedAccountKey || fallbackSplitAccountKey;
  const expenseCategories = getExpenseCategories(spendingBuckets, profile, selectedSingleAccountKey);
  const categories = type === 'income' ? incomeCategories : expenseCategories;
  const initialExpenseCategories = getExpenseCategories(spendingBuckets, profile, fallbackSplitAccountKey);
  const initialCategories = type === 'income' ? incomeCategories : initialExpenseCategories;
  const splitCanSubmit =
    previewCents > 0 &&
    splitOneCents > 0 &&
    splitTwoCents > 0 &&
    splitRemainderCents === 0 &&
    !!(splitOneAccountKey || fallbackSplitAccountKey) &&
    !!(splitTwoAccountKey || fallbackSplitAccountKey) &&
    !isSubmitting;
  const singleCanSubmit = previewCents > 0 && !!selectedSingleAccountKey && !isSubmitting;
  const canSubmit = splitEnabled ? splitCanSubmit : singleCanSubmit;
  const initialDraftKey = initialDraft?.draftId || '';

  function applyInitialCategory(value, categoryOptions = categories) {
    if (!value) return type === 'income' ? categoryOptions[0] || '' : '';
    const key = String(value || '').toLowerCase();
    return categoryOptions.find(cat => String(cat || '').toLowerCase() === key) || value || '';
  }

  useEffect(() => {
    if (!visible) return;
    const defaultSplitCategory = type === 'income' ? initialCategories[0] || '' : '';
    setAmountRaw(initialDraft?.amountRaw || '');
    setCategory(applyInitialCategory(initialDraft?.category, initialCategories));
    setDescription(initialDraft?.description || '');
    setSplitEnabled(false);
    setSplitOneAmountRaw('');
    setSplitTwoAmountRaw('');
    setSplitOneCategory(defaultSplitCategory);
    setSplitTwoCategory(type === 'income' ? initialCategories[1] || defaultSplitCategory : '');
    setSplitOneAccountKey(fallbackSplitAccountKey);
    setSplitTwoAccountKey(fallbackSplitAccountKey);
    setSelectedAccountKey(fallbackSplitAccountKey);
    setIsSubmitting(false);
  }, [visible, fallbackSplitAccountKey, initialCategories.join('|'), initialDraftKey, type]);

  useEffect(() => {
    if (!visible || type !== 'expense' || !category) return;
    const selectedKey = categoryKey(category);
    const stillAvailable = categories.some(cat => categoryKey(cat) === selectedKey);
    if (!stillAvailable) setCategory('');
  }, [visible, type, selectedSingleAccountKey, categories.join('|'), category]);

  const reset = () => {
    setAmountRaw('');
    setCategory('');
    setDescription('');
    setSplitEnabled(false);
    setSplitOneAmountRaw('');
    setSplitTwoAmountRaw('');
    setSplitOneCategory('');
    setSplitTwoCategory('');
    setSplitOneAccountKey('');
    setSplitTwoAccountKey('');
    setSelectedAccountKey('');
    setIsSubmitting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSplitToggle = (next) => {
    setSplitEnabled(next);
    if (next) {
      const fallback = selectedSingleAccountKey || fallbackSplitAccountKey;
      setSplitOneAccountKey(prev => prev || fallback);
      setSplitTwoAccountKey(prev => prev || fallback);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const signed = type === 'income' ? previewCents : -previewCents;
    if (splitEnabled) {
      const sign = type === 'income' ? 1 : -1;
      await onSubmit({
        splitTransaction: true,
        amountCents: signed,
        description,
        splits: [
          {
            accountKey: splitOneAccountKey || fallbackSplitAccountKey,
            amountCents: sign * splitOneCents,
            category: getSubmittedCategory(type === 'income', splitOneCategory, categories),
            description,
          },
          {
            accountKey: splitTwoAccountKey || fallbackSplitAccountKey,
            amountCents: sign * splitTwoCents,
            category: getSubmittedCategory(type === 'income', splitTwoCategory, categories),
            description,
          },
        ],
      });
      reset();
      onClose();
      return;
    }
    const submittedCategory = getSubmittedCategory(type === 'income', category, categories);
    await onSubmit({
      accountKey: selectedSingleAccountKey,
      amountCents: signed,
      category: submittedCategory,
      description,
    });
    reset();
    onClose();
  };

  const renderSplitAccountChoices = (selectedKey, setSelectedKey) => {
    if (accountChoices.length <= 0) return null;
    return (
      <>
        <Text style={styles.splitSubLabel}>Account</Text>
        <View style={styles.catRow}>
          {accountChoices.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.catBtn, selectedKey === opt.key && styles.catBtnActive]}
              onPress={() => setSelectedKey(opt.key)}
            >
              <Text style={[styles.catText, selectedKey === opt.key && styles.catTextActive]} numberOfLines={1}>
                {String(opt.label || opt.key).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  const renderSplitCategoryChoices = (selectedCategory, setSelectedCategory) => (
    <>
      <Text style={styles.splitSubLabel}>Category</Text>
      <View style={styles.catRow}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderSplitLine = (lineNumber, amountValue, setAmountValue, selectedAccountKey, setSelectedAccountKey, selectedCategory, setSelectedCategory) => (
    <View style={styles.splitCard} key={`split_${lineNumber}`}>
      <View style={styles.splitHeader}>
        <Text style={styles.splitTitle}>SPLIT {lineNumber}</Text>
        <TextInput
          style={styles.splitAmountInput}
          placeholder="0.00"
          placeholderTextColor={theme.textDim}
          keyboardType="decimal-pad"
          value={amountValue}
          onChangeText={setAmountValue}
        />
      </View>
      {renderSplitAccountChoices(selectedAccountKey, setSelectedAccountKey)}
      {renderSplitCategoryChoices(selectedCategory, setSelectedCategory)}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{type === 'income' ? 'LOG INCOME' : 'LOG EXPENSE'}</Text>
            <Text style={styles.sub}>{accountName}</Text>

            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
              value={amountRaw}
              onChangeText={setAmountRaw}
            />
            <Text style={styles.preview}>{formatCentsShort(previewCents)}</Text>

            <View style={styles.splitToggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleLabel}>SPLIT TRANSACTION</Text>
                <Text style={styles.toggleHint}>Two lines max. Totals must match.</Text>
              </View>
              <Switch
                value={splitEnabled}
                onValueChange={handleSplitToggle}
                trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                thumbColor={splitEnabled ? theme.accent : theme.textDim}
              />
            </View>

            {splitEnabled ? (
              <>
                {renderSplitLine(
                  1,
                  splitOneAmountRaw,
                  setSplitOneAmountRaw,
                  splitOneAccountKey,
                  setSplitOneAccountKey,
                  splitOneCategory,
                  setSplitOneCategory,
                )}
                {renderSplitLine(
                  2,
                  splitTwoAmountRaw,
                  setSplitTwoAmountRaw,
                  splitTwoAccountKey,
                  setSplitTwoAccountKey,
                  splitTwoCategory,
                  setSplitTwoCategory,
                )}
                <View style={[styles.splitMathRow, splitRemainderCents !== 0 && styles.splitMathRowWarn]}>
                  <View>
                    <Text style={styles.splitMathLabel}>Split total</Text>
                    <Text style={styles.splitMathMeta}>{formatCentsShort(splitSumCents)} of {formatCentsShort(previewCents)}</Text>
                  </View>
                  <Text style={[styles.splitMathValue, splitRemainderCents !== 0 && styles.splitMathValueWarn]}>
                    {splitRemainderCents === 0 ? 'MATCH' : formatCentsShort(splitRemainderCents)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {accountChoices.length > 0 && (
                  <>
                    <Text style={styles.label}>{type === 'income' ? 'Money goes to' : 'Paid from'}</Text>
                    <View style={styles.catRow}>
                      {accountChoices.map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.catBtn, selectedSingleAccountKey === opt.key && styles.catBtnActive]}
                          onPress={() => setSelectedAccountKey(opt.key)}
                        >
                          <Text style={[styles.catText, selectedSingleAccountKey === opt.key && styles.catTextActive]} numberOfLines={1}>
                            {String(opt.label || opt.key).toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <Text style={styles.label}>Category</Text>
                <View style={styles.catRow}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catBtn, category === cat && styles.catBtnActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Description"
              placeholderTextColor={theme.textDim}
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.disabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitText}>{splitEnabled ? 'SUBMIT SPLIT' : 'SUBMIT'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function EditBalanceModal({ visible, accountName, currentBalanceCents = null, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRaw(formatCentsInputValue(currentBalanceCents));
    setIsSubmitting(false);
  }, [visible, currentBalanceCents]);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };

  const handleSubmit = async () => {
    if (!raw || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(parseBillInput(raw));
    setRaw('');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>EDIT BALANCE</Text>
          <Text style={styles.sub}>{accountName}</Text>

          <TextInput
            style={styles.input}
            placeholder="New balance (e.g. 1250.00)"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(parseBillInput(raw))}</Text>

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>SAVE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function TransferModal({ visible, fromAccountKey = null, accountOptions: scopedAccountOptions = [], profile = null, onSubmit, onClose }) {
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = useStore((s) => s.accounts);
  const accountOptions = useMemo(() => (
    getScopedAccountChoices({ accountOptions: scopedAccountOptions, accountRegistry, accounts, profile, defaultAccountKey: fromAccountKey })
  ), [scopedAccountOptions, accountRegistry, accounts, profile, fromAccountKey]);
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const defaultFrom = accountOptions.find(opt => opt.key === fromAccountKey)?.key || accountOptions[0]?.key || '';
    const defaultTo = accountOptions.find(opt => opt.key !== defaultFrom)?.key || '';
    setFromKey(defaultFrom);
    setToKey(defaultTo);
    setAmountRaw('');
    setDescription('');
    setIsSubmitting(false);
  }, [visible, fromAccountKey, getAccountOptionsKey(accountOptions)]);

  const previewCents = parseBillInput(amountRaw);
  const canSubmit = previewCents > 0 && fromKey && toKey && fromKey !== toKey && !isSubmitting;
  const handleClose = () => {
    setAmountRaw('');
    setDescription('');
    setIsSubmitting(false);
    onClose();
  };
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    await onSubmit({
      fromAccountKey: fromKey,
      toAccountKey: toKey,
      amountCents: previewCents,
      description,
    });
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>TRANSFER BETWEEN ACCOUNTS</Text>
          <Text style={styles.helpText}>Transfers create two linked ledger entries so both balances stay reconciled.</Text>

          <Text style={styles.label}>From</Text>
          <View style={styles.catRow}>
            {accountOptions.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.catBtn, fromKey === opt.key && styles.catBtnActive]}
                onPress={() => {
                  setFromKey(opt.key);
                  if (toKey === opt.key) {
                    setToKey(accountOptions.find(account => account.key !== opt.key)?.key || '');
                  }
                }}
              >
                <Text style={[styles.catText, fromKey === opt.key && styles.catTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>To</Text>
          <View style={styles.catRow}>
            {accountOptions.filter(opt => opt.key !== fromKey).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.catBtn, toKey === opt.key && styles.catBtnActive]}
                onPress={() => setToKey(opt.key)}
              >
                <Text style={[styles.catText, toKey === opt.key && styles.catTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amountRaw}
            onChangeText={setAmountRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(previewCents)}</Text>

          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor={theme.textDim}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitText}>TRANSFER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function AddBillModal({ visible, onSubmit, onClose, accountOptions = [], profile = null }) {
  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [dueDayRaw, setDueDayRaw] = useState('');
  const [billType, setBillType] = useState(defaultScheduledItemType(profile));
  const [isStaticAmount, setIsStaticAmount] = useState(false);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);
  const [defaultAccountKey, setDefaultAccountKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setDefaultAccountKey(accountOptions[0]?.key || '');
      setBillType(defaultScheduledItemType(profile));
    }
  }, [visible, accountOptions, profile]);

  const reset = () => {
    setName(''); setAmountRaw(''); setDueDayRaw('');
    setBillType(defaultScheduledItemType(profile));
    setIsStaticAmount(false);
    setAutoPostEnabled(false);
    setDefaultAccountKey(accountOptions[0]?.key || '');
    setIsSubmitting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name || !amountRaw || parseBillInput(amountRaw) <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    const amountCents = parseBillInput(amountRaw);
    const expectedDay = Math.max(1, Math.min(31, parseInt(dueDayRaw, 10) || 1));
    await onSubmit({
      name,
      amountCents,
      expectedDay,
      billType,
      kind: billType,
      autoPostEnabled: isStaticAmount && autoPostEnabled,
      isAutoPost: isStaticAmount && autoPostEnabled,
      isAutoDraft: isStaticAmount && autoPostEnabled,
      amountType: isStaticAmount ? 'static' : 'dynamic',
      isStaticAmount,
      defaultAccountKey: defaultAccountKey || accountOptions[0]?.key || '',
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>ADD SCHEDULED ITEM</Text>

          <Text style={styles.label}>Type</Text>
          <View style={styles.catRow}>
            {['bill', 'subscription'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.catBtn, billType === type && styles.catBtnActive]}
                onPress={() => setBillType(type)}
              >
                <Text style={[styles.catText, billType === type && styles.catTextActive]}>
                  {scheduledItemTypeLabel(type).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={`${scheduledItemTypeLabel(billType)} name`}
            placeholderTextColor={theme.textDim}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount (e.g. 125.00)"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amountRaw}
            onChangeText={setAmountRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(parseBillInput(amountRaw))}</Text>
          <TextInput
            style={styles.input}
            placeholder="Expected day of month (1–31)"
            placeholderTextColor={theme.textDim}
            keyboardType="numeric"
            value={dueDayRaw}
            onChangeText={t => setDueDayRaw(t.replace(/[^0-9]/g, ''))}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Fixed amount?</Text>
            <Switch
              value={isStaticAmount}
              onValueChange={(value) => {
                setIsStaticAmount(value);
                setAutoPostEnabled(current => value ? current : false);
              }}
              trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
              thumbColor={isStaticAmount ? theme.accent : theme.textDim}
            />
          </View>
          <Text style={styles.helpText}>
            Fixed amounts can Auto-Post. Variable amounts stay estimated until you confirm the actual payment.
          </Text>

          {isStaticAmount && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.label}>Auto-Post</Text>
                <Text style={styles.helpText}>When on, NOVA deducts this item on its due date. Mark Paid remains available for confirmation.</Text>
              </View>
              <Switch
                value={autoPostEnabled}
                onValueChange={setAutoPostEnabled}
                trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                thumbColor={autoPostEnabled ? theme.accent : theme.textDim}
              />
            </View>
          )}

          {accountOptions.length > 0 && (
            <>
              <Text style={styles.label}>Default account</Text>
              <View style={styles.catRow}>
                {accountOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.catBtn, defaultAccountKey === opt.key && styles.catBtnActive]}
                    onPress={() => setDefaultAccountKey(opt.key)}
                  >
                    <Text style={[styles.catText, defaultAccountKey === opt.key && styles.catTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>ADD {scheduledItemTypeLabel(billType).toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function MarkPaidModal({ visible, bill, accountOptions = [], onSubmit, onClose }) {
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [amountRaw, setAmountRaw] = useState('');
  const [accountKey, setAccountKey] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && bill) {
      const n = new Date();
      setMonth(String(n.getMonth() + 1));
      setDay(String(n.getDate()));
      setYear(String(n.getFullYear()));
      setAmountRaw(bill.amountCents > 0 ? (bill.amountCents / 100).toFixed(2) : '');
      const resolvedKey = accountOptions.find(o => o.key === bill.defaultAccountKey)?.key || accountOptions[0]?.key || '';
      setAccountKey(resolvedKey);
      setNotes('');
      setIsSubmitting(false);
    }
  }, [visible, bill, accountOptions]);

  const previewCents = parseBillInput(amountRaw);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  const isValidDate = m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
  const paidDate = isValidDate ? new Date(y, m - 1, d).getTime() : null;
  const datePreview = isValidDate
    ? `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`
    : 'Invalid date';
  const canSubmit = isValidDate && previewCents > 0 && !!accountKey && !isSubmitting;

  const handleClose = () => onClose();
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    await onSubmit({ paidDate, paidAmountCents: previewCents, accountKey, notes });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>{bill?.amountType === 'static' || bill?.isStaticAmount ? `MARK ${scheduledItemTypeLabel(normalizeScheduledItemType(bill?.billType || bill?.kind)).toUpperCase()} PAID` : `CONFIRM ${scheduledItemTypeLabel(normalizeScheduledItemType(bill?.billType || bill?.kind)).toUpperCase()} AMOUNT PAID`}</Text>
          {bill && <Text style={styles.sub}>{bill.name}</Text>}
          {bill?.amountType !== 'static' && !bill?.isStaticAmount && (
            <Text style={styles.helpText}>The expected amount stays reserved until you confirm the actual payment.</Text>
          )}

          <Text style={styles.label}>Date paid</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="MM"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              maxLength={2}
              value={month}
              onChangeText={t => setMonth(t.replace(/[^0-9]/g, ''))}
            />
            <Text style={styles.dateSep}>/</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="DD"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              maxLength={2}
              value={day}
              onChangeText={t => setDay(t.replace(/[^0-9]/g, ''))}
            />
            <Text style={styles.dateSep}>/</Text>
            <TextInput
              style={styles.dateInputYear}
              placeholder="YYYY"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              maxLength={4}
              value={year}
              onChangeText={t => setYear(t.replace(/[^0-9]/g, ''))}
            />
          </View>
          <Text style={styles.preview}>{datePreview}</Text>

          <Text style={styles.label}>Amount paid</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amountRaw}
            onChangeText={setAmountRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(previewCents)}</Text>

          {accountOptions.length > 0 && (
            <>
              <Text style={styles.label}>Account paid from</Text>
              <View style={styles.catRow}>
                {accountOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.catBtn, accountKey === opt.key && styles.catBtnActive]}
                    onPress={() => setAccountKey(opt.key)}
                  >
                    <Text style={[styles.catText, accountKey === opt.key && styles.catTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.textDim}
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitText}>CONFIRM PAYMENT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function EditBillModal({ visible, bill, accountOptions = [], onSubmit, onDelete, onClose, profile = null }) {
  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [dueDayRaw, setDueDayRaw] = useState('');
  const [billType, setBillType] = useState(defaultScheduledItemType(profile));
  const [isStaticAmount, setIsStaticAmount] = useState(false);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);
  const [defaultAccountKey, setDefaultAccountKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && bill) {
      setName(bill.name || '');
      setAmountRaw(bill.amountCents > 0 ? (bill.amountCents / 100).toFixed(2) : '');
      setDueDayRaw(String(bill.expectedDay || bill.dueDay || 1));
      setBillType(normalizeScheduledItemType(bill.billType || bill.kind, defaultScheduledItemType(profile)));
      setIsStaticAmount(bill.amountType === 'static' || bill.isStaticAmount === true);
      setAutoPostEnabled(billAutoPostEnabled(bill));
      setDefaultAccountKey(bill.defaultAccountKey || (accountOptions[0]?.key || ''));
      setIsSubmitting(false);
    }
  }, [visible, bill, accountOptions, profile]);

  const handleClose = () => onClose();

  const handleSubmit = async () => {
    if (!name || !amountRaw || parseBillInput(amountRaw) <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    const amountCents = parseBillInput(amountRaw);
    const expectedDay = Math.max(1, Math.min(31, parseInt(dueDayRaw, 10) || 1));
    await onSubmit({
      name,
      amountCents,
      expectedDay,
      dueDay: expectedDay,
      billType,
      kind: billType,
      autoPostEnabled: isStaticAmount && autoPostEnabled,
      isAutoPost: isStaticAmount && autoPostEnabled,
      isAutoDraft: isStaticAmount && autoPostEnabled,
      amountType: isStaticAmount ? 'static' : 'dynamic',
      isStaticAmount,
      defaultAccountKey,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>EDIT BILL</Text>

          <Text style={styles.label}>Type</Text>
          <View style={styles.catRow}>
            {['bill', 'subscription'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.catBtn, billType === type && styles.catBtnActive]}
                onPress={() => setBillType(type)}
              >
                <Text style={[styles.catText, billType === type && styles.catTextActive]}>
                  {scheduledItemTypeLabel(type).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={`${scheduledItemTypeLabel(billType)} name`}
            placeholderTextColor={theme.textDim}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount (e.g. 125.00)"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amountRaw}
            onChangeText={setAmountRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(parseBillInput(amountRaw))}</Text>
          <TextInput
            style={styles.input}
            placeholder="Expected day of month (1–31)"
            placeholderTextColor={theme.textDim}
            keyboardType="numeric"
            value={dueDayRaw}
            onChangeText={t => setDueDayRaw(t.replace(/[^0-9]/g, ''))}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Fixed amount?</Text>
            <Switch
              value={isStaticAmount}
              onValueChange={(value) => {
                setIsStaticAmount(value);
                setAutoPostEnabled(current => value ? current : false);
              }}
              trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
              thumbColor={isStaticAmount ? theme.accent : theme.textDim}
            />
          </View>
          <Text style={styles.helpText}>
            Fixed amounts can Auto-Post. Variable amounts stay estimated until you confirm the actual payment.
          </Text>

          {isStaticAmount && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.label}>Auto-Post</Text>
                <Text style={styles.helpText}>When on, NOVA deducts this item on its due date. Mark Paid remains available for confirmation.</Text>
              </View>
              <Switch
                value={autoPostEnabled}
                onValueChange={setAutoPostEnabled}
                trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
                thumbColor={autoPostEnabled ? theme.accent : theme.textDim}
              />
            </View>
          )}

          {accountOptions.length > 0 && (
            <>
              <Text style={styles.label}>Default account</Text>
              <View style={styles.catRow}>
                {accountOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.catBtn, defaultAccountKey === opt.key && styles.catBtnActive]}
                    onPress={() => setDefaultAccountKey(opt.key)}
                  >
                    <Text style={[styles.catText, defaultAccountKey === opt.key && styles.catTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>SAVE CHANGES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteBillBtn}
              onPress={() => {
                Alert.alert(
                  `Delete ${bill?.name || 'Bill'}?`,
                  "This can't be undone.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { onDelete(); onClose(); } },
                  ]
                );
              }}
            >
              <Text style={styles.deleteBillText}>DELETE BILL</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function EditTransactionModal({ visible, transaction, profile = null, accountOptions = [], onSubmit, onClose }) {
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const scheduledIncomeEvents = useStore((s) => s.incomeEvents?.scheduledIncomeEvents || []);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = useStore((s) => s.accounts);
  const isTransfer = transaction?.source === 'transfer' || transaction?.sourceType === 'account_transfer' || !!transaction?.transferGroupId;
  const isIncome = transaction?.amountCents > 0;
  const incomeCategories = uniqueCategories([
    ...(scheduledIncomeEvents || []).filter(e => e.isActive !== false).map(e => e.label),
    ...DEFAULT_INCOME_CATEGORIES,
  ]);
  const accountChoices = useMemo(() => {
    return getScopedAccountChoices({
      accountOptions,
      accountRegistry,
      accounts,
      profile,
      defaultAccountKey: transaction?.accountKey,
      accountName: transaction?.accountKey,
    });
  }, [accountOptions, accountRegistry, accounts, profile, transaction?.accountKey]);

  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState('');
  const [accountKey, setAccountKey] = useState('');
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedEditAccountKey = accountKey || transaction?.accountKey || null;
  const expenseCategories = getExpenseCategories(spendingBuckets, profile, selectedEditAccountKey);
  const categories = isTransfer ? ['transfer'] : isIncome ? incomeCategories : expenseCategories;

  useEffect(() => {
    if (visible && transaction) {
      const absAmt = Math.abs(transaction.amountCents);
      const txAccountKey = transaction.accountKey || '';
      const counterpartKey = transaction.counterpartyAccountKey || '';
      const transferFromKey = (transaction.amountCents || 0) < 0 ? txAccountKey : counterpartKey;
      const transferToKey = (transaction.amountCents || 0) < 0 ? counterpartKey : txAccountKey;
      const defaultFromKey =
        accountChoices.find(option => option.key === transferFromKey)?.key ||
        (accountChoices.length === 0 ? transferFromKey : '') ||
        accountChoices[0]?.key ||
        '';
      const defaultToKey =
        accountChoices.find(option => option.key === transferToKey && option.key !== defaultFromKey)?.key ||
        (accountChoices.length === 0 && transferToKey !== defaultFromKey ? transferToKey : '') ||
        accountChoices.find(option => option.key !== defaultFromKey)?.key ||
        '';
      setAmountRaw((absAmt / 100).toFixed(2));
      setCategory(transaction.category || '');
      setAccountKey(
        accountChoices.find(option => option.key === txAccountKey)?.key ||
        (accountChoices.length === 0 ? txAccountKey : '') ||
        accountChoices[0]?.key ||
        ''
      );
      setFromKey(defaultFromKey);
      setToKey(defaultToKey);
      setDescription(transaction.description || '');
      setIsSubmitting(false);
    }
  }, [visible, transaction, getAccountOptionsKey(accountChoices)]);

  const handleClose = () => onClose();
  const previewCents = parseBillInput(amountRaw);
  const canSubmit =
    previewCents > 0 &&
    !isSubmitting &&
    (isTransfer ? !!fromKey && !!toKey && fromKey !== toKey : !!accountKey);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const absCents = previewCents;
    const amountCents = isTransfer ? absCents : isIncome ? absCents : -absCents;
    const nextCategory = isTransfer ? 'transfer' : getSubmittedCategory(isIncome, category, categories);
    await onSubmit({
      amountCents,
      category: nextCategory,
      description,
      ...(isTransfer ? { fromAccountKey: fromKey, toAccountKey: toKey } : { accountKey }),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>{isTransfer ? 'EDIT TRANSFER' : 'EDIT TRANSACTION'}</Text>
          {transaction && (
            <Text style={styles.sub}>{isTransfer ? 'LINKED ACCOUNT TRANSFER' : isIncome ? 'INCOME' : 'EXPENSE'}</Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amountRaw}
            onChangeText={setAmountRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(previewCents)}</Text>

          {isTransfer ? (
            <>
              <Text style={styles.helpText}>Saving this amount updates both sides of the transfer.</Text>
              {accountChoices.length > 0 && (
                <>
                  <Text style={styles.label}>From</Text>
                  <View style={styles.catRow}>
                    {accountChoices.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.catBtn, fromKey === opt.key && styles.catBtnActive]}
                        onPress={() => {
                          setFromKey(opt.key);
                          if (toKey === opt.key) {
                            setToKey(accountChoices.find(option => option.key !== opt.key)?.key || '');
                          }
                        }}
                      >
                        <Text style={[styles.catText, fromKey === opt.key && styles.catTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>To</Text>
                  <View style={styles.catRow}>
                    {accountChoices.filter(opt => opt.key !== fromKey).map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.catBtn, toKey === opt.key && styles.catBtnActive]}
                        onPress={() => setToKey(opt.key)}
                      >
                        <Text style={[styles.catText, toKey === opt.key && styles.catTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              {accountChoices.length > 0 && (
                <>
                  <Text style={styles.label}>{isIncome ? 'Money goes to' : 'Paid from'}</Text>
                  <View style={styles.catRow}>
                    {accountChoices.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.catBtn, accountKey === opt.key && styles.catBtnActive]}
                        onPress={() => setAccountKey(opt.key)}
                      >
                        <Text style={[styles.catText, accountKey === opt.key && styles.catTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, category === cat && styles.catBtnActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor={theme.textDim}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitText}>SAVE CHANGES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.overlayBg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacingLG,
  },
  panel: {
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingLG,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusLG,
    width: '100%',
    maxHeight: '92%',
  },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  sub: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingMD,
  },
  label: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  helpText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingSM,
    lineHeight: 16,
  },
  input: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    marginBottom: theme.spacingSM,
  },
  preview: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginBottom: theme.spacingSM,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacingMD,
  },
  splitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    padding: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  toggleTextBlock: {
    flex: 1,
  },
  toggleLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  toggleHint: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  splitCard: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    padding: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  splitTitle: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  splitAmountInput: {
    backgroundColor: theme.backgroundPanel,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    width: 96,
    textAlign: 'right',
  },
  splitSubLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  splitMathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.accentGlow,
    padding: theme.spacingSM,
    marginBottom: theme.spacingMD,
  },
  splitMathRowWarn: {
    borderColor: theme.statusWarning,
    backgroundColor: theme.statusWarningBg,
  },
  splitMathLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  splitMathMeta: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  splitMathValue: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  splitMathValueWarn: {
    color: theme.statusWarning,
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacingMD,
  },
  catBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    marginRight: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  catBtnActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  catText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  catTextActive: {
    color: theme.accent,
  },
  submitBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginTop: theme.spacingMD,
    marginBottom: theme.spacingSM,
  },
  disabled: {
    opacity: 0.5,
  },
  submitText: {
    color: theme.background,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: theme.spacingSM,
    alignItems: 'center',
  },
  cancelText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  deleteBillBtn: {
    padding: theme.spacingSM,
    alignItems: 'center',
    marginTop: theme.spacingXS,
  },
  deleteBillText: {
    color: theme.statusDanger,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacingXS,
  },
  dateInput: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    width: 52,
    textAlign: 'center',
  },
  dateInputYear: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    width: 72,
    textAlign: 'center',
  },
  dateSep: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeLG,
    marginHorizontal: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
});
