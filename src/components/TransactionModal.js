import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import theme from '../config/theme.config';
import { parseCentsInput, formatCents, formatCentsShort, parseBillInput } from '../utils/currency';
import useStore from '../store/useStore';

const ALL_INCOME_CATEGORIES = ['Paycheck', 'Partner Deposit', 'Other'];
const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Grocery', 'Other'];

export function LogTransactionModal({ visible, type, accountName, onSubmit, onClose }) {
  const userMode = useStore((s) => s.novaConfig?.userMode);
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const incomeCategories = userMode === 'partnered'
    ? ALL_INCOME_CATEGORIES
    : ALL_INCOME_CATEGORIES.filter(c => c !== 'Partner Deposit');
  const categories = type === 'income' ? incomeCategories : EXPENSE_CATEGORIES;
  const previewCents = parseBillInput(amountRaw);

  const reset = () => {
    setAmountRaw('');
    setCategory('');
    setDescription('');
    setIsSubmitting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (previewCents <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    const signed = type === 'income' ? previewCents : -previewCents;
    await onSubmit({ amountCents: signed, category: category || categories[0], description });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
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

          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor={theme.textDim}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (previewCents <= 0 || isSubmitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={previewCents <= 0 || isSubmitting}
          >
            <Text style={styles.submitText}>SUBMIT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function EditBalanceModal({ visible, accountName, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

export function AddBillModal({ visible, onSubmit, onClose, accountOptions = [] }) {
  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [dueDayRaw, setDueDayRaw] = useState('');
  const [isAutoDraft, setIsAutoDraft] = useState(true);
  const [defaultAccountKey, setDefaultAccountKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setDefaultAccountKey(accountOptions[0]?.key || '');
  }, [visible]);

  const reset = () => {
    setName(''); setAmountRaw(''); setDueDayRaw('');
    setIsAutoDraft(true);
    setDefaultAccountKey(accountOptions[0]?.key || '');
    setIsSubmitting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name || !amountRaw || isSubmitting) return;
    setIsSubmitting(true);
    const amountCents = parseBillInput(amountRaw);
    const expectedDay = Math.max(1, Math.min(31, parseInt(dueDayRaw, 10) || 1));
    await onSubmit({ name, amountCents, expectedDay, isAutoDraft, defaultAccountKey: defaultAccountKey || accountOptions[0]?.key || '' });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>ADD BILL</Text>

          <TextInput
            style={styles.input}
            placeholder="Bill name"
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
            <Text style={styles.label}>Auto-draft?</Text>
            <Switch
              value={isAutoDraft}
              onValueChange={setIsAutoDraft}
              trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
              thumbColor={isAutoDraft ? theme.accent : theme.textDim}
            />
          </View>

          {accountOptions.length > 1 && (
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
            <Text style={styles.submitText}>ADD BILL</Text>
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
      const resolvedKey = accountOptions.find(o => o.key === bill.defaultAccountKey)?.key || '';
      setAccountKey(resolvedKey);
      setNotes('');
      setIsSubmitting(false);
    }
  }, [visible]);

  const previewCents = parseBillInput(amountRaw);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  const isValidDate = m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
  const paidDate = isValidDate ? new Date(y, m - 1, d).getTime() : null;
  const datePreview = isValidDate
    ? `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`
    : 'Invalid date';
  const canSubmit = isValidDate && previewCents > 0 && !isSubmitting;

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
          <Text style={styles.title}>MARK PAID</Text>
          {bill && <Text style={styles.sub}>{bill.name}</Text>}

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

          {accountOptions.length > 1 && (
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

export function EditBillModal({ visible, bill, accountOptions = [], onSubmit, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [dueDayRaw, setDueDayRaw] = useState('');
  const [isAutoDraft, setIsAutoDraft] = useState(true);
  const [defaultAccountKey, setDefaultAccountKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && bill) {
      setName(bill.name || '');
      setAmountRaw(bill.amountCents > 0 ? (bill.amountCents / 100).toFixed(2) : '');
      setDueDayRaw(String(bill.expectedDay || bill.dueDay || 1));
      setIsAutoDraft(bill.isAutoDraft !== undefined ? bill.isAutoDraft : true);
      setDefaultAccountKey(bill.defaultAccountKey || (accountOptions[0]?.key || ''));
      setIsSubmitting(false);
    }
  }, [visible, bill]);

  const handleClose = () => onClose();

  const handleSubmit = async () => {
    if (!name || !amountRaw || isSubmitting) return;
    setIsSubmitting(true);
    const amountCents = parseBillInput(amountRaw);
    const expectedDay = Math.max(1, Math.min(31, parseInt(dueDayRaw, 10) || 1));
    await onSubmit({ name, amountCents, expectedDay, dueDay: expectedDay, isAutoDraft, defaultAccountKey });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>EDIT BILL</Text>

          <TextInput
            style={styles.input}
            placeholder="Bill name"
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
            <Text style={styles.label}>Auto-draft?</Text>
            <Switch
              value={isAutoDraft}
              onValueChange={setIsAutoDraft}
              trackColor={{ false: theme.borderColorDim, true: theme.accentGlowStrong }}
              thumbColor={isAutoDraft ? theme.accent : theme.textDim}
            />
          </View>

          {accountOptions.length > 1 && (
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

export function EditTransactionModal({ visible, transaction, onSubmit, onClose }) {
  const userMode = useStore((s) => s.novaConfig?.userMode);
  const isIncome = transaction?.amountCents > 0;
  const incomeCategories = userMode === 'partnered'
    ? ALL_INCOME_CATEGORIES
    : ALL_INCOME_CATEGORIES.filter(c => c !== 'Partner Deposit');
  const categories = isIncome ? incomeCategories : EXPENSE_CATEGORIES;

  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && transaction) {
      const absAmt = Math.abs(transaction.amountCents);
      setAmountRaw((absAmt / 100).toFixed(2));
      setCategory(transaction.category || '');
      setDescription(transaction.description || '');
      setIsSubmitting(false);
    }
  }, [visible, transaction]);

  const handleClose = () => onClose();

  const handleSubmit = async () => {
    if (!amountRaw || isSubmitting) return;
    setIsSubmitting(true);
    const absCents = parseBillInput(amountRaw);
    const amountCents = isIncome ? absCents : -absCents;
    await onSubmit({ amountCents, category: category || categories[0], description });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>EDIT TRANSACTION</Text>
          {transaction && (
            <Text style={styles.sub}>{isIncome ? 'INCOME' : 'EXPENSE'}</Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={amountRaw}
            onChangeText={setAmountRaw}
          />
          <Text style={styles.preview}>{formatCentsShort(parseBillInput(amountRaw))}</Text>

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

          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor={theme.textDim}
            value={description}
            onChangeText={setDescription}
          />

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
