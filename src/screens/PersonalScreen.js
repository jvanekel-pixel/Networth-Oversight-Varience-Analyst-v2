import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, parseCentsInput, parseBillInput } from '../utils/currency';
import { formatDate, timeAgo } from '../utils/dates';
import { LogTransactionModal, EditBalanceModal, AddBillModal, MarkPaidModal, EditBillModal, EditTransactionModal } from '../components/TransactionModal';
import LogMassageIncomeModal from '../components/modals/LogMassageIncomeModal';

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
    transactions,
    massageIncome,
    logTransaction,
    updateAccountBalance,
    distributePaycheck,
    addPersonalBill,
    markBillPaid,
    editBill,
    deleteBill,
    editTransaction,
    deleteTransaction,
    editMassageIncome,
    deleteMassageIncome,
    checkSpendingFloors,
  } = useStore();
  const personalVariance = useStore((s) => s.varianceCache.personal);

  // Single modal state: { accountKey, modalType } — null means closed
  const [activeModal, setActiveModal] = useState({ accountKey: null, modalType: null });
  const [paycheckVisible, setPaycheckVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [activityMenuTx, setActivityMenuTx] = useState(null);
  const [editingMassageIncome, setEditingMassageIncome] = useState(null);

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

      {/* 1b. Personal variance card */}
      {personalVariance && (() => {
        const pv = personalVariance;
        const borderColor = pv.state === 'green' ? theme.statusPositive : pv.state === 'yellow' ? theme.statusWarning : pv.state === 'red' ? theme.statusDanger : theme.borderColorDim;
        const bgColor = pv.state === 'green' ? theme.statusPositiveBg : pv.state === 'yellow' ? theme.statusWarningBg : pv.state === 'red' ? theme.statusDangerBg : theme.backgroundCard;
        const varSign = pv.variance > 0 ? '+' : '';
        const varColor = pv.variance > 0 ? theme.statusPositive : pv.variance < 0 ? theme.statusDanger : theme.textSecondary;
        return (
          <View style={[styles.varianceCard, { borderColor, backgroundColor: bgColor }]}>
            <Text style={styles.varianceLabel}>PERSONAL VARIANCE</Text>
            <Text style={styles.varianceBalance}>{formatCentsShort(pv.balance)}</Text>
            <Text style={[styles.varianceAmt, { color: varColor }]}>{varSign}{formatCentsShort(pv.variance)}</Text>
            <Text style={styles.varianceAnnotation}>{pv.annotation}</Text>
          </View>
        );
      })()}

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

      {/* 4. Recent Activity */}
      {(() => {
        const personalAccts = ['entChecking', 'entSavings', 'venmo', 'cash'];
        const recentTx = [...(transactions || [])]
          .filter(t => !t.deleted && personalAccts.includes(t.accountKey))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 10);
        return (
          <View style={styles.activitySection}>
            <Text style={styles.activityHeader}>RECENT ACTIVITY</Text>
            {recentTx.length === 0 && (
              <Text style={styles.metaText}>No transactions yet.</Text>
            )}
            {recentTx.map(tx => {
              const isPositive = tx.amountCents > 0;
              const desc = (tx.description || '').slice(0, 30);
              const acctLabel = ACCOUNT_LABELS[tx.accountKey] || tx.accountKey;
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.activityRow}
                  onLongPress={() => setActivityMenuTx(tx)}
                  delayLongPress={400}
                >
                  <Text style={[styles.activityAmt, { color: isPositive ? theme.statusPositive : theme.textPrimary }]}>
                    {isPositive ? '+' : ''}{formatCentsShort(tx.amountCents)}
                  </Text>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityDesc} numberOfLines={1}>{desc}</Text>
                    <Text style={styles.activityMeta}>{acctLabel} · {timeAgo(tx.timestamp)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })()}

      {/* Activity action menu */}
      <Modal visible={activityMenuTx !== null} transparent animationType="fade" onRequestClose={() => setActivityMenuTx(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActivityMenuTx(null)}>
          <View style={styles.modalPanel}>
            {activityMenuTx?.source === 'massage' ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  const sourceEntry = (massageIncome || []).find(r => r.id === activityMenuTx.sourceId && !r.deleted);
                  setActivityMenuTx(null);
                  if (sourceEntry) setEditingMassageIncome(sourceEntry);
                }}>
                  <Text style={styles.menuItemText}>EDIT MASSAGE INCOME</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  const sourceId = activityMenuTx.sourceId;
                  setActivityMenuTx(null);
                  Alert.alert(
                    'Delete Massage Income?',
                    'This will reverse the balance from the destination account.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteMassageIncome(sourceId) },
                    ]
                  );
                }}>
                  <Text style={[styles.menuItemText, { color: theme.statusDanger }]}>DELETE MASSAGE INCOME</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setEditingTx(activityMenuTx); setActivityMenuTx(null); }}>
                  <Text style={styles.menuItemText}>EDIT TRANSACTION</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  const tx = activityMenuTx;
                  setActivityMenuTx(null);
                  Alert.alert(
                    'Delete Transaction',
                    'Delete this transaction? Account balance will be adjusted.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(tx.id) },
                    ]
                  );
                }}>
                  <Text style={[styles.menuItemText, { color: theme.statusDanger }]}>DELETE TRANSACTION</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 5. Floor warnings */}
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
        onDelete={() => { deleteBill(editingBill.id); setEditingBill(null); }}
        onClose={() => setEditingBill(null)}
      />
      <EditTransactionModal
        visible={editingTx !== null}
        transaction={editingTx}
        onSubmit={async (updates) => { await editTransaction(editingTx.id, updates); setEditingTx(null); }}
        onClose={() => setEditingTx(null)}
      />
      <LogMassageIncomeModal
        visible={editingMassageIncome !== null}
        entry={editingMassageIncome}
        onClose={() => setEditingMassageIncome(null)}
        onConfirm={(record) => { if (editingMassageIncome) { editMassageIncome(editingMassageIncome.id, record); setEditingMassageIncome(null); } }}
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
    paddingVertical: theme.spacingMD,
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
  activitySection: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
    marginTop: theme.spacingMD,
  },
  activityHeader: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingSM,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacingXS,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  activityAmt: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    width: 80,
  },
  activityInfo: {
    flex: 1,
  },
  activityDesc: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  activityMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 1,
  },
  menuItem: {
    paddingVertical: theme.spacingMD,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  menuItemText: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
  },
  // Modal styles
  backdrop: {
    flex: 1,
    backgroundColor: theme.overlayBg,
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
  varianceCard: {
    padding: theme.spacingLG,
    borderRadius: theme.radiusLG,
    borderWidth: 2,
    marginBottom: theme.spacingMD,
  },
  varianceLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  varianceBalance: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  varianceAmt: {
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    marginBottom: 2,
  },
  varianceAnnotation: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
});
