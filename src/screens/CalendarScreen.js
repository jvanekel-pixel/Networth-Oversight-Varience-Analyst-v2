import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import { formatDate, getCurrentWeekStart } from '../utils/dates';
import {
  getBillEventsBetween,
  getIncomeEventsBetween,
  projectAccountBalances,
  getGroceryReserveForDate,
} from '../utils/forecasting';
import { EditBillModal, EditTransactionModal } from '../components/TransactionModal';
import {
  getRecurringTransactionEventsBetween,
  recurringScopeMatches,
} from '../utils/recurringTransactions';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CELL_SIZE = Math.floor(Dimensions.get('window').width / 7);
const CALENDAR_DOT_TYPES = [
  { key: 'bill', label: 'Bills', color: theme.calendarBillColor },
  { key: 'income', label: 'Income', color: theme.calendarIncomeColor },
  { key: 'tx', label: 'Transactions', color: theme.calendarTransactionColor },
  { key: 'business', label: 'Business', color: theme.calendarBusinessColor },
  { key: 'grocery', label: 'Grocery reserve', color: theme.calendarGroceryColor },
  { key: 'recurring', label: 'Recurring', color: theme.calendarRecurringColor },
];
const DEFAULT_VISIBLE_DOT_TYPES = CALENDAR_DOT_TYPES.reduce((acc, type) => {
  acc[type.key] = true;
  return acc;
}, {});

