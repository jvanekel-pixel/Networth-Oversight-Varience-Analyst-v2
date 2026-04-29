import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, parseCentsInput, parseBillInput } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { LogTransactionModal, EditBalanceModal, AddBillModal, MarkPaidModal, EditBillModal } from '../components/TransactionModal';

const ACCOUNT_LABELS = {
  entChecking: 'ENT CHECKING',
  entSavings: 'ENT SAVINGS',
  venmo: 'VENMO',
  cash: 'CASH',
};

const PERSONAL_ACCOUNTS = ['entChecking', 'entSavings', 'venmo', 'cash'];

function ordinalDay(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${day}${s[day % 10] || s[0]}`;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function PaycheckModal({ visible, currentAmount, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setRaw(currentAmount > 0 ? (currentAmount / 100).toFixed(2) : '');
  }, [visible]);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (!raw || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(parseBillInput(raw));
    setRaw(''); setIsSubmitting(false); onClose();
  };

  const previewCents = parseBillInput(raw);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>RECORD PAYCHECK</Text>
          <Text style={styles.modalSub}>Rollover sweep runs first, then distribution.</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Gross amount (e.g. 2800.00)"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          {raw.length > 0 && (
            <Text style={styles.modalPreview}>{formatCents(previewCents)}</Text>
          )}
          <TouchableOpacity style={[styles.modalSubmit, isSubmitting && styles.btnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.modalSubmitText}>CONFIRM PAYCHECK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AccountCard({ accountKey, balance, floor, onIncome, onExpense, onEditBal }) {
  return (
    <Card>
      <Text style={styles.cardLabel}>{ACCOUNT_LABELS[accountKey]}</Text>
      <Text style={styles.balanceText}>{formatCentsShort(balance)}</Text>
      {floor > 0 && (
        <Text style={styles.floorText}>Floor: {formatCents(floor)}</Text>
      )}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnIncome} onPress={onIncome}>
          <Text style={styles.btnText}>LOG INCOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnExpense} onPress={onExpense}>
          <Text style={styles.btnText}>LOG EXPENSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDim} onPress={onEditBal}>
          <Text style={styles.btnDimText}>EDIT BAL</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

export default function PersonalScreen() {
  const {
    accounts,
    accountFloors,
    incomeEvents,
    distribution,
    personalBills,
    billOverrides,
    warnings,
    logTransaction,
    updateAccountBalance,
    distributePaycheck,
    addPersonalBill,
    markBillPaid,
    editBill,
    deleteBill,
    checkSpendingFloors,
  } = useStore();

  // Single modal state: { accountKey, modalType } — null means closed
  const [activeModal, setActiveModal] = useState({ accountKey: null, modalType: null });
  const [paycheckVisible, setPaycheckVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  const handleDeleteBill = (billId) => {
    Alert.alert('Delete Subscription', 'Remove this recurring subscription?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBill(billId) },
    ]);
  };

  const closeModal = () => setActiveModal({ accountKey: null, modalType: null });

  useEffect(() => {
    checkSpendingFloors();
  }, []);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const getFloor = (key) =>
    accountFloors[key] !== undefined ? accountFloors[key] : (accountFloors.others || 0);

  const personalWarnings = (warnings || []).filter(w => PERSONAL_ACCOUNTS.includes(w.accountKey));

  const sortedBills = [...(personalBills || [])].filter(b => b.isActive !== false).sort((a, b) => (a.dueDay || a.expectedDay || 0) - (b.dueDay || b.expectedDay || 0));

  const handleTxSubmit = async ({ amountCents, category, description }) => {
    const { accountKey } = activeModal;
    await logTransaction({ accountKey, amountCents, category, description });
    checkSpendingFloors();
  };

  const handleEditBalance = async (cents) => {
    const { accountKey } = activeModal;
    await updateAccountBalance(accountKey, cents);
    checkSpendingFloors();
  };

  const handlePaycheck = async (grossCents) => {
    await distributePaycheck(grossCents);
    checkSpendingFloors();
  };

  const { paycheckAmount = 0, nextPaycheckDate = null } = incomeEvents;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 1. Header strip */}
      <View style={styles.headerStrip}>
        <Text style={styles.screenTitle}>PERSONAL</Text>
        <Text style={styles.screenSubtitle}>Personal Accounts + Pay Cycle</Text>
      </View>

      {/* 2. Four account cards */}
      {PERSONAL_ACCOUNTS.map(key => (
        <AccountCard
          key={key}
          accountKey={key}
          balance={accounts[key] || 0}
          floor={getFloor(key)}
          onIncome={() => setActiveModal({ accountKey: key, modalType: 'income' })}
          onExpense={() => setActiveModal({ accountKey: key, modalType: 'expense' })}
          onEditBal={() => setActiveModal({ accountKey: key, modalType: 'edit' })}
        />
      ))}

      {/* 3. Pay Cycle card */}
      <Card>
        <Text style={styles.cardLabel}>PAY CYCLE</Text>
        <Text style={styles.metaText}>
          Paycheck amount: {paycheckAmount > 0 ? formatCents(paycheckAmount) : 'Not set'}
        </Text>
        <Text style={styles.metaText}>
          Next paycheck: {nextPaycheckDate ? formatDate(nextPaycheckDate) : 'Not set'}
        </Text>
        <View style={styles.distPreview}>
          <Text style={styles.distLabel}>Next distribution:</Text>
          <Text style={styles.distLine}>
            {formatCents(distribution.entSavings)} → ENT Savings
          </Text>
          <Text style={styles.distLine}>
            {formatCents(distribution.venmo)} → Venmo
          </Text>
          <Text style={styles.distLine}>
            Remainder → ENT Checking
          </Text>
        </View>
        <TouchableOpacity style={[styles.btnIncome, { marginTop: theme.spacingSM }]} onPress={() => setPaycheckVisible(true)}>
          <Text style={styles.btnText}>RECORD PAYCHECK</Text>
        </TouchableOpacity>
      </Card>

      {/* 4. Floor warnings */}
      {personalWarnings.length > 0 && (
        <View style={styles.warningCard}>
          {personalWarnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>
              ⚠ {ACCOUNT_LABELS[w.accountKey] || w.accountKey} below floor ({formatCents(w.floor)}) — current: {formatCents(w.balance)}
            </Text>
          ))}
        </View>
      )}

      {/* 5. Recurring subscriptions */}
      <Card>
        <Text style={styles.cardLabel}>RECURRING SUBSCRIPTIONS</Text>
        {sortedBills.length === 0 && (
          <Text style={[styles.metaText, { marginBottom: theme.spacingSM }]}>No subscriptions added yet.</Text>
        )}
        {sortedBills.map(bill => {
          const paidThisMonth = billOverrides[bill.id]?.lastPaidMonth === currentMonth;
          return (
            <View key={bill.id} style={styles.billRow}>
              <View style={styles.billInfo}>
                <Text style={styles.billName}>{bill.name}</Text>
                <Text style={styles.billMeta}>{formatCents(bill.amountCents)} · Due {ordinalDay(bill.dueDay || bill.expectedDay)}</Text>
              </View>
              <View style={styles.billActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => setEditingBill(bill)}>
                  <Text style={styles.editBtnText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteBill(bill.id)}>
                  <Text style={styles.deleteBtnText}>DEL</Text>
                </TouchableOpacity>
                {paidThisMonth ? (
                  <Text style={[styles.paidLabel, { marginLeft: theme.spacingXS }]}>✓ PAID</Text>
                ) : (
                  <TouchableOpacity style={[styles.markPaidBtn, { marginLeft: theme.spacingXS }]} onPress={() => setMarkPaidBill(bill)}>
                    <Text style={styles.markPaidText}>MARK PAID</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        <TouchableOpacity style={styles.addBillBtn} onPress={() => setAddBillVisible(true)}>
          <Text style={styles.addBillText}>+ ADD SUBSCRIPTION</Text>
        </TouchableOpacity>
      </Card>

      {/* Modals */}
      <LogTransactionModal
        visible={activeModal.modalType === 'income' || activeModal.modalType === 'expense'}
        type={activeModal.modalType}
        accountName={ACCOUNT_LABELS[activeModal.accountKey] || ''}
        onSubmit={handleTxSubmit}
        onClose={closeModal}
      />
      <EditBalanceModal
        visible={activeModal.modalType === 'edit'}
        accountName={ACCOUNT_LABELS[activeModal.accountKey] || ''}
        onSubmit={handleEditBalance}
        onClose={closeModal}
      />
      <PaycheckModal
        visible={paycheckVisible}
        currentAmount={paycheckAmount}
        onSubmit={handlePaycheck}
        onClose={() => setPaycheckVisible(false)}
      />
      <AddBillModal
        visible={addBillVisible}
        accountOptions={[
          { key: 'entChecking', label: 'ENT CHECKING' },
          { key: 'venmo', label: 'VENMO' },
          { key: 'cash', label: 'CASH' },
        ]}
        onSubmit={async (bill) => { await addPersonalBill(bill); }}
        onClose={() => setAddBillVisible(false)}
      />
      <MarkPaidModal
        visible={markPaidBill !== null}
        bill={markPaidBill}
        accountOptions={[
          { key: 'entChecking', label: 'ENT CHECKING' },
          { key: 'venmo', label: 'VENMO' },
          { key: 'cash', label: 'CASH' },
        ]}
        onSubmit={async (payment) => {
          await markBillPaid(markPaidBill.id, payment);
          checkSpendingFloors();
          setMarkPaidBill(null);
        }}
        onClose={() => setMarkPaidBill(null)}
      />
      <EditBillModal
        visible={editingBill !== null}
        bill={editingBill}
        accountOptions={[
          { key: 'entChecking', label: 'ENT CHECKING' },
          { key: 'venmo', label: 'VENMO' },
          { key: 'cash', label: 'CASH' },
        ]}
        onSubmit={async (updates) => {
          await editBill(editingBill.id, updates);
          setEditingBill(null);
        }}
        onClose={() => setEditingBill(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: theme.spacingMD,
    paddingBottom: theme.spacingXXL,
  },
  headerStrip: {
    marginBottom: theme.spacingMD,
  },
  screenTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  screenSubtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingXS,
  },
  card: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  cardLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    letterSpacing: 1,
    marginBottom: theme.spacingXS,
  },
  balanceText: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  floorText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingSM,
  },
  metaText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacingXS,
  },
  btnIncome: {
    backgroundColor: theme.accentGlow,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    marginRight: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  btnExpense: {
    backgroundColor: theme.statusDangerBg,
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    marginRight: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  btnDim: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    marginRight: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  btnText: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
  },
  btnDimText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  distPreview: {
    backgroundColor: theme.backgroundPanel,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    marginTop: theme.spacingXS,
    marginBottom: theme.spacingXS,
  },
  distLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginBottom: theme.spacingXS,
  },
  distLine: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginBottom: 2,
  },
  warningCard: {
    backgroundColor: theme.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.statusWarning,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  warningText: {
    color: theme.statusWarning,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacingSM,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  billInfo: {
    flex: 1,
  },
  billName: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
  },
  billMeta: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 2,
  },
  billActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingXS,
    paddingVertical: 2,
    marginLeft: theme.spacingXS,
  },
  editBtnText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingXS,
    paddingVertical: 2,
    marginLeft: theme.spacingXS,
  },
  deleteBtnText: {
    color: theme.statusDanger,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  markPaidBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  markPaidText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  paidLabel: {
    color: theme.statusPositive,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  addBillBtn: {
    marginTop: theme.spacingSM,
    paddingVertical: theme.spacingSM,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  addBillText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  // Modal styles
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacingLG,
  },
  modalPanel: {
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingLG,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusLG,
    width: '100%',
  },
  modalTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  modalSub: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingMD,
  },
  modalInput: {
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
  modalPreview: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginBottom: theme.spacingSM,
  },
  modalSubmit: {
    backgroundColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    marginTop: theme.spacingMD,
    marginBottom: theme.spacingSM,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    color: theme.background,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
  },
  modalCancel: {
    padding: theme.spacingSM,
    alignItems: 'center',
  },
  modalCancelText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
});
