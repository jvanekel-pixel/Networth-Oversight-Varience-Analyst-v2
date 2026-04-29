import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, parseCentsInput, parseBillInput } from '../utils/currency';
import { getPartnerDepositDate, formatDate } from '../utils/dates';
import { LogTransactionModal, EditBalanceModal, AddBillModal, MarkPaidModal, EditBillModal } from '../components/TransactionModal';

function ordinalDay(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${day}${s[day % 10] || s[0]}`;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function GrocerySpendModal({ visible, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewCents = parseBillInput(raw);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (previewCents <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(previewCents);
    setRaw(''); setIsSubmitting(false); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>LOG GROCERY SPEND</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          <Text style={styles.modalPreview}>{formatCentsShort(previewCents)}</Text>
          <TouchableOpacity style={[styles.modalSubmit, (previewCents <= 0 || isSubmitting) && styles.btnDisabled]} onPress={handleSubmit} disabled={previewCents <= 0 || isSubmitting}>
            <Text style={styles.modalSubmitText}>LOG SPEND</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SetLimitModal({ visible, currentLimit, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setRaw(currentLimit > 0 ? (currentLimit / 100).toFixed(2) : '');
  }, [visible]);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (!raw || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(parseBillInput(raw));
    setRaw(''); setIsSubmitting(false); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>SET WEEKLY LIMIT</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Weekly grocery limit (e.g. 200.00)"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          <TouchableOpacity style={[styles.modalSubmit, isSubmitting && styles.btnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.modalSubmitText}>SET LIMIT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DepositModal({ visible, expectedAmount, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setRaw(expectedAmount > 0 ? (expectedAmount / 100).toFixed(2) : '');
  }, [visible]);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(parseBillInput(raw));
    setRaw(''); setIsSubmitting(false); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>RECORD PARTNER DEPOSIT</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Amount (e.g. 500.00)"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          <TouchableOpacity style={[styles.modalSubmit, isSubmitting && styles.btnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.modalSubmitText}>CONFIRM DEPOSIT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function HouseholdScreen() {
  const {
    accounts,
    incomeEvents,
    groceryBudget,
    householdBills,
    billOverrides,
    warnings,
    logTransaction,
    updateAccountBalance,
    recordPartnerDeposit,
    logGrocerySpend,
    updateGroceryBudget,
    addHouseholdBill,
    markBillPaid,
    editBill,
    deleteBill,
    checkSpendingFloors,
  } = useStore();

  const [txType, setTxType] = useState(null);
  const [editBalVisible, setEditBalVisible] = useState(false);
  const [depositVisible, setDepositVisible] = useState(false);
  const [groceryVisible, setGroceryVisible] = useState(false);
  const [limitVisible, setLimitVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  const handleDeleteBill = (billId) => {
    Alert.alert('Delete Bill', 'Remove this bill from your household?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBill(billId) },
    ]);
  };

  useEffect(() => {
    checkSpendingFloors();
  }, []);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const expectedDepositDate = getPartnerDepositDate(now.getFullYear(), now.getMonth());
  const depositReceivedThisMonth = incomeEvents.partnerDepositLastReceivedMonth === currentMonth;
  const depositDatePast = now > expectedDepositDate;

  const { weeklyLimit = 0, currentWeekSpend = 0 } = groceryBudget || {};
  const groceryPct = weeklyLimit > 0 ? currentWeekSpend / weeklyLimit : 0;
  const groceryBarColor = groceryPct >= 0.95
    ? theme.statusDanger
    : groceryPct >= 0.60
    ? theme.statusWarning
    : theme.statusPositive;

  const sortedBills = [...(householdBills || [])].filter(b => b.isActive !== false).sort((a, b) => (a.dueDay || a.expectedDay || 0) - (b.dueDay || b.expectedDay || 0));
  const jointWarnings = (warnings || []).filter(w => w.accountKey === 'jointChecking');

  const handleTxSubmit = async ({ amountCents, category, description }) => {
    await logTransaction({ accountKey: 'jointChecking', amountCents, category, description });
    checkSpendingFloors();
  };

  const handleEditBalance = async (cents) => {
    await updateAccountBalance('jointChecking', cents);
    checkSpendingFloors();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 1. Header strip */}
      <View style={styles.headerStrip}>
        <Text style={styles.screenTitle}>HOUSEHOLD</Text>
        <Text style={styles.screenSubtitle}>Joint Accounts + Bills</Text>
      </View>

      {/* 2. Joint Checking card */}
      <Card>
        <Text style={styles.cardLabel}>JOINT CHECKING</Text>
        <Text style={styles.balanceText}>{formatCentsShort(accounts.jointChecking)}</Text>
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btnIncome} onPress={() => setTxType('income')}>
            <Text style={styles.btnText}>LOG INCOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnExpense} onPress={() => setTxType('expense')}>
            <Text style={styles.btnText}>LOG EXPENSE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnDim} onPress={() => setEditBalVisible(true)}>
            <Text style={styles.btnDimText}>EDIT BAL</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 3. Partner Deposit card */}
      <Card>
        <Text style={styles.cardLabel}>PARTNER DEPOSIT</Text>
        <Text style={styles.metaText}>Expected: {formatDate(expectedDepositDate.getTime())}</Text>
        {depositReceivedThisMonth ? (
          <Text style={[styles.metaText, { color: theme.statusPositive }]}>✓ Received this month</Text>
        ) : depositDatePast ? (
          <Text style={[styles.metaText, { color: theme.statusWarning }]}>⚠ Not yet received — date passed</Text>
        ) : (
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>Pending</Text>
        )}
        {!depositReceivedThisMonth && (
          <TouchableOpacity style={[styles.btnIncome, { marginTop: theme.spacingSM }]} onPress={() => setDepositVisible(true)}>
            <Text style={styles.btnText}>RECORD DEPOSIT</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* 4. Grocery Budget card */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardLabel}>GROCERY BUDGET</Text>
          <TouchableOpacity onPress={() => setLimitVisible(true)}>
            <Text style={styles.linkText}>SET LIMIT</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.metaText}>
          Weekly limit: {weeklyLimit > 0 ? formatCents(weeklyLimit) : 'Not set'}
        </Text>
        <Text style={styles.metaText}>
          This week: {formatCents(currentWeekSpend)}
          {weeklyLimit > 0 ? `  (${Math.floor(groceryPct * 100)}%)` : ''}
        </Text>
        {weeklyLimit > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.min(Math.floor(groceryPct * 100), 100)}%`, backgroundColor: groceryBarColor }]} />
          </View>
        )}
        <TouchableOpacity style={[styles.btnIncome, { marginTop: theme.spacingSM }]} onPress={() => setGroceryVisible(true)}>
          <Text style={styles.btnText}>LOG GROCERY SPEND</Text>
        </TouchableOpacity>
      </Card>

      {/* 5. Household Bills */}
      <Card>
        <Text style={styles.cardLabel}>HOUSEHOLD BILLS</Text>
        {sortedBills.length === 0 && (
          <Text style={[styles.metaText, { marginBottom: theme.spacingSM }]}>No bills added yet.</Text>
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
          <Text style={styles.addBillText}>+ ADD BILL</Text>
        </TouchableOpacity>
      </Card>

      {/* 6. Floor warnings */}
      {jointWarnings.length > 0 && (
        <View style={styles.warningCard}>
          {jointWarnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>
              ⚠ JOINT CHECKING below floor ({formatCents(w.floor)}) — current: {formatCents(w.balance)}
            </Text>
          ))}
        </View>
      )}

      {/* Modals */}
      <LogTransactionModal
        visible={txType !== null}
        type={txType}
        accountName="Joint Checking"
        onSubmit={handleTxSubmit}
        onClose={() => setTxType(null)}
      />
      <EditBalanceModal
        visible={editBalVisible}
        accountName="Joint Checking"
        onSubmit={handleEditBalance}
        onClose={() => setEditBalVisible(false)}
      />
      <DepositModal
        visible={depositVisible}
        expectedAmount={incomeEvents.partnerDepositAmount || 0}
        onSubmit={async (cents) => { await recordPartnerDeposit(cents); checkSpendingFloors(); }}
        onClose={() => setDepositVisible(false)}
      />
      <GrocerySpendModal
        visible={groceryVisible}
        onSubmit={async (cents) => { await logGrocerySpend(cents); checkSpendingFloors(); }}
        onClose={() => setGroceryVisible(false)}
      />
      <SetLimitModal
        visible={limitVisible}
        currentLimit={weeklyLimit}
        onSubmit={async (cents) => { await updateGroceryBudget({ weeklyLimitCents: cents }); }}
        onClose={() => setLimitVisible(false)}
      />
      <AddBillModal
        visible={addBillVisible}
        accountOptions={[{ key: 'jointChecking', label: 'JOINT CHECKING' }]}
        onSubmit={async (bill) => { await addHouseholdBill(bill); }}
        onClose={() => setAddBillVisible(false)}
      />
      <MarkPaidModal
        visible={markPaidBill !== null}
        bill={markPaidBill}
        accountOptions={[{ key: 'jointChecking', label: 'JOINT CHECKING' }]}
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
        accountOptions={[{ key: 'jointChecking', label: 'JOINT CHECKING' }]}
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacingXS,
  },
  balanceText: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingMD,
  },
  metaText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  linkText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  barTrack: {
    height: 6,
    backgroundColor: theme.backgroundPanel,
    borderRadius: 3,
    marginTop: theme.spacingXS,
    marginBottom: theme.spacingSM,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
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