function isSameDayMs(ms1, ms2) {
  const a = new Date(ms1);
  const b = new Date(ms2);
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function dateKeyFromMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function withAlpha(hex, alpha) {
  if (!hex || hex[0] !== '#') return hex;
  const value = hex.slice(1);
  const full = value.length === 3
    ? value.split('').map(ch => ch + ch).join('')
    : value;
  const int = parseInt(full, 16);
  if (!Number.isFinite(int)) return hex;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseRecordDateMs(value) {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getTimestamp(record) {
  return parseRecordDateMs(record?.timestamp ?? record?.date ?? record?.createdAt ?? null);
}

function normalizeBusinessEvents(records, type, businessLabel = null) {
  return (records || [])
    .filter(record => record && !record.deleted && getTimestamp(record))
    .map(record => {
      const amountCents = type === 'mileage'
        ? (record.deductionCents || 0)
        : (record.amountCents || 0);
      return {
        ...record,
        dateMs: getTimestamp(record),
        type,
        businessLabel,
        amountCents,
      };
    });
}

function getAccountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
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

function billPostingModeLabel(bill) {
  const isFixed = bill?.amountType === 'static' || bill?.isStaticAmount === true;
  if (!isFixed) return 'variable amount - manual confirmation';
  return billAutoPostEnabled(bill) ? 'fixed amount - Auto-Post on' : 'fixed amount - manual confirmation';
}

function DotGrid({ bill, income, tx, business, grocery, recurring }) {
  // Fixed 2×3 grid: top row [bill, income, tx], bottom row [business, grocery, reserved]
  const slots = [
    bill     ? 'bill'     : null,
    income   ? 'income'   : null,
    tx       ? 'tx'       : null,
    business ? 'business' : null,
    grocery  || null,
    recurring ? 'recurring' : null,
  ];
  const dotStyle = (slot) => {
    if (slot === 'bill')     return styles.dotRed;
    if (slot === 'income')   return styles.dotGreen;
    if (slot === 'tx')       return styles.dotBlue;
    if (slot === 'business') return styles.dotBusiness;
    if (slot === 'groceryDanger' || slot === 'danger') return styles.dotGroceryDanger;
    if (slot === 'grocery' || slot === 'accent') return styles.dotGrocery;
    if (slot === 'recurring') return styles.dotRecurring;
    return styles.dotEmpty;
  };
  return (
    <View style={styles.dotGrid}>
      <View style={styles.dotGridRow}>
        {slots.slice(0, 3).map((s, i) => <View key={i} style={[styles.dot, dotStyle(s)]} />)}
      </View>
      <View style={styles.dotGridRow}>
        {slots.slice(3, 6).map((s, i) => <View key={i} style={[styles.dot, dotStyle(s)]} />)}
      </View>
    </View>
  );
}

function getModeAccountRoles(mode) {
  if (mode === 'household') return ['household'];
  if (mode === 'personal') return ['personal'];
  if (mode === 'business') return ['business'];
  return null;
}

function getFallbackProjection(accounts = {}) {
  return { ...accounts };
}

function getPrimaryProjectionKey(mode, activeAccounts = [], accounts = {}) {
  const firstActive = getAccountKey(activeAccounts[0]);
  const firstStored = Object.keys(accounts || {})[0] || null;
  const fallback = firstActive || firstStored;
  if (mode === 'personal') {
    const personal = activeAccounts.find(account => account.role === 'personal');
    return getAccountKey(personal) || fallback;
  }
  if (mode === 'business') {
    const business = activeAccounts.find(account => account.role === 'business');
    return getAccountKey(business) || null;
  }
  const household = activeAccounts.find(account => account.role === 'household');
  return getAccountKey(household) || fallback;
}

function activeBillFilter(bill) {
  return bill?.active !== false && bill?.isActive !== false && bill?.deleted !== true;
}

function applyBillFallback(events, fallbackAccountKey) {
  return events.map(event => ({
    ...event,
    accountKey: event.accountKey || fallbackAccountKey,
  }));
}

export default function CalendarScreen({ navigation, route, mode: modeProp }) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [visibleDotTypes, setVisibleDotTypes] = useState(DEFAULT_VISIBLE_DOT_TYPES);
  const groceryReserveOn = useStore(s => s.groceryReserveOn !== false);
  const setGroceryReserveOn = useStore(s => s.setGroceryReserveOn);

  const mode = modeProp || route?.params?.mode || 'dashboard';
  const isBusinessMode = mode === 'business';

  const {
    accounts,
    householdBills,
    personalBills,
    incomeEvents,
    transactions,
    genericBusinessIncome,
    genericBusinessExpenses,
    genericBusinessMileage,
    businesses,
    editBill,
    deleteBill,
    editTransaction,
    accountRegistry,
    accountFloors,
    novaConfig,
    groceryBudget,
    personalGroceryBudget,
    recurringTransactions,
  } = useStore();

  const userMode = novaConfig?.userMode ?? null;
  const activeAccounts = useMemo(
    () => (accountRegistry || []).filter(a => a.isActive !== false),
    [accountRegistry],
  );
  const groceryScope = useMemo(() => {
    if (isBusinessMode) return null;
    if (mode === 'personal') return 'personal';
    if (mode === 'household') return 'household';
    return userMode === 'solo' ? 'personal' : 'household';
  }, [isBusinessMode, mode, userMode]);
  const activeGroceryBudget = groceryScope === 'personal'
    ? personalGroceryBudget
    : groceryScope === 'household'
    ? groceryBudget
    : null;
  const groceryAccountKey = useMemo(() => {
    if (!groceryScope) return null;
    const account = activeAccounts.find(a => a.role === groceryScope);
    return getAccountKey(account) || getPrimaryProjectionKey(groceryScope, activeAccounts, accounts);
  }, [groceryScope, activeAccounts, accounts]);
  const accountByKey = useMemo(() => {
    const map = new Map();
    activeAccounts.forEach(account => {
      const key = getAccountKey(account);
      if (key) map.set(key, account);
      if (account.id) map.set(account.id, account);
    });
    return map;
  }, [activeAccounts]);
  const accountLabel = (key) => {
    const found = accountByKey.get(key);
    return found ? (found.name || found.id) : key || 'Unassigned';
  };
  const businessById = useMemo(() => {
    const map = new Map();
    (businesses || []).forEach(business => map.set(business.id, business.name || business.id));
    return map;
  }, [businesses]);
  const showGroceryReserve = !isBusinessMode && groceryReserveOn && (activeGroceryBudget?.weeklyLimit || 0) > 0;
  const isDotVisible = (key) => visibleDotTypes[key] !== false;
  const toggleDotType = (key) => {
    setVisibleDotTypes(current => ({
      ...current,
      [key]: current[key] === false,
    }));
  };

  const modeRoles = getModeAccountRoles(mode);
  const modeAccountKeys = useMemo(() => {
    if (!modeRoles) return null;
    return new Set(activeAccounts
      .filter(account => modeRoles.includes(account.role))
      .map(getAccountKey)
      .filter(Boolean));
  }, [activeAccounts, modeRoles]);
  const modeAccountOptions = useMemo(() => {
    const roles = getModeAccountRoles(mode);
    return activeAccounts
      .filter(account => !roles || roles.includes(account.role))
      .map(a => ({ key: getAccountKey(a), label: (a.name || a.id).toUpperCase() }))
      .filter(option => option.key);
  }, [activeAccounts, mode]);
  const editProfile = mode === 'personal' ? 'personal' : mode === 'household' ? 'household' : mode === 'business' ? 'business' : null;

  const allBills = useMemo(() => {
    const activeHousehold = (householdBills || []).filter(activeBillFilter);
    const activePersonal = (personalBills || []).filter(activeBillFilter);
    if (mode === 'household') return activeHousehold;
    if (mode === 'personal') return activePersonal;
    if (mode === 'business') return [];
    return [...activeHousehold, ...activePersonal];
  }, [householdBills, personalBills, mode]);

  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999);
  const startMs = monthStart.getTime();
  const endMs = monthEnd.getTime();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const projectionEnd = new Date(todayStart);
  projectionEnd.setDate(projectionEnd.getDate() + 90);

  const projectedBalances = useMemo(() => projectAccountBalances(
    todayStart,
    projectionEnd,
    accounts || {},
    householdBills || [],
    personalBills || [],
    incomeEvents || {},
    accountRegistry || [],
    novaConfig || {},
    userMode,
  ), [accounts, householdBills, personalBills, incomeEvents, accountRegistry, novaConfig, userMode, todayStart.getTime(), projectionEnd.getTime()]);

  const billEvents = useMemo(() => {
    const activeHousehold = (householdBills || []).filter(activeBillFilter);
    const activePersonal = (personalBills || []).filter(activeBillFilter);
    const householdEvents = applyBillFallback(getBillEventsBetween(activeHousehold, startMs, endMs), getPrimaryProjectionKey('household', activeAccounts, accounts));
    const personalEvents = applyBillFallback(getBillEventsBetween(activePersonal, startMs, endMs), getPrimaryProjectionKey('personal', activeAccounts, accounts));

    if (mode === 'household') return householdEvents;
    if (mode === 'personal') return personalEvents;
    if (mode === 'business') return [];
    return [...householdEvents, ...personalEvents];
  }, [householdBills, personalBills, startMs, endMs, mode, activeAccounts, accounts]);
  const incomeEvts = useMemo(() => {
    if (mode === 'business') return [];
    const events = getIncomeEventsBetween(incomeEvents, startMs, endMs, accountRegistry, userMode, novaConfig);
    if (!modeAccountKeys) return events;
    return events.filter(evt => modeAccountKeys.has(evt.accountKey));
  }, [incomeEvents, startMs, endMs, accountRegistry, userMode, novaConfig, modeAccountKeys, mode]);

  const monthTx = useMemo(() => (transactions || [])
    .filter(t => {
      if (mode === 'business' || t.deleted || t.timestamp < startMs || t.timestamp > endMs) return false;
      if (!modeAccountKeys) return true;
      return t.accountKey && modeAccountKeys.has(t.accountKey);
    }), [transactions, startMs, endMs, mode, modeAccountKeys]);

  const businessEvts = useMemo(() => {
    if (mode !== 'dashboard' && mode !== 'business') return [];
    return [
      ...normalizeBusinessEvents(genericBusinessIncome, 'business_income'),
      ...normalizeBusinessEvents(genericBusinessExpenses, 'business_expense'),
      ...normalizeBusinessEvents(genericBusinessMileage, 'business_mileage'),
    ].filter(evt => evt.dateMs >= startMs && evt.dateMs <= endMs);
  }, [
    mode,
    genericBusinessIncome,
    genericBusinessExpenses,
    genericBusinessMileage,
    startMs,
    endMs,
  ]);
  const recurringEvts = useMemo(() => {
    const events = getRecurringTransactionEventsBetween(recurringTransactions || [], startMs, endMs);
    return events.filter(evt => {
      if (!recurringScopeMatches(evt, mode)) return false;
      if (!modeAccountKeys) return true;
      return evt.accountKey && modeAccountKeys.has(evt.accountKey);
    });
  }, [recurringTransactions, startMs, endMs, mode, modeAccountKeys]);
  const businessTotalsByDate = useMemo(() => {
    const totals = new Map();
    (businessEvts || []).forEach(evt => {
      const key = dateKeyFromMs(evt.dateMs);
      const current = totals.get(key) || {
        incomeCents: 0,
        expenseCents: 0,
        mileageDeductionCents: 0,
        netCents: 0,
      };
      if (evt.type === 'business_income') {
        current.incomeCents += evt.amountCents || 0;
        current.netCents += evt.amountCents || 0;
      } else if (evt.type === 'business_expense') {
        current.expenseCents += evt.amountCents || 0;
        current.netCents -= evt.amountCents || 0;
      } else if (evt.type === 'business_mileage') {
        current.mileageDeductionCents += evt.deductionCents || evt.amountCents || 0;
      }
      totals.set(key, current);
    });
    return totals;
  }, [businessEvts]);

  const firstDow = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const cellDate = inMonth ? new Date(viewYear, viewMonth, dayNum) : null;
    const cellMs = cellDate ? cellDate.getTime() + 12 * 60 * 60 * 1000 : null;
    cells.push({ dayNum, inMonth, cellMs });
  }

  const selectedMs = new Date(viewYear, viewMonth, selectedDay, 12, 0, 0, 0).getTime();
  const selectedKey = dateKeyFromMs(selectedMs);
  const selectedProjection = isBusinessMode ? null : (projectedBalances.get(selectedKey) || getFallbackProjection(accounts || {}));

  const selectedBillEvts = billEvents.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedIncomeEvts = incomeEvts.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedTxEvts = monthTx.filter(t => isSameDayMs(t.timestamp, selectedMs));
  const selectedBusinessEvts = businessEvts.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedRecurringEvts = recurringEvts.filter(e => isSameDayMs(e.dateMs, selectedMs));

  const headerLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedLabel = new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(1);
  };
  const goToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
    setSheetVisible(true);
  };

  const isToday = (dayNum) =>
    dayNum === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();

  const hasBillDot = (cellMs) => cellMs && billEvents.some(e => isSameDayMs(e.dateMs, cellMs));
  const hasIncomeDot = (cellMs) => cellMs && incomeEvts.some(e => isSameDayMs(e.dateMs, cellMs));
  const hasTxDot = (cellMs) => cellMs && monthTx.some(t => isSameDayMs(t.timestamp, cellMs));
  const hasBusinessDot = (cellMs) => cellMs && businessEvts.some(e => isSameDayMs(e.dateMs, cellMs));
  const hasRecurringDot = (cellMs) => cellMs && recurringEvts.some(e => isSameDayMs(e.dateMs, cellMs));

  const getProjectionForCell = (cellMs) => {
    if (!cellMs) return null;
    return projectedBalances.get(dateKeyFromMs(cellMs)) || null;
  };

  const getCellRiskStyle = (projection, cellMs) => {
    if (isBusinessMode) return null;
    if (!projection) return null;
    const key = getPrimaryProjectionKey(mode, activeAccounts, accounts);
    if (!key) return null;
    const floor = accountFloors?.[key] ?? 0;
    const balance = projection[key] || 0;
    if (balance < 0) return styles.redProjectionCell;
    let checkBalance = balance;
    if (showGroceryReserve && cellMs && key === groceryAccountKey && activeGroceryBudget) {
      checkBalance = balance - getGroceryReserveForDate({ targetDateMs: cellMs, groceryBudget: activeGroceryBudget });
    }
    if (floor > 0 && checkBalance < floor) return styles.yellowProjectionCell;
    return null;
  };

  const getGroceryDotColor = (cellMs) => {
    if (!showGroceryReserve || !cellMs || !activeGroceryBudget) return null;
    const d = new Date(cellMs);
    if (d.getDay() !== 0) return null;
    const weeklyLimit = activeGroceryBudget?.weeklyLimit || 0;
    if (weeklyLimit <= 0) return null;
    const nowMs = now.getTime();
    const currentWeekStart = getCurrentWeekStart(nowMs);
    const cellWeekStart = getCurrentWeekStart(cellMs);
    if (cellWeekStart < currentWeekStart) return null;
    if (cellWeekStart === currentWeekStart) {
      return (activeGroceryBudget?.currentWeekSpend || 0) > weeklyLimit ? 'groceryDanger' : 'grocery';
    }
    return 'grocery';
  };

  const openDay = (dayNum) => {
    setSelectedDay(dayNum);
    setSheetVisible(true);
  };

  const currentMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const hasScheduledActivity = selectedBillEvts.length > 0 ||
    selectedIncomeEvts.length > 0 ||
    selectedTxEvts.length > 0 ||
    selectedBusinessEvts.length > 0 ||
    selectedRecurringEvts.length > 0;

  const touchedAccounts = useMemo(() => {
    const keys = new Set();
    selectedBillEvts.forEach(evt => {
      const bill = allBills.find(b => b.id === evt.billId);
      const key = evt.accountKey || bill?.accountKey || bill?.defaultAccountKey;
      if (key) keys.add(key);
    });
    selectedIncomeEvts.forEach(evt => evt.accountKey && keys.add(evt.accountKey));
    selectedTxEvts.forEach(tx => tx.accountKey && keys.add(tx.accountKey));
    selectedBusinessEvts.forEach(evt => evt.accountKey && keys.add(evt.accountKey));
    selectedRecurringEvts.forEach(evt => evt.accountKey && keys.add(evt.accountKey));
    return keys;
  }, [selectedBillEvts, selectedIncomeEvts, selectedTxEvts, selectedBusinessEvts, selectedRecurringEvts, allBills]);

  const balanceRows = useMemo(() => {
    if (isBusinessMode) {
      const totals = businessTotalsByDate.get(selectedKey);
      if (!totals) return [];
      const rows = [];
      if (totals.incomeCents > 0) rows.push({ key: 'business_income', label: 'Business income', balance: totals.incomeCents, state: 'green' });
      if (totals.expenseCents > 0) rows.push({ key: 'business_expenses', label: 'Business expenses', balance: -totals.expenseCents, state: 'red' });
      if (totals.mileageDeductionCents > 0) rows.push({ key: 'business_mileage', label: 'Mileage deduction', balance: totals.mileageDeductionCents, state: 'green' });
      if (totals.incomeCents > 0 || totals.expenseCents > 0) {
        rows.push({ key: 'business_net', label: 'Business net', balance: totals.netCents, state: totals.netCents < 0 ? 'red' : 'green' });
      }
      return rows;
    }
    if (!selectedProjection) return [];
    let keys;
    if (mode === 'household') {
      const householdKeys = activeAccounts
        .filter(account => account.role === 'household')
        .map(getAccountKey)
        .filter(Boolean);
      keys = new Set(householdKeys.length > 0 ? householdKeys : [...touchedAccounts]);
    } else if (mode === 'personal') {
      const configuredPersonal = activeAccounts
        .filter(account => account.role === 'personal')
        .map(getAccountKey)
        .filter(Boolean);
      keys = new Set(configuredPersonal.length > 0 ? configuredPersonal : [...touchedAccounts]);
    } else if (mode === 'business') {
      const businessKeys = activeAccounts
        .filter(account => account.role === 'business')
        .map(getAccountKey)
        .filter(Boolean);
      keys = new Set(businessKeys.length > 0 ? businessKeys : [...touchedAccounts]);
    } else {
      keys = new Set([
        ...activeAccounts.map(getAccountKey).filter(Boolean),
        ...Object.keys(selectedProjection),
        ...touchedAccounts,
      ]);
    }

    return [...keys]
      .filter(key => {
        const balance = selectedProjection[key] || 0;
        if (mode === 'business') return true;
        if (mode === 'household' || mode === 'personal') return true;
        return balance !== 0 || touchedAccounts.has(key);
      })
      .map(key => {
        const balance = selectedProjection[key] || 0;
        const floor = accountFloors?.[key] ?? 0;
        const state = balance < floor
          ? 'red'
          : floor > 0 && balance <= Math.ceil(floor * 1.2)
            ? 'yellow'
            : 'green';
        const groceryReserve = showGroceryReserve && key === groceryAccountKey && activeGroceryBudget
          ? getGroceryReserveForDate({ targetDateMs: selectedMs, groceryBudget: activeGroceryBudget })
          : 0;
        return { key, label: accountLabel(key), balance, state, groceryReserve, availableAfterGrocery: balance - groceryReserve };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedProjection, activeAccounts, touchedAccounts, accountByKey, accountFloors, mode, isBusinessMode, businessTotalsByDate, selectedKey, showGroceryReserve, groceryAccountKey, activeGroceryBudget, selectedMs]);

  const businessLabel = (evt) => {
    const label = evt.businessLabel || businessById.get(evt.businessId) || 'Business';
    if (evt.type === 'business_income') {
      return `${label} income - ${formatCentsShort(evt.amountCents || 0)}`;
    }
    if (evt.type === 'business_expense') {
      return `${label} expense - ${formatCentsShort(evt.amountCents || 0)}`;
    }
    return `${label} mileage - ${(evt.miles || 0).toFixed(1)} mi - ${formatCentsShort(evt.deductionCents || 0)}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>BACK</Text>
      </TouchableOpacity>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{headerLabel}</Text>
        <TouchableOpacity onPress={goToday} style={styles.todayBtn}>
          <Text style={styles.todayText}>TODAY</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {!isBusinessMode && (
        <View style={styles.groceryToggleRow}>
          <Text style={styles.groceryToggleLabel}>Grocery Reserve</Text>
          <TouchableOpacity
            style={[styles.toggleBtn, groceryReserveOn && styles.toggleBtnActive]}
            onPress={() => setGroceryReserveOn(!groceryReserveOn)}
          >
            <Text style={[styles.toggleBtnText, groceryReserveOn && styles.toggleBtnTextActive]}>
              {groceryReserveOn ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.dowRow}>
        {DAYS.map(d => (
          <View key={d} style={styles.dowCell}>
            <Text style={styles.dowText}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {(() => {
          const projectionKey = getPrimaryProjectionKey(mode, activeAccounts, accounts);
          return cells.map((cell, idx) => {
            const todayCell = cell.inMonth && isToday(cell.dayNum);
            const selectedCell = cell.inMonth && cell.dayNum === selectedDay;
            const projection = getProjectionForCell(cell.cellMs);

            let displayAmt = null;
            if (cell.inMonth && !isBusinessMode && projection) {
              const cash = projectionKey ? (projection[projectionKey] || 0) : 0;
              displayAmt = (showGroceryReserve && projectionKey === groceryAccountKey && activeGroceryBudget && cell.cellMs)
                ? cash - getGroceryReserveForDate({ targetDateMs: cell.cellMs, groceryBudget: activeGroceryBudget })
                : cash;
            } else if (cell.inMonth && isBusinessMode && cell.cellMs) {
              const totals = businessTotalsByDate.get(dateKeyFromMs(cell.cellMs));
              if (totals) {
                displayAmt = (totals.incomeCents > 0 || totals.expenseCents > 0)
                  ? totals.netCents
                  : totals.mileageDeductionCents || null;
              }
            }

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.cell,
                  cell.inMonth && getCellRiskStyle(projection, cell.cellMs),
                  todayCell && styles.todayCell,
                  selectedCell && styles.selectedCell,
                ]}
                onPress={() => cell.inMonth && openDay(cell.dayNum)}
                activeOpacity={0.7}
              >
                {/* Top row: date number + dot grid */}
                <View style={styles.cellTopRow}>
                  <Text style={[styles.cellDay, !cell.inMonth && styles.cellDayDim]}>
                    {cell.inMonth ? cell.dayNum : ''}
                  </Text>
                  {cell.inMonth && (
                    <DotGrid
                      bill={isDotVisible('bill') && hasBillDot(cell.cellMs)}
                      income={isDotVisible('income') && hasIncomeDot(cell.cellMs)}
                      tx={isDotVisible('tx') && hasTxDot(cell.cellMs)}
                      business={isDotVisible('business') && hasBusinessDot(cell.cellMs)}
                      grocery={isDotVisible('grocery') ? getGroceryDotColor(cell.cellMs) : null}
                      recurring={isDotVisible('recurring') && hasRecurringDot(cell.cellMs)}
                    />
                  )}
                </View>
                {/* Bottom: projected / available amount */}
                {displayAmt !== null && (
                  <Text style={styles.projectionText} numberOfLines={1}>
                    {formatCentsShort(displayAmt)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          });
        })()}
      </View>

      <View style={styles.legendRow}>
        {CALENDAR_DOT_TYPES
          .filter(type => type.key !== 'grocery' || showGroceryReserve)
          .map(type => {
            const active = isDotVisible(type.key);
            return (
              <TouchableOpacity
                key={type.key}
                accessibilityRole="button"
                style={[styles.legendPill, !active && styles.legendPillOff]}
                onPress={() => toggleDotType(type.key)}
                activeOpacity={0.75}
              >
                <View style={[
                  styles.dot,
                  { backgroundColor: type.color },
                  !active && styles.legendDotOff,
                ]} />
                <Text style={[styles.legendText, !active && styles.legendTextOff]}>{type.label}</Text>
              </TouchableOpacity>
            );
          })}
      </View>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity style={styles.modalScrim} activeOpacity={1} onPress={() => setSheetVisible(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacingMD) }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>{selectedLabel}</Text>
              <TouchableOpacity onPress={() => setSheetVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetCard}>
                <Text style={styles.cardTitle}>Activity on this day</Text>
                {!hasScheduledActivity && (
                  <Text style={styles.emptyText}>No scheduled activity</Text>
                )}

                {selectedBillEvts.map((evt, i) => {
                  const bill = allBills.find(b => b.id === evt.billId);
                  const paidThisMonth = bill?.lastPaidMonth === currentMonth;
                  const sourceAccountKey = evt.accountKey || bill?.accountKey || bill?.defaultAccountKey;
                  const postingMode = billPostingModeLabel(bill || evt);
                  return (
                    <TouchableOpacity
                      key={`b${i}`}
                      style={styles.eventRow}
                      onPress={() => { setSheetVisible(false); if (bill) setEditingBill(bill); }}
                    >
                      <Text style={styles.eventText}>{scheduledItemLabel(evt)}: {evt.billName} - {formatCentsShort(evt.amountCents)}</Text>
                      <Text style={styles.eventMeta}>
                        from: {accountLabel(sourceAccountKey)} - {postingMode}{paidThisMonth ? ` - paid ${formatDate(bill?.lastPaidDate || Date.now())}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {selectedIncomeEvts.map((evt, i) => {
                  const sourceLabel = evt.source === 'operator_paycheck' ? 'Primary income' : (evt.label || 'Scheduled income');
                  return (
                    <View key={`i${i}`} style={styles.eventRow}>
                      <Text style={styles.eventText}>{sourceLabel} - {formatCentsShort(evt.amountCents)}</Text>
                      <Text style={styles.eventMeta}>to: {accountLabel(evt.accountKey)}</Text>
                    </View>
                  );
                })}

                {selectedBusinessEvts.map((evt, i) => (
                  <View key={`biz${i}`} style={styles.eventRow}>
                    <Text style={styles.eventText}>{businessLabel(evt)}</Text>
                    <Text style={styles.eventMeta}>{evt.accountKey ? accountLabel(evt.accountKey) : 'business activity'}</Text>
                  </View>
                ))}

                {selectedRecurringEvts.map((evt, i) => {
                  const sign = evt.direction === 'income' ? '+' : '-';
                  return (
                    <View key={`rec${i}`} style={styles.eventRow}>
                      <Text style={styles.eventText}>{evt.title} - {sign}{formatCentsShort(evt.amountCents || 0)}</Text>
                      <Text style={styles.eventMeta}>{evt.category || 'recurring'} - {accountLabel(evt.accountKey)}</Text>
                    </View>
                  );
                })}

                {selectedTxEvts.map((tx, i) => {
                  const desc = (tx.description || '').slice(0, 36) || tx.category || 'Transaction';
                  return (
                    <TouchableOpacity
                      key={`t${i}`}
                      style={styles.eventRow}
                      onPress={() => { setSheetVisible(false); setEditingTx(tx); }}
                    >
                      <Text style={styles.eventText}>{desc} - {formatCentsShort(tx.amountCents)}</Text>
                      <Text style={styles.eventMeta}>{accountLabel(tx.accountKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.sheetCard}>
                <Text style={styles.cardTitle}>{isBusinessMode ? 'Business Totals' : 'Projected Balances'} - {selectedLabel}</Text>
                {balanceRows.length === 0 && (
                  <Text style={styles.emptyText}>
                    {isBusinessMode ? 'No business income, expenses, or mileage on this day.' : 'No projected balances available'}
                  </Text>
                )}
                {balanceRows.map(row => (
                  <View key={row.key} style={styles.balanceRow}>
                    <View style={styles.balanceLabelCol}>
                      <Text style={styles.balanceLabel}>{row.label}</Text>
                      {row.groceryReserve > 0 && (
                        <Text style={styles.groceryReserveLine}>
                          after grocery reserve: {formatCentsShort(row.availableAfterGrocery)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.balanceAmount, styles[`${row.state}Balance`]]}>
                      {formatCentsShort(row.balance)}
                    </Text>
                  </View>
                ))}
                {isBusinessMode && (
                  <Text style={styles.scheduleNote}>Business calendar only shows recorded business activity.</Text>
                )}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <EditBillModal
        visible={editingBill !== null}
        bill={editingBill}
        accountOptions={modeAccountOptions}
        profile={editProfile}
        onSubmit={async (updates) => { await editBill(editingBill.id, updates); setEditingBill(null); }}
        onDelete={() => { deleteBill(editingBill.id); setEditingBill(null); }}
        onClose={() => setEditingBill(null)}
      />
      <EditTransactionModal
        visible={editingTx !== null}
        transaction={editingTx}
        accountOptions={modeAccountOptions}
        profile={editProfile}
        onSubmit={async (updates) => { await editTransaction(editingTx.id, updates); setEditingTx(null); }}
        onClose={() => setEditingTx(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  backBtn: {
    paddingHorizontal: theme.spacingMD,
    paddingTop: theme.spacingMD,
    paddingBottom: theme.spacingXS,
  },
  backText: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingSM,
  },
  navBtn: {
    padding: theme.spacingSM,
  },
  navArrow: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
  },
  monthLabel: {
    flex: 1,
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  todayBtn: {
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    marginHorizontal: theme.spacingXS,
  },
  todayText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  dowRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
  },
  dowCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: theme.spacingXS,
  },
  dowText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: CELL_SIZE * 7,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    padding: 2,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  todayCell: {
    borderColor: theme.accent,
    borderWidth: 2,
  },
  selectedCell: {
    backgroundColor: theme.accentGlow,
  },
  yellowProjectionCell: {
    backgroundColor: withAlpha(theme.warningYellow, 0.08),
  },
  redProjectionCell: {
    backgroundColor: withAlpha(theme.danger, 0.1),
  },
  // Cell top row: date number left, dot grid right
  cellTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cellDay: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    lineHeight: 12,
  },
  cellDayDim: {
    color: theme.textDim,
  },
  // 2×3 dot grid
  dotGrid: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  dotGridRow: {
    flexDirection: 'row',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    margin: 1,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
  },
  // Dollar amount pinned to bottom of cell
  projectionText: {
    color: theme.textDim,
    fontSize: 8,
    fontFamily: theme.fontPrimary,
    textAlign: 'right',
  },
  dotRed: { backgroundColor: theme.calendarBillColor },
  dotGreen: { backgroundColor: theme.calendarIncomeColor },
  dotBlue: { backgroundColor: theme.calendarTransactionColor },
  dotBusiness: { backgroundColor: theme.calendarBusinessColor },
  dotRecurring: { backgroundColor: theme.calendarRecurringColor },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacingXS,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  legendText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundCard,
  },
  legendPillOff: {
    opacity: 0.45,
    backgroundColor: theme.backgroundSecondary,
  },
  legendDotOff: {
    backgroundColor: theme.textDim,
  },
  legendTextOff: {
    color: theme.textDim,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.overlayBg,
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderColor: theme.borderColor,
    borderTopLeftRadius: theme.borderRadiusLG,
    borderTopRightRadius: theme.borderRadiusLG,
    paddingHorizontal: theme.spacingMD,
    paddingTop: theme.spacingSM,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.borderColor,
    marginBottom: theme.spacingSM,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    marginBottom: theme.spacingSM,
  },
  sheetTitle: {
    flex: 1,
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  closeText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingBottom: theme.spacingMD,
    gap: theme.spacingSM,
  },
  sheetCard: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
  },
  cardTitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingSM,
    letterSpacing: 1,
  },
  emptyText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  eventRow: {
    paddingVertical: theme.spacingSM,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  eventText: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  eventMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
    paddingVertical: theme.spacingSM,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  balanceLabelCol: {
    flex: 1,
  },
  balanceLabel: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  groceryReserveLine: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  greenBalance: {
    color: theme.statusPositive,
  },
  yellowBalance: {
    color: theme.statusWarning,
  },
  redBalance: {
    color: theme.statusDanger,
  },
  scheduleNote: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
  },
  dotGrocery: { backgroundColor: theme.calendarGroceryColor },
  dotGroceryDanger: { backgroundColor: theme.calendarGroceryDangerColor },
  groceryToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingXS,
    gap: theme.spacingSM,
  },
  groceryToggleLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  toggleBtn: {
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
  },
  toggleBtnActive: {
    borderColor: theme.accent,
  },
  toggleBtnText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  toggleBtnTextActive: {
    color: theme.accent,
  },
});
