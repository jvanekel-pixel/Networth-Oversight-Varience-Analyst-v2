import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, formatCentsWholeFloor, parseCentsInput, parseBillInput } from '../utils/currency';
import { formatDate, timeAgo } from '../utils/dates';
import { LogTransactionModal, EditBalanceModal, TransferModal, AddBillModal, MarkPaidModal, EditBillModal, EditTransactionModal } from '../components/TransactionModal';
import GroceryBudgetCard from '../components/GroceryBudgetCard';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import CardOrderSheet from '../components/settings/CardOrderSheet';
import CardOrderLink from '../components/settings/CardOrderLink';
import SpendingChartsSection from '../components/SpendingChartsSection';
import SpendingCategoryManagerCard from '../components/SpendingCategoryManagerCard';
import ReceiptAttachmentsCard, { TransactionReceiptModal } from '../components/ReceiptAttachmentsCard';
import RecurringTransactionsCard from '../components/RecurringTransactionsCard';
import { SAVINGS_GOALS_CARD_ID, savingsGoalsForScope } from '../utils/savingsGoals';
import { RECURRING_TRANSACTIONS_CARD_ID } from '../utils/recurringTransactions';
import CashFlowForecastCard from '../components/CashFlowForecastCard';
import TourCueCard from '../components/TourCueCard';
import { CASH_FLOW_FORECAST_CARD_ID } from '../utils/forecasting';
import { submitTransactionPayload } from '../utils/splitTransactions';

