import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePickerField from '../components/DatePickerField';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, formatCentsWholeFloor, parseBillInput } from '../utils/currency';
import { timeAgo } from '../utils/dates';
import { LogTransactionModal, EditBalanceModal, TransferModal, AddBillModal, MarkPaidModal, EditBillModal, EditTransactionModal } from '../components/TransactionModal';
import GroceryBudgetCard from '../components/GroceryBudgetCard';
import CardOrderSheet from '../components/settings/CardOrderSheet';
import CardOrderLink from '../components/settings/CardOrderLink';
import SpendingChartsSection from '../components/SpendingChartsSection';
import SpendingCategoryManagerCard from '../components/SpendingCategoryManagerCard';
import ReceiptAttachmentsCard, { TransactionReceiptModal } from '../components/ReceiptAttachmentsCard';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import { SAVINGS_GOALS_CARD_ID, savingsGoalsForScope } from '../utils/savingsGoals';
import CashFlowForecastCard from '../components/CashFlowForecastCard';
import TourCueCard from '../components/TourCueCard';
import { CASH_FLOW_FORECAST_CARD_ID } from '../utils/forecasting';
import { submitTransactionPayload } from '../utils/splitTransactions';


function ordinalDay(day) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${day}${s[day % 10] || s[0]}`;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
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

const searchCopy = personality.transactionSearch;
const INCOME_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'unscheduled'];

function localDateInput(ms = Date.now()) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return localDateInput(Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultIncomeDateInput() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return localDateInput(d.getTime());
}

function parseDateInput(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const ms = new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function ScheduledIncomeEditorModal({
  visible,
  event,
  accountOptions,
  onSave,
  onRemove,
  onClose,
}) {
  const firstAccountKey = accountOptions[0]?.key || '';
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDate, setNextDate] = useState(defaultIncomeDateInput());
  const [accountKey, setAccountKey] = useState(firstAccountKey);

  useEffect(() => {
    if (!visible) return;
    setLabel(event?.label || '');
    setAmount(event?.amountCents > 0 ? (event.amountCents / 100).toFixed(2) : '');
    setFrequency(event?.frequency || 'monthly');
    setNextDate(event?.nextDate ? localDateInput(event.nextDate) : defaultIncomeDateInput());
    setAccountKey(event?.accountKey || firstAccountKey);
  }, [visible, event?.id, firstAccountKey]);

  const handleSave = async () => {
    const amountCents = parseBillInput(amount);
    const parsedDate = parseDateInput(nextDate);
    const cleanLabel = label.trim();
    if (!cleanLabel || amountCents <= 0 || !parsedDate) {
      Alert.alert('Missing Details', 'Add a label, amount, and next date for this scheduled income.');
      return;
    }
    const d = new Date(parsedDate);
    await onSave({
      id: event?.id,
      label: cleanLabel,
      amountCents,
      frequency,
      nextDate: parsedDate,
      dayOfMonth: d.getDate(),
      accountKey: accountKey || firstAccountKey || null,
      role: 'household',
      isActive: true,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.incomeModalPanel}>
          <Text style={styles.incomeModalTitle}>{event ? 'EDIT SCHEDULED INCOME' : 'ADD SCHEDULED INCOME'}</Text>
          <Text style={styles.modalHint}>Shared-account inflow belongs here so Household forecasts start with the full signal.</Text>

          <Text style={styles.inputLabel}>LABEL</Text>
          <TextInput
            style={styles.incomeModalInput}
            value={label}
            onChangeText={setLabel}
            placeholder="Shared deposit, contribution, rental income"
            placeholderTextColor={theme.textDim}
          />
          <Text style={styles.inputLabel}>AMOUNT</Text>
          <TextInput
            style={styles.incomeModalInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
          />
          <DatePickerField label="NEXT DATE" value={nextDate} onChange={setNextDate} />

          <Text style={styles.inputLabel}>FREQUENCY</Text>
          <View style={styles.modalChipRow}>
            {INCOME_FREQUENCIES.map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.modalChip, frequency === option && styles.modalChipActive]}
                onPress={() => setFrequency(option)}
              >
                <Text style={[styles.modalChipText, frequency === option && styles.modalChipTextActive]}>
                  {option.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {accountOptions.length > 0 && (
            <>
              <Text style={styles.inputLabel}>DESTINATION</Text>
              <View style={styles.modalChipRow}>
                {accountOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.modalChip, accountKey === option.key && styles.modalChipActive]}
                    onPress={() => setAccountKey(option.key)}
                  >
                    <Text style={[styles.modalChipText, accountKey === option.key && styles.modalChipTextActive]}>
                      {String(option.label || option.key).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={onClose}>
              <Text style={styles.modalGhostText}>CANCEL</Text>
            </TouchableOpacity>
            {event && (
              <TouchableOpacity
                style={styles.modalDangerBtn}
                onPress={() => {
                  onRemove(event);
                  onClose();
                }}
              >
                <Text style={styles.modalDangerText}>REMOVE</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
              <Text style={styles.modalSaveText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HouseholdScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const novaConfig = useStore((s) => s.novaConfig);
  const userMode = novaConfig?.userMode;
  const accountRegistry = useStore((s) => s.accountRegistry);
  const householdCardOrder = useStore((s) => s.householdCardOrder);
  const householdHiddenCards = useStore((s) => s.householdHiddenCards);
  const householdVariance = useStore((s) => s.varianceCache.household);
  const updateHouseholdCardOrder = useStore((s) => s.updateHouseholdCardOrder);
  const updateHouseholdHiddenCards = useStore((s) => s.updateHouseholdHiddenCards);
  const isPartnered = userMode === 'partnered';
  const householdAccounts = (accountRegistry || []).filter(a => a.isActive !== false && a.role === 'household');
  const householdAccount = householdAccounts[0] || null;
  const householdAccountKey = householdAccount ? (householdAccount.legacyKey || householdAccount.id) : null;
  const householdAccountKeys = householdAccounts.map(a => a.legacyKey || a.id).filter(Boolean);
  const householdAccountLabel = householdAccount ? (householdAccount.name || 'Shared Account') : 'Shared Account';
  const householdAccountOptions = householdAccounts.map(account => ({
    key: account.legacyKey || account.id,
    label: String(account.name || account.id).toUpperCase(),
  }));
  const {
    accounts,
    incomeEvents,
    householdBills,
    billOverrides,
    warnings,
    transactions,
    logTransaction,
    updateAccountBalance,
    upsertScheduledIncomeEvent,
    removeScheduledIncomeEvent,
    recordScheduledIncomeEvent,
    addHouseholdBill,
    markBillPaid,
    editBill,
    deleteBill,
    editTransaction,
    deleteTransaction,
    transferBetweenAccounts,
    checkSpendingFloors,
  } = useStore();

  const [txType, setTxType] = useState(null);
  const [editBalVisible, setEditBalVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);
  const [activityMenuTx, setActivityMenuTx] = useState(null);
  const [cardOrderVisible, setCardOrderVisible] = useState(false);
  const [incomeEditorEvent, setIncomeEditorEvent] = useState(undefined);
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
  const scheduledIncome = (incomeEvents?.scheduledIncomeEvents || []).filter(event =>
    event.isActive !== false && (!event.accountKey || householdAccountKeys.includes(event.accountKey))
  );

  const sortedBills = [...(householdBills || [])].filter(b => b.isActive !== false).sort((a, b) => (a.dueDay || a.expectedDay || 0) - (b.dueDay || b.expectedDay || 0));
  const jointWarnings = householdAccountKeys.length > 0
    ? (warnings || []).filter(w => householdAccountKeys.includes(w.accountKey))
    : [];
  const householdSavingsGoals = savingsGoalsForScope(novaConfig?.savingsGoals, 'household');

  const activeHouseholdCardIds = [
    'variance',
    CASH_FLOW_FORECAST_CARD_ID,
    'spending_chart',
    'spending_categories',
    'joint_balance',
    'scheduled_income',
    SAVINGS_GOALS_CARD_ID,
    'grocery',
    'bills',
    'receipt_attachments',
    'recent_activity',
  ];
  const householdDisplayCards = [
    { id: 'variance', label: 'Variance Summary' },
    { id: CASH_FLOW_FORECAST_CARD_ID, label: 'Cash-Flow Forecast' },
    { id: 'spending_chart', label: 'Spending Chart' },
    { id: 'spending_categories', label: 'Spending Categories' },
    { id: 'joint_balance', label: 'Shared Account' },
    { id: 'scheduled_income', label: 'Scheduled Income' },
    { id: SAVINGS_GOALS_CARD_ID, label: 'Savings Goals' },
    { id: 'grocery', label: 'Grocery Spending' },
    { id: 'bills', label: 'Household Bills' },
    { id: 'receipt_attachments', label: 'Receipt Photos' },
    { id: 'recent_activity', label: 'Recent Activity' },
  ];
  const orderedHouseholdCards = [
    ...(householdCardOrder || []).filter((id) => activeHouseholdCardIds.includes(id)),
    ...activeHouseholdCardIds.filter((id) => !(householdCardOrder || []).includes(id)),
  ];

  const renderRecentActivityCard = () => {
    const recentTx = [...(transactions || [])]
      .filter(t => !t.deleted && householdAccountKeys.includes(t.accountKey))
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
                <Text style={styles.activityMeta}>{householdAccountOptions.find(option => option.key === tx.accountKey)?.label || householdAccountLabel} - {timeAgo(tx.timestamp)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderHouseholdCard = (id) => {
    if (id === 'variance') {
      if (!householdVariance) return null;
      const hv = householdVariance;
      const borderColor = hv.state === 'green' ? theme.statusPositive : hv.state === 'yellow' ? theme.statusWarning : hv.state === 'red' ? theme.statusDanger : theme.borderColorDim;
      const bgColor = hv.state === 'green' ? theme.statusPositiveBg : hv.state === 'yellow' ? theme.statusWarningBg : hv.state === 'red' ? theme.statusDangerBg : theme.backgroundCard;
      const varSign = hv.variance > 0 ? '+' : '';
      const varColor = hv.variance > 0 ? theme.statusPositive : hv.variance < 0 ? theme.statusDanger : theme.textSecondary;
      return (
        <View style={[styles.varianceCard, { borderColor, backgroundColor: bgColor }]}>
          <Text style={styles.varianceLabel}>HOUSEHOLD VARIANCE</Text>
          <Text style={styles.varianceBalance}>{formatCentsShort(hv.balance)}</Text>
          <Text style={[styles.varianceAmt, { color: varColor }]}>{varSign}{formatCentsShort(hv.variance)}</Text>
          <Text style={styles.varianceAnnotation}>{hv.annotation}</Text>
        </View>
      );
    }
    if (id === CASH_FLOW_FORECAST_CARD_ID) return <CashFlowForecastCard profile="household" title="HOUSEHOLD CASH-FLOW FORECAST" />;
    if (id === 'spending_chart') return <SpendingChartsSection profile="household" />;
    if (id === 'spending_categories') return <SpendingCategoryManagerCard profile="household" />;
    if (id === SAVINGS_GOALS_CARD_ID) {
      return (
        <SavingsGoalsCard
          goals={householdSavingsGoals}
          accounts={accounts}
          accountRegistry={accountRegistry}
          scope="household"
          title="SAVINGS GOALS"
        />
      );
    }
    if (id === 'joint_balance') {
      return (
        <Card>
          {householdAccount ? (
            <>
              <Text style={styles.cardLabel}>{householdAccountLabel.toUpperCase()}</Text>
              <Text style={styles.balanceText}>{formatCentsWholeFloor(accounts[householdAccountKey] || 0)}</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.btnIncome} onPress={() => setTxType('income')}>
                  <Text style={styles.btnText}>LOG INCOME</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnExpense} onPress={() => setTxType('expense')}>
                  <Text style={styles.btnText}>LOG EXPENSE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDim} onPress={() => setTransferVisible(true)}>
                  <Text style={styles.btnDimText}>TRANSFER</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDim} onPress={() => setEditBalVisible(true)}>
                  <Text style={styles.btnDimText}>EDIT BAL</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardLabel}>SHARED ACCOUNT</Text>
              <Text style={styles.balanceText}>--</Text>
              <Text style={[styles.metaText, { marginTop: theme.spacingSM }]}>Add a shared account in Settings.</Text>
            </>
          )}
        </Card>
      );
    }
    if (id === 'scheduled_income') {
      return (
        <Card>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardLabel}>SCHEDULED INCOME</Text>
            <TouchableOpacity style={styles.headerEditBtn} onPress={() => setIncomeEditorEvent(null)}>
              <Text style={styles.headerEditText}>ADD / EDIT</Text>
            </TouchableOpacity>
          </View>
          {scheduledIncome.length === 0 && (
            <Text style={styles.metaText}>No scheduled income yet. Add shared-account inflow so Household forecasts do not start with missing math.</Text>
          )}
          {scheduledIncome.map(event => (
            <View key={event.id} style={styles.billRow}>
              <View style={styles.billInfo}>
                <Text style={styles.billName}>{event.label || 'Income'}</Text>
                <Text style={styles.billMeta}>{formatCentsShort(event.amountCents || 0)} - {event.frequency || 'monthly'} - day {event.dayOfMonth || 1}</Text>
              </View>
              <View style={styles.billActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => setIncomeEditorEvent(event)}>
                  <Text style={styles.editBtnText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.markPaidBtn, { marginLeft: theme.spacingXS }]} onPress={() => recordScheduledIncomeEvent(event.id)}>
                  <Text style={styles.markPaidText}>CONFIRM</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>
      );
    }
    if (id === 'grocery') return <GroceryBudgetCard profile="household" />;
    if (id === 'bills') {
      return (
        <Card>
          <Text style={styles.cardLabel}>SCHEDULED BILLS & SUBSCRIPTIONS</Text>
          {sortedBills.length === 0 && (
            <Text style={[styles.metaText, { marginBottom: theme.spacingSM }]}>No bills added yet.</Text>
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
                  <Text style={styles.billMeta}>{scheduledItemLabel(bill)} - {formatCents(bill.amountCents)} - Due {ordinalDay(bill.dueDay || bill.expectedDay)} - {isStatic ? `Fixed amount - ${autoPost ? 'Auto-Post on' : 'manual confirmation'}` : 'Variable amount - manual confirmation'}</Text>
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
    }
    if (id === 'receipt_attachments') {
      return (
        <ReceiptAttachmentsCard
          title="RECEIPT PHOTOS"
          transactions={(transactions || []).filter(t => householdAccountKeys.includes(t.accountKey))}
          getAccountLabel={(tx) => householdAccountOptions.find(option => option.key === tx?.accountKey)?.label || householdAccountLabel}
        />
      );
    }
    if (id === 'recent_activity') return renderRecentActivityCard();
    return null;
  };

  const handleTxSubmit = async (payload) => {
    if (!householdAccountKey) return;
    const result = await submitTransactionPayload(logTransaction, payload, householdAccountKey);
    checkSpendingFloors();
    return result;
  };

  const handleEditBalance = async (cents) => {
    if (!householdAccountKey) return;
    await updateAccountBalance(householdAccountKey, cents);
    checkSpendingFloors();
  };

  const handleTransfer = async (transfer) => {
    await transferBetweenAccounts(transfer);
    checkSpendingFloors();
  };

  if (userMode && userMode !== 'partnered') {
    return (
      <View style={[styles.container, { padding: theme.spacingMD }]}>
        <View style={styles.card}>
          <Text style={[styles.cardLabel, { textAlign: 'center', marginBottom: theme.spacingSM }]}>HOUSEHOLD TRACKING UNAVAILABLE</Text>
          <Text style={[styles.metaText, { textAlign: 'center' }]}>Household tracking is for shared or joint accounts. Enable it in Settings -> Profile.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >

      {/* 1. Header strip */}
      <View style={styles.headerStrip}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>HOUSEHOLD</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => navigation?.navigate('TransactionSearch', {
                initialFilters: householdAccountKeys.length > 0 ? { accountKeys: householdAccountKeys } : {},
              })}
            >
              <Text style={styles.searchBtnText}>{searchCopy.searchIcon}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => navigation?.navigate('Calendar', { mode: 'household' })}
            >
              <Text style={styles.calendarBtnText}>VIEW CALENDAR</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.screenSubtitle}>Joint Accounts + Bills</Text>
      </View>

      <TourCueCard
        cueId="household_tools"
        title="Shared accounts, shared visibility."
        body="Household tracks joint balances, bills, subscriptions, grocery reserve, receipts, category charts, and calendar pressure. The point is not blame. The point is fewer mystery numbers."
        actionLabel="VIEW CALENDAR"
        onAction={() => navigation?.navigate('Calendar', { mode: 'household' })}
      />

      {/* Ordered cards */}
      {orderedHouseholdCards
        .filter((id) => !(householdHiddenCards || []).includes(id))
        .map((id) => (
          <React.Fragment key={id}>
            {renderHouseholdCard(id)}
          </React.Fragment>
        ))}

      {/* Card Order row */}
      {isPartnered && (
        <CardOrderLink onPress={() => setCardOrderVisible(true)} />
      )}

      {/* Floor warnings outside order loop */}
      {isPartnered && jointWarnings.length > 0 && (
        <View style={styles.warningCard}>
          {jointWarnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>
              WARNING: {householdAccountLabel.toUpperCase()} below floor ({formatCents(w.floor)}) - current: {formatCents(w.balance)}
            </Text>
          ))}
        </View>
      )}

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
        visible={txType !== null}
        type={txType}
        accountName={householdAccountLabel}
        profile="household"
        defaultAccountKey={householdAccountKey}
        accountOptions={householdAccountOptions}
        onSubmit={handleTxSubmit}
        onClose={() => setTxType(null)}
      />
      <EditBalanceModal
        visible={editBalVisible}
        accountName={householdAccountLabel}
        currentBalanceCents={accounts[householdAccountKey] || 0}
        onSubmit={handleEditBalance}
        onClose={() => setEditBalVisible(false)}
      />
      <TransferModal
        visible={transferVisible}
        fromAccountKey={householdAccountKey}
        accountOptions={householdAccountOptions}
        profile="household"
        onSubmit={handleTransfer}
        onClose={() => setTransferVisible(false)}
      />
      <AddBillModal
        visible={addBillVisible}
        accountOptions={householdAccountOptions}
        profile="household"
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
        profile="household"
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
        profile="household"
        accountOptions={householdAccountOptions}
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
        title="HOUSEHOLD CARD ORDER"
        cards={householdDisplayCards}
        currentOrder={householdCardOrder}
        currentHidden={householdHiddenCards}
        onSave={async (order, hidden) => {
          await updateHouseholdCardOrder(order);
          await updateHouseholdHiddenCards(hidden);
        }}
        onClose={() => setCardOrderVisible(false)}
      />
      <ScheduledIncomeEditorModal
        visible={incomeEditorEvent !== undefined}
        event={incomeEditorEvent || null}
        accountOptions={householdAccountOptions}
        onSave={async (event) => {
          await upsertScheduledIncomeEvent(event);
          checkSpendingFloors();
        }}
        onRemove={(event) => {
          Alert.alert('Remove Income Event', `Remove ${event.label || 'this income event'}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeScheduledIncomeEvent(event.id) },
          ]);
        }}
        onClose={() => setIncomeEditorEvent(undefined)}
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  headerEditBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    backgroundColor: theme.accentGlow,
  },
  headerEditText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
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
  incomeModalPanel: {
    margin: theme.spacingLG,
    padding: theme.spacingMD,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
  },
  incomeModalTitle: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingXS,
  },
  modalHint: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    lineHeight: 16,
    marginBottom: theme.spacingSM,
  },
  inputLabel: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: theme.spacingXS,
    marginTop: theme.spacingSM,
  },
  incomeModalInput: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundPanel,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    padding: theme.spacingSM,
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
  },
  modalChip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  modalChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  modalChipText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  modalChipTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacingXS,
    marginTop: theme.spacingMD,
  },
  modalGhostBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  modalGhostText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
  modalDangerBtn: {
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  modalDangerText: {
    color: theme.statusDanger,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
  },
  modalSaveBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    backgroundColor: theme.accentGlow,
  },
  modalSaveText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: 'bold',
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
  varianceCard: { padding: theme.spacingLG, borderRadius: theme.borderRadiusMD, borderWidth: 2, marginBottom: theme.spacingMD },
  varianceLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  varianceBalance: { color: theme.textPrimary, fontSize: theme.fontSizeXXL, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: 4 },
  varianceAmt: { fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, marginBottom: 2 },
  varianceAnnotation: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
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
