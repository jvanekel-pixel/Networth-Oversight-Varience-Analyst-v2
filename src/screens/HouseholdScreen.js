import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, parseBillInput } from '../utils/currency';
import { getPartnerDepositDate, formatDate, timeAgo } from '../utils/dates';
import { LogTransactionModal, EditBalanceModal, AddBillModal, MarkPaidModal, EditBillModal, EditTransactionModal } from '../components/TransactionModal';
import GroceryBudgetCard from '../components/GroceryBudgetCard';


function ordinalDay(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${day}${s[day % 10] || s[0]}`;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
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
  const userMode = useStore((s) => s.novaConfig?.userMode);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const isPartnered = userMode === 'partnered';
  const hasGroceriesBucket = (spendingBuckets || []).some((b) => b.isActive !== false && b.type === 'groceries');
  const householdAccount = (accountRegistry || []).find(a => a.isActive !== false && a.role === 'household');
  const householdAccountKey = householdAccount ? (householdAccount.legacyKey || householdAccount.id) : null;
  const householdAccountLabel = householdAccount ? (householdAccount.name || 'Shared Account') : 'Shared Account';
  const householdAccountOptions = householdAccount ? [{ key: householdAccountKey, label: householdAccountLabel.toUpperCase() }] : [];
  const {
    accounts,
    incomeEvents,
    householdBills,
    billOverrides,
    warnings,
    transactions,
    logTransaction,
    updateAccountBalance,
    recordPartnerDeposit,
    addHouseholdBill,
    markBillPaid,
    editBill,
    deleteBill,
    editTransaction,
    deleteTransaction,
    checkSpendingFloors,
  } = useStore();

  const [txType, setTxType] = useState(null);
  const [editBalVisible, setEditBalVisible] = useState(false);
  const [depositVisible, setDepositVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [activityMenuTx, setActivityMenuTx] = useState(null);
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

  const sortedBills = [...(householdBills || [])].filter(b => b.isActive !== false).sort((a, b) => (a.dueDay || a.expectedDay || 0) - (b.dueDay || b.expectedDay || 0));
  const jointWarnings = householdAccountKey
    ? (warnings || []).filter(w => w.accountKey === householdAccountKey)
    : [];

  const handleTxSubmit = async ({ amountCents, category, description }) => {
    if (!householdAccountKey) return;
    await logTransaction({ accountKey: householdAccountKey, amountCents, category, description });
    checkSpendingFloors();
  };

  const handleEditBalance = async (cents) => {
    if (!householdAccountKey) return;
    await updateAccountBalance(householdAccountKey, cents);
    checkSpendingFloors();
  };

  if (userMode && userMode !== 'partnered') {
    return (
      <View style={[styles.container, { padding: theme.spacingMD }]}>
        <View style={styles.card}>
          <Text style={[styles.cardLabel, { textAlign: 'center', marginBottom: theme.spacingSM }]}>HOUSEHOLD TRACKING UNAVAILABLE</Text>
          <Text style={[styles.metaText, { textAlign: 'center' }]}>Household tracking is for partnered mode. Enable it in Settings → Profile.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 1. Header strip */}
      <View style={styles.headerStrip}>
        <Text style={styles.screenTitle}>HOUSEHOLD</Text>
        <Text style={styles.screenSubtitle}>Joint Accounts + Bills</Text>
      </View>

      {/* 2. Shared account balance card */}
      <Card>
        {householdAccount ? (
          <>
            <Text style={styles.cardLabel}>{householdAccountLabel.toUpperCase()}</Text>
            <Text style={styles.balanceText}>{formatCentsShort(accounts[householdAccountKey] || 0)}</Text>
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
          </>
        ) : (
          <>
            <Text style={styles.cardLabel}>SHARED ACCOUNT</Text>
            <Text style={styles.balanceText}>—</Text>
            <Text style={[styles.metaText, { marginTop: theme.spacingSM }]}>Add a shared account in Settings.</Text>
          </>
        )}
      </Card>

      {/* 3. Partner Deposit card */}
      {isPartnered && (
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
      )}

      {/* 4. Grocery Budget card */}
      {isPartnered && hasGroceriesBucket && <GroceryBudgetCard />}

      {/* 5. Household Bills */}
      {isPartnered && <Card>
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
      </Card>}

      {/* 6. Recent Activity */}
      {isPartnered && (() => {
        const recentTx = [...(transactions || [])]
          .filter(t => !t.deleted && householdAccountKey && t.accountKey === householdAccountKey)
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
              const acctLabel = householdAccountLabel;
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

      {/* 7. Floor warnings */}
      {isPartnered && jointWarnings.length > 0 && (
        <View style={styles.warningCard}>
          {jointWarnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>
              ⚠ {householdAccountLabel.toUpperCase()} below floor ({formatCents(w.floor)}) — current: {formatCents(w.balance)}
            </Text>
          ))}
        </View>
      )}

      {/* Activity action menu */}
      <Modal visible={activityMenuTx !== null} transparent animationType="fade" onRequestClose={() => setActivityMenuTx(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActivityMenuTx(null)}>
          <View style={styles.modalPanel}>
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modals */}
      <LogTransactionModal
        visible={txType !== null}
        type={txType}
        accountName={householdAccountLabel}
        onSubmit={handleTxSubmit}
        onClose={() => setTxType(null)}
      />
      <EditBalanceModal
        visible={editBalVisible}
        accountName={householdAccountLabel}
        onSubmit={handleEditBalance}
        onClose={() => setEditBalVisible(false)}
      />
      <DepositModal
        visible={depositVisible}
        expectedAmount={incomeEvents.partnerDepositAmount || 0}
        onSubmit={async (cents) => { await recordPartnerDeposit(cents); checkSpendingFloors(); }}
        onClose={() => setDepositVisible(false)}
      />
      <AddBillModal
        visible={addBillVisible}
        accountOptions={householdAccountOptions}
        onSubmit={async (bill) => { await addHouseholdBill(bill); }}
        onClose={() => setAddBillVisible(false)}
      />
      <MarkPaidModal
        visible={markPaidBill !== null}
        bill={markPaidBill}
        accountOptions={householdAccountOptions}
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
        accountOptions={householdAccountOptions}
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
    marginBottom: theme.spacingMD,
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