function ordinalDay(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${day}${s[day % 10] || s[0]}`;
}

function scheduledItemLabel(item) {
  return String(item?.billType || item?.kind || '').toLowerCase().includes('subscription')
    ? 'Subscription'
    : 'Bill';
}

function billAutoPostEnabled(bill) {
  if (!(bill?.amountType === 'static' || bill?.isStaticAmount === true)) return false;
  if (bill?.autoPostEnabled !== undefined) return bill.autoPostEnabled === true;
  if (bill?.isAutoPost !== undefined) return bill.isAutoPost === true;
  if (bill?.isAutoDraft !== undefined) return bill.isAutoDraft !== false;
  return true;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const searchCopy = personality.transactionSearch;

function PaycheckModal({ visible, splits, paydayStreak, onSubmit, onClose }) {
  const [splitRaws, setSplitRaws] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && splits?.length) {
      setSplitRaws(splits.map(s => (s.amountCents / 100).toFixed(2)));
    }
    if (!visible) {
      setSplitRaws([]);
      setIsSubmitting(false);
    }
  }, [visible]);

  const handleClose = () => { setSplitRaws([]); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const overrides = (splits || []).map((s, i) => ({
      ...s,
      amountCents: parseBillInput(splitRaws[i] ?? '') || 0,
    }));
    const grossCents = overrides.reduce((sum, s) => sum + s.amountCents, 0);
    await onSubmit(grossCents, overrides);
    setSplitRaws([]); setIsSubmitting(false); onClose();
  };

  const totalCents = splitRaws.reduce((sum, r) => sum + (parseBillInput(r) || 0), 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>CONFIRM DEPOSIT AMOUNTS</Text>
          <Text style={styles.modalSub}>Adjust if needed (OT, garnishment, etc.)</Text>
          <Text style={styles.modalStreak}>
            Payday streak: {paydayStreak?.current || 0} confirmed / {paydayStreak?.consecutiveOnTime || 0} on time
          </Text>
          {(splits || []).map((split, i) => (
            <View key={split.id} style={styles.splitRow}>
              <Text style={styles.splitLabel}>{split.label}</Text>
              <TextInput
                style={styles.splitInput}
                keyboardType="decimal-pad"
                value={splitRaws[i] ?? ''}
                onChangeText={raw => {
                  const updated = [...splitRaws];
                  updated[i] = raw;
                  setSplitRaws(updated);
                }}
                placeholderTextColor={theme.textDim}
                placeholder="0.00"
              />
            </View>
          ))}
          <View style={styles.splitTotalRow}>
            <Text style={styles.splitTotalLabel}>Total</Text>
            <Text style={styles.splitTotalAmt}>{formatCentsShort(totalCents)}</Text>
          </View>
          <TouchableOpacity style={[styles.modalSubmit, isSubmitting && styles.btnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.modalSubmitText}>CONFIRM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AccountCard({ account, balance, floorCents, onIncome, onExpense, onTransfer, onEditBal }) {
  return (
    <Card>
      <Text style={styles.cardLabel}>{(account.name || account.id).toUpperCase()}</Text>
      <Text style={styles.balanceText}>{formatCentsWholeFloor(balance)}</Text>
      {floorCents > 0 && (
        <Text style={styles.floorText}>Floor: {formatCents(floorCents)}</Text>
      )}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnIncome} onPress={onIncome}>
          <Text style={styles.btnText}>LOG INCOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnExpense} onPress={onExpense}>
          <Text style={styles.btnText}>LOG EXPENSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDim} onPress={onTransfer}>
          <Text style={styles.btnDimText}>TRANSFER</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDim} onPress={onEditBal}>
          <Text style={styles.btnDimText}>EDIT BAL</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function PayCycleSummaryCard({ incomeEvents, paycheckSplits, accountRegistry, paydayStreak, onRecordPaycheck }) {
  const nextDate = incomeEvents?.nextPaycheckDate;
  const isEmpty = !paycheckSplits || paycheckSplits.length === 0;
  return (
    <Card>
      <Text style={styles.cardLabel}>INCOME CYCLE</Text>
      <Text style={styles.metaText}>
        Next income: {nextDate ? formatDate(nextDate) : 'Not set'}
      </Text>
      <View style={styles.paydayStreakRow}>
        <Text style={styles.paydayStreakLabel}>PAYDAY STREAK</Text>
        <Text style={styles.paydayStreakValue}>
          {paydayStreak?.current || 0} confirmed / {paydayStreak?.consecutiveOnTime || 0} on time
        </Text>
      </View>
      {isEmpty ? (
        <Text style={[styles.metaText, { color: theme.textDim, marginTop: 4 }]}>
          Income split not configured - set up in Settings.
        </Text>
      ) : (
        <View style={styles.distPreview}>
          <Text style={styles.distLabel}>Next distribution:</Text>
          {paycheckSplits.map((split) => {
            const acctId = split.accountId || split.accountKey;
            const acct = (accountRegistry || []).find(a => (a.legacyKey || a.id) === acctId || a.id === acctId);
            const label = acct ? (acct.name || acct.id) : (split.label || acctId || 'Unknown');
            return (
              <Text key={split.id} style={styles.distLine}>
                {formatCents(split.amountCents)} → {label}
              </Text>
            );
          })}
        </View>
      )}
      {!isEmpty && (
        <TouchableOpacity style={[styles.btnIncome, { marginTop: theme.spacingSM }]} onPress={onRecordPaycheck}>
          <Text style={styles.btnText}>RECORD INCOME</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

export default function PersonalScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    accounts,
    accountFloors,
    incomeEvents,
    personalBills,
    billOverrides,
    warnings,
    transactions,
    postPaydayActions,
    streakData,
    novaConfig,
    accountRegistry,
    personalCardOrder,
    personalHiddenCards,
    updatePersonalCardOrder,
    updatePersonalHiddenCards,
    logTransaction,
    updateAccountBalance,
    distributePaycheck,
    addPersonalBill,
    markBillPaid,
    editBill,
    deleteBill,
    editTransaction,
    deleteTransaction,
    transferBetweenAccounts,
    completePostPaydayAction,
    checkSpendingFloors,
  } = useStore();
  const personalVariance = useStore((s) => s.varianceCache.personal);

  const personalAccounts = (accountRegistry || []).filter(a => a.isActive !== false && a.role === 'personal');
  const personalAccountKeys = personalAccounts.map(a => a.legacyKey || a.id);
  const getAccountName = (key) => {
    const acct = personalAccounts.find(a => (a.legacyKey || a.id) === key);
    return acct ? (acct.name || acct.id) : key;
  };
  const getAccountObj = (key) => personalAccounts.find(a => (a.legacyKey || a.id) === key);
  const personalAccountOptions = personalAccounts.map(a => ({
    key: a.legacyKey || a.id,
    label: (a.name || a.id).toUpperCase(),
  }));

  // Single modal state: { accountKey, modalType } — null means closed
  const [activeModal, setActiveModal] = useState({ accountKey: null, modalType: null });
  const [paycheckVisible, setPaycheckVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);
  const [activityMenuTx, setActivityMenuTx] = useState(null);
  const [cardOrderVisible, setCardOrderVisible] = useState(false);

  const handleDeleteBill = (billId) => {
    Alert.alert('Delete Scheduled Item', 'Remove this bill or subscription?', [
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

  const personalWarnings = (warnings || []).filter(w => personalAccountKeys.includes(w.accountKey));

  const sortedBills = [...(personalBills || [])].filter(b => b.isActive !== false).sort((a, b) => (a.dueDay || a.expectedDay || 0) - (b.dueDay || b.expectedDay || 0));

  const handleTxSubmit = async (payload) => {
    const { accountKey } = activeModal;
    const result = await submitTransactionPayload(logTransaction, payload, accountKey);
    checkSpendingFloors();
    return result;
  };

  const handleEditBalance = async (cents) => {
    const { accountKey } = activeModal;
    await updateAccountBalance(accountKey, cents);
    checkSpendingFloors();
  };

  const handleTransfer = async (transfer) => {
    await transferBetweenAccounts(transfer);
    checkSpendingFloors();
  };

  const handlePaycheck = async (grossCents, splitOverrides) => {
    await distributePaycheck(grossCents, splitOverrides);
    checkSpendingFloors();
  };

  const { paycheckAmountCents = 0, nextPaycheckDate = null } = incomeEvents;

  const actionsNow = Date.now();
  const pendingActions = (postPaydayActions || []).filter(a => !a.completed && actionsNow < a.expiresAt);
  const personalSavingsGoals = savingsGoalsForScope(novaConfig?.savingsGoals, 'personal');
  const activeCardIds = [
    'variance',
    CASH_FLOW_FORECAST_CARD_ID,
    'spending_chart',
    'spending_categories',
    'accounts',
    'pay_cycle',
    RECURRING_TRANSACTIONS_CARD_ID,
    SAVINGS_GOALS_CARD_ID,
    'bills',
    'grocery',
    'receipt_attachments',
    'recent_activity',
  ];
  const personalDisplayCards = [
    { id: 'variance', label: 'Variance Summary' },
    { id: CASH_FLOW_FORECAST_CARD_ID, label: 'Cash-Flow Forecast' },
    { id: 'spending_chart', label: 'Spending Chart' },
    { id: 'spending_categories', label: 'Spending Categories' },
    { id: 'accounts', label: 'Account Balances' },
    { id: 'pay_cycle', label: 'Pay Cycle' },
    { id: RECURRING_TRANSACTIONS_CARD_ID, label: 'Recurring Items' },
    { id: SAVINGS_GOALS_CARD_ID, label: 'Savings Goals' },
    { id: 'bills', label: 'Bills & Subscriptions' },
    { id: 'grocery', label: 'Grocery Spending' },
    { id: 'receipt_attachments', label: 'Receipt Photos' },
    { id: 'recent_activity', label: 'Recent Activity' },
  ];
  const orderedPersonalCards = [
    ...(personalCardOrder || []).filter((id) => activeCardIds.includes(id)),
    ...activeCardIds.filter((id) => !(personalCardOrder || []).includes(id)),
  ];

  const renderRecentActivityCard = () => {
    const recentTx = [...(transactions || [])]
      .filter(t => !t.deleted && personalAccountKeys.includes(t.accountKey))
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
          const acctLabel = getAccountName(tx.accountKey);
          return (
            <TouchableOpacity
              key={tx.id}
              style={styles.activityRow}
              onPress={() => setReceiptTx(tx)}
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
  };

  const renderBillsCard = () => (
    <Card>
      <Text style={styles.cardLabel}>SCHEDULED BILLS & SUBSCRIPTIONS</Text>
      {sortedBills.length === 0 && (
        <Text style={[styles.metaText, { marginBottom: theme.spacingSM }]}>No subscriptions added yet.</Text>
      )}
      {sortedBills.map(bill => {
        const paidRecord = billOverrides[bill.id] || {};
        const paidThisMonth = paidRecord.lastPaidMonth === currentMonth || bill.lastPaidMonth === currentMonth;
        const isStatic = bill.amountType === 'static' || bill.isStaticAmount === true;
        const autoPost = billAutoPostEnabled(bill);
        const paidLabel = paidRecord.autoPosted || bill.lastPaidSource === 'auto_static' ? 'AUTO-POSTED' : 'PAID';
        return (
          <View key={bill.id} style={styles.billRow}>
            <View style={styles.billInfo}>
              <Text style={styles.billName}>{bill.name}</Text>
              <Text style={styles.billMeta}>{scheduledItemLabel(bill)} - {formatCents(bill.amountCents)} - Due {ordinalDay(bill.dueDay || bill.expectedDay)} - {(() => {
                const key = bill.defaultAccountKey;
                if (!key) return 'Unassigned';
                const found = personalAccounts.find(a => (a.legacyKey || a.id) === key);
                return found ? (found.name || found.id) : 'Unassigned';
              })()}</Text>
              <Text style={styles.billMeta}>{isStatic ? `Fixed amount - ${autoPost ? 'Auto-Post on' : 'manual confirmation'}` : 'Variable amount - manual confirmation'}</Text>
            </View>
            <View style={styles.billActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditingBill(bill)}>
                <Text style={styles.editBtnText}>EDIT</Text>
              </TouchableOpacity>
              {paidThisMonth && (
                <Text style={[styles.paidLabel, { marginLeft: theme.spacingXS }]}>{paidLabel}</Text>
              )}
              <TouchableOpacity style={[styles.markPaidBtn, { marginLeft: theme.spacingXS }]} onPress={() => setMarkPaidBill(bill)}>
                <Text style={styles.markPaidText}>MARK PAID</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={styles.addBillBtn} onPress={() => setAddBillVisible(true)}>
        <Text style={styles.addBillText}>+ ADD BILL / SUBSCRIPTION</Text>
      </TouchableOpacity>
    </Card>
  );

  const renderPersonalCard = (id) => {
    if (id === 'variance') {
      if (!personalVariance) return null;
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
    }
    if (id === CASH_FLOW_FORECAST_CARD_ID) return <CashFlowForecastCard profile="personal" title="PERSONAL CASH-FLOW FORECAST" />;
    if (id === 'spending_chart') return <SpendingChartsSection profile="personal" />;
    if (id === 'spending_categories') return <SpendingCategoryManagerCard profile="personal" />;
    if (id === 'accounts') {
      return (
        <>
          {personalAccounts.length === 0 && (
            <Card>
              <Text style={styles.cardLabel}>NO ACCOUNTS</Text>
              <Text style={styles.metaText}>No personal accounts configured. Add one in Settings.</Text>
            </Card>
          )}
          {personalAccounts.map(acct => {
            const key = acct.legacyKey || acct.id;
            return (
              <AccountCard
                key={acct.id}
                account={acct}
                balance={accounts[key] || 0}
                floorCents={getFloor(key)}
                onIncome={() => setActiveModal({ accountKey: key, modalType: 'income' })}
                onExpense={() => setActiveModal({ accountKey: key, modalType: 'expense' })}
                onTransfer={() => setActiveModal({ accountKey: key, modalType: 'transfer' })}
                onEditBal={() => setActiveModal({ accountKey: key, modalType: 'edit' })}
              />
            );
          })}
        </>
      );
    }
    if (id === 'pay_cycle') {
      return (
        <PayCycleSummaryCard
          incomeEvents={incomeEvents}
          paycheckSplits={novaConfig?.paycheckSplits}
          accountRegistry={accountRegistry}
          paydayStreak={streakData?.paydayStreak}
          onRecordPaycheck={() => setPaycheckVisible(true)}
        />
      );
    }
    if (id === SAVINGS_GOALS_CARD_ID) {
      return (
        <SavingsGoalsCard
          goals={personalSavingsGoals}
          accounts={accounts}
          accountRegistry={accountRegistry}
          scope="personal"
          title="SAVINGS GOALS"
        />
      );
    }
    if (id === RECURRING_TRANSACTIONS_CARD_ID) {
      return (
        <RecurringTransactionsCard
          scope="personal"
          accountOptions={personalAccountOptions}
          title="RECURRING ITEMS"
        />
      );
    }
    if (id === 'bills') return renderBillsCard();
    if (id === 'grocery') return <GroceryBudgetCard profile="personal" />;
    if (id === 'receipt_attachments') {
      return (
        <ReceiptAttachmentsCard
          title="RECEIPT PHOTOS"
          transactions={(transactions || []).filter(t => personalAccountKeys.includes(t.accountKey))}
          getAccountLabel={(tx) => getAccountName(tx.accountKey)}
        />
      );
    }
    if (id === 'recent_activity') return renderRecentActivityCard();
    return null;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >

      {/* Post-Income Actions */}
      {pendingActions.length > 0 && (
        <View style={styles.postPaydayCard}>
          <Text style={styles.postPaydayHeader}>POST-INCOME ACTIONS</Text>
          {pendingActions.map(action => (
            <View key={action.id} style={styles.postPaydayRow}>
              <Text style={styles.postPaydayLabel}>{action.label}</Text>
              <TouchableOpacity style={styles.postPaydayBtn} onPress={() => completePostPaydayAction(action.id)}>
                <Text style={styles.postPaydayBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 1. Header strip */}
      <View style={styles.headerStrip}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>PERSONAL</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => navigation?.navigate('TransactionSearch', { initialFilters: { accountKeys: personalAccountKeys } })}
            >
              <Text style={styles.searchBtnText}>{searchCopy.searchIcon}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => navigation?.navigate('Calendar', { mode: 'personal' })}
            >
              <Text style={styles.calendarBtnText}>VIEW CALENDAR</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.screenSubtitle}>Personal Accounts + Pay Cycle</Text>
      </View>

      <TourCueCard
        cueId="personal_tools"
        title="Your personal math lives here."
        body="Log income or expenses, move numbers between accounts, confirm deposits, watch the forecast, set goals, manage grocery tracking, and reorder cards when the default layout becomes annoying."
        actionLabel="VIEW CALENDAR"
        onAction={() => navigation?.navigate('Calendar', { mode: 'personal' })}
      />

      {/* Floor warnings */}
      {personalWarnings.length > 0 && (
        <View style={styles.warningCard}>
          {personalWarnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>
              ⚠ {getAccountName(w.accountKey).toUpperCase()} below floor ({formatCents(w.floor)}) - current: {formatCents(w.balance)}
            </Text>
          ))}
        </View>
      )}

      {orderedPersonalCards
        .filter((id) => !(personalHiddenCards || []).includes(id))
        .map((id) => (
          <React.Fragment key={id}>
            {renderPersonalCard(id)}
          </React.Fragment>
        ))}

      <CardOrderLink onPress={() => setCardOrderVisible(true)} />

      {/* Activity action menu */}
      <Modal visible={activityMenuTx !== null} transparent animationType="fade" onRequestClose={() => setActivityMenuTx(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActivityMenuTx(null)}>
          <View style={styles.modalPanel}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setReceiptTx(activityMenuTx); setActivityMenuTx(null); }}>
              <Text style={styles.menuItemText}>VIEW / ADD RECEIPT</Text>
            </TouchableOpacity>
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
        visible={activeModal.modalType === 'income' || activeModal.modalType === 'expense'}
        type={activeModal.modalType}
        accountName={getAccountName(activeModal.accountKey)}
        profile="personal"
        defaultAccountKey={activeModal.accountKey}
        accountOptions={personalAccountOptions}
        onSubmit={handleTxSubmit}
        onClose={closeModal}
      />
      <EditBalanceModal
        visible={activeModal.modalType === 'edit'}
        accountName={getAccountName(activeModal.accountKey)}
        currentBalanceCents={accounts[activeModal.accountKey] || 0}
        onSubmit={handleEditBalance}
        onClose={closeModal}
      />
      <TransferModal
        visible={activeModal.modalType === 'transfer'}
        fromAccountKey={activeModal.accountKey}
        accountOptions={personalAccountOptions}
        profile="personal"
        onSubmit={handleTransfer}
        onClose={closeModal}
      />
      <PaycheckModal
        visible={paycheckVisible}
        splits={novaConfig?.paycheckSplits}
        paydayStreak={streakData?.paydayStreak}
        onSubmit={handlePaycheck}
        onClose={() => setPaycheckVisible(false)}
      />
      <AddBillModal
        visible={addBillVisible}
        accountOptions={personalAccountOptions}
        profile="personal"
        onSubmit={async (bill) => { await addPersonalBill(bill); }}
        onClose={() => setAddBillVisible(false)}
      />
      <MarkPaidModal
        visible={markPaidBill !== null}
        bill={markPaidBill}
        accountOptions={personalAccountOptions}
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
        accountOptions={personalAccountOptions}
        profile="personal"
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
        profile="personal"
        accountOptions={personalAccountOptions}
        onSubmit={async (updates) => { await editTransaction(editingTx.id, updates); setEditingTx(null); }}
        onClose={() => setEditingTx(null)}
      />
      <TransactionReceiptModal
        visible={receiptTx !== null}
        transaction={receiptTx}
        onClose={() => setReceiptTx(null)}
      />
      <CardOrderSheet
        visible={cardOrderVisible}
        title="PERSONAL CARD ORDER"
        cards={personalDisplayCards}
        currentOrder={personalCardOrder}
        currentHidden={personalHiddenCards}
        onSave={async (order, hidden) => {
          await updatePersonalCardOrder(order);
          await updatePersonalHiddenCards(hidden);
        }}
        onClose={() => setCardOrderVisible(false)}
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
    paddingHorizontal: theme.spacingMD,
  },
  headerStrip: {
    marginBottom: theme.spacingMD,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
  },
  searchBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.accentGlow,
  },
  searchBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  calendarBtn: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    backgroundColor: theme.backgroundCard,
  },
  calendarBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  screenTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    flexShrink: 1,
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
  paydayStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  paydayStreakLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    letterSpacing: 1,
  },
  paydayStreakValue: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
    textAlign: 'right',
    flexShrink: 1,
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
  modalStreak: {
    color: theme.accent,
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
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacingXS },
  splitLabel: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, flex: 1 },
  splitInput: { backgroundColor: theme.backgroundCard, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, width: 90, textAlign: 'right' },
  splitTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.borderColorDim, paddingTop: theme.spacingSM, marginTop: theme.spacingXS, marginBottom: theme.spacingMD },
  splitTotalLabel: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
  splitTotalAmt: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  postPaydayCard: {
    backgroundColor: theme.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.statusWarning,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  postPaydayHeader: {
    color: theme.statusWarning,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingSM,
  },
  postPaydayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacingXS,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,215,0,0.15)',
  },
  postPaydayLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    flex: 1,
  },
  postPaydayBtn: {
    borderWidth: 1,
    borderColor: theme.statusWarning,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    marginLeft: theme.spacingSM,
  },
  postPaydayBtnText: {
    color: theme.statusWarning,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
});
