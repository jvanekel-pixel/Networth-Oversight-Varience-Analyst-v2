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

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CELL_SIZE = Math.floor(Dimensions.get('window').width / 7);
const FIXED_ACCOUNT_FLOORS = {
  jointChecking: 30000,
  entChecking: 500000,
};

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

function getTimestamp(record) {
  return record?.timestamp || record?.date || record?.createdAt || null;
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

function getModeAccountRoles(mode) {
  if (mode === 'household') return ['household'];
  if (mode === 'personal') return ['personal'];
  if (mode === 'business') return ['business'];
  return null;
}

function getFallbackProjection(accounts = {}) {
  return {
    jointChecking: accounts.jointChecking || 0,
    entChecking: accounts.entChecking || 0,
    entSavings: accounts.entSavings || 0,
    venmo: accounts.venmo || 0,
    cash: accounts.cash || 0,
    cleaningChecking: accounts.cleaningChecking || 0,
    ...accounts,
  };
}

function getPrimaryProjectionKey(mode, activeAccounts = []) {
  if (mode === 'personal') {
    const personal = activeAccounts.find(account => account.role === 'personal');
    return getAccountKey(personal) || 'entChecking';
  }
  if (mode === 'business') {
    const business = activeAccounts.find(account => account.role === 'business');
    return getAccountKey(business) || 'cleaningChecking';
  }
  const household = activeAccounts.find(account => account.role === 'household');
  return getAccountKey(household) || 'jointChecking';
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
  const [groceryReserveOn, setGroceryReserveOn] = useState(true);

  const mode = modeProp || route?.params?.mode || 'dashboard';

  const {
    accounts,
    householdBills,
    personalBills,
    incomeEvents,
    transactions,
    massageIncome,
    massageExpenses,
    cleaningIncome,
    cleaningExpenses,
    cleaningMileage,
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
  } = useStore();

  const userMode = novaConfig?.userMode ?? null;
  const activeAccounts = useMemo(
    () => (accountRegistry || []).filter(a => a.isActive !== false),
    [accountRegistry],
  );
  const groceryAccountKey = useMemo(() => {
    if (userMode === 'solo') {
      const personal = activeAccounts.find(a => a.role === 'personal');
      return getAccountKey(personal) || 'entChecking';
    }
    const household = activeAccounts.find(a => a.role === 'household');
    return getAccountKey(household) || 'jointChecking';
  }, [userMode, activeAccounts]);
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

  const modeRoles = getModeAccountRoles(mode);
  const modeAccountKeys = useMemo(() => {
    if (!modeRoles) return null;
    return new Set(activeAccounts
      .filter(account => modeRoles.includes(account.role))
      .map(getAccountKey)
      .filter(Boolean));
  }, [activeAccounts, modeRoles]);

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
    massageIncome || [],
    [],
    accountRegistry || [],
    novaConfig || {},
    userMode,
  ), [accounts, householdBills, personalBills, incomeEvents, massageIncome, accountRegistry, novaConfig, userMode, todayStart.getTime(), projectionEnd.getTime()]);

  const billEvents = useMemo(() => {
    const activeHousehold = (householdBills || []).filter(activeBillFilter);
    const activePersonal = (personalBills || []).filter(activeBillFilter);
    const householdEvents = applyBillFallback(getBillEventsBetween(activeHousehold, startMs, endMs), getPrimaryProjectionKey('household', activeAccounts));
    const personalEvents = applyBillFallback(getBillEventsBetween(activePersonal, startMs, endMs), getPrimaryProjectionKey('personal', activeAccounts));

    if (mode === 'household') return householdEvents;
    if (mode === 'personal') return personalEvents;
    if (mode === 'business') return [];
    return [...householdEvents, ...personalEvents];
  }, [householdBills, personalBills, startMs, endMs, mode, activeAccounts]);
  const incomeEvts = useMemo(() => {
    if (mode === 'business') return [];
    const events = getIncomeEventsBetween(incomeEvents, startMs, endMs, accountRegistry, userMode, novaConfig);
    if (!modeAccountKeys) return events;
    return events.filter(evt => modeAccountKeys.has(evt.accountKey));
  }, [incomeEvents, startMs, endMs, accountRegistry, userMode, novaConfig, modeAccountKeys, mode]);

  const monthTx = useMemo(() => (transactions || [])
    .filter(t => mode === 'dashboard' && !t.deleted && t.timestamp >= startMs && t.timestamp <= endMs), [transactions, startMs, endMs, mode]);

  const businessEvts = useMemo(() => {
    if (mode !== 'dashboard' && mode !== 'business') return [];
    return [
      ...normalizeBusinessEvents(massageIncome, 'massage_income', 'Massage'),
      ...normalizeBusinessEvents(massageExpenses, 'massage_expense', 'Massage'),
      ...normalizeBusinessEvents(cleaningIncome, 'cleaning_income', 'Cleaning'),
      ...normalizeBusinessEvents(cleaningExpenses, 'cleaning_expense', 'Cleaning'),
      ...normalizeBusinessEvents(cleaningMileage, 'mileage', 'Cleaning'),
      ...normalizeBusinessEvents(genericBusinessIncome, 'business_income'),
      ...normalizeBusinessEvents(genericBusinessExpenses, 'business_expense'),
      ...normalizeBusinessEvents(genericBusinessMileage, 'business_mileage'),
    ].filter(evt => evt.dateMs >= startMs && evt.dateMs <= endMs);
  }, [
    mode,
    massageIncome,
    massageExpenses,
    cleaningIncome,
    cleaningExpenses,
    cleaningMileage,
    genericBusinessIncome,
    genericBusinessExpenses,
    genericBusinessMileage,
    startMs,
    endMs,
  ]);

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
  const selectedProjection = projectedBalances.get(selectedKey) || getFallbackProjection(accounts || {});

  const selectedBillEvts = billEvents.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedIncomeEvts = incomeEvts.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedTxEvts = monthTx.filter(t => isSameDayMs(t.timestamp, selectedMs));
  const selectedBusinessEvts = businessEvts.filter(e => isSameDayMs(e.dateMs, selectedMs));

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

  const getProjectionForCell = (cellMs) => {
    if (!cellMs) return null;
    return projectedBalances.get(dateKeyFromMs(cellMs)) || null;
  };

  const getCellRiskStyle = (projection, cellMs) => {
    if (!projection) return null;
    const key = getPrimaryProjectionKey(mode, activeAccounts);
    const floor = accountFloors?.[key] ?? FIXED_ACCOUNT_FLOORS[key] ?? 0;
    const balance = projection[key] || 0;
    if (balance < 0) return styles.redProjectionCell;
    let checkBalance = balance;
    if (groceryReserveOn && cellMs && key === groceryAccountKey && groceryBudget) {
      checkBalance = balance - getGroceryReserveForDate({ targetDateMs: cellMs, groceryBudget });
    }
    if (floor > 0 && checkBalance < floor) return styles.yellowProjectionCell;
    return null;
  };

  const getGroceryDotColor = (cellMs) => {
    if (!groceryReserveOn || !cellMs || !groceryBudget) return null;
    const d = new Date(cellMs);
    if (d.getDay() !== 0) return null;
    const weeklyLimit = groceryBudget?.weeklyLimit || 0;
    if (weeklyLimit <= 0) return null;
    const nowMs = now.getTime();
    const currentWeekStart = getCurrentWeekStart(nowMs);
    const cellWeekStart = getCurrentWeekStart(cellMs);
    if (cellWeekStart < currentWeekStart) return null;
    if (cellWeekStart === currentWeekStart) {
      return (groceryBudget?.currentWeekSpend || 0) > weeklyLimit ? 'danger' : 'accent';
    }
    return 'accent';
  };

  const openDay = (dayNum) => {
    setSelectedDay(dayNum);
    setSheetVisible(true);
  };

  const currentMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const hasScheduledActivity = selectedBillEvts.length > 0 ||
    selectedIncomeEvts.length > 0 ||
    selectedTxEvts.length > 0 ||
    selectedBusinessEvts.length > 0;

  const touchedAccounts = useMemo(() => {
    const keys = new Set();
    selectedBillEvts.forEach(evt => {
      const bill = allBills.find(b => b.id === evt.billId);
      const key = evt.accountKey || bill?.accountKey || bill?.defaultAccountKey;
      if (key) keys.add(key);
    });
    selectedIncomeEvts.forEach(evt => evt.accountKey && keys.add(evt.accountKey));
    selectedTxEvts.forEach(tx => tx.accountKey && keys.add(tx.accountKey));
    return keys;
  }, [selectedBillEvts, selectedIncomeEvts, selectedTxEvts, allBills]);

  const balanceRows = useMemo(() => {
    if (!selectedProjection) return [];
    let keys;
    if (mode === 'household') {
      const householdKeys = activeAccounts
        .filter(account => account.role === 'household')
        .map(getAccountKey)
        .filter(Boolean);
      keys = new Set(householdKeys.length > 0 ? householdKeys.slice(0, 1) : ['jointChecking']);
    } else if (mode === 'personal') {
      const configuredPersonal = activeAccounts
        .filter(account => account.role === 'personal')
        .map(getAccountKey)
        .filter(Boolean);
      const legacyPersonal = ['entChecking', 'entSavings', 'venmo', 'cash']
        .filter(key => configuredPersonal.length === 0 && (Object.prototype.hasOwnProperty.call(selectedProjection, key) || touchedAccounts.has(key)));
      keys = new Set(configuredPersonal.length > 0 ? configuredPersonal : legacyPersonal);
    } else if (mode === 'business') {
      keys = new Set(['cleaningChecking']);
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
        if (mode === 'business') return key === 'cleaningChecking';
        if (mode === 'household' || mode === 'personal') return true;
        if (key === 'cleaningChecking') return balance !== 0;
        return balance !== 0 || touchedAccounts.has(key);
      })
      .map(key => {
        const balance = selectedProjection[key] || 0;
        const floor = accountFloors?.[key] ?? FIXED_ACCOUNT_FLOORS[key] ?? 0;
        const state = balance < floor
          ? 'red'
          : floor > 0 && balance <= Math.ceil(floor * 1.2)
            ? 'yellow'
            : 'green';
        const groceryReserve = groceryReserveOn && key === groceryAccountKey && groceryBudget
          ? getGroceryReserveForDate({ targetDateMs: selectedMs, groceryBudget })
          : 0;
        return { key, label: accountLabel(key), balance, state, groceryReserve, availableAfterGrocery: balance - groceryReserve };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedProjection, activeAccounts, touchedAccounts, accountByKey, accountFloors, mode, groceryReserveOn, groceryAccountKey, groceryBudget, selectedMs]);

  const businessLabel = (evt) => {
    const label = evt.businessLabel || businessById.get(evt.businessId) || 'Business';
    if (evt.type === 'massage_income' || evt.type === 'cleaning_income' || evt.type === 'business_income') {
      return `${label} income - ${formatCentsShort(evt.amountCents || 0)}`;
    }
    if (evt.type === 'massage_expense' || evt.type === 'cleaning_expense' || evt.type === 'business_expense') {
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

      <View style={styles.groceryToggleRow}>
        <Text style={styles.groceryToggleLabel}>Grocery Reserve</Text>
        <TouchableOpacity
          style={[styles.toggleBtn, groceryReserveOn && styles.toggleBtnActive]}
          onPress={() => setGroceryReserveOn(v => !v)}
        >
          <Text style={[styles.toggleBtnText, groceryReserveOn && styles.toggleBtnTextActive]}>
            {groceryReserveOn ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dowRow}>
        {DAYS.map(d => (
          <View key={d} style={styles.dowCell}>
            <Text style={styles.dowText}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          const todayCell = cell.inMonth && isToday(cell.dayNum);
          const selectedCell = cell.inMonth && cell.dayNum === selectedDay;
          const projection = getProjectionForCell(cell.cellMs);
          const projectionKey = getPrimaryProjectionKey(mode, activeAccounts);
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
              <View>
                <Text style={[styles.cellDay, !cell.inMonth && styles.cellDayDim]}>
                  {cell.inMonth ? cell.dayNum : ''}
                </Text>
                {cell.inMonth && projection && (
                  <Text style={styles.projectionText} numberOfLines={1}>
                    {formatCentsShort(projection[projectionKey] || 0)}
                  </Text>
                )}
              </View>
              <View style={styles.dotsRow}>
                {cell.inMonth && hasBillDot(cell.cellMs) && <View style={[styles.dot, styles.dotRed]} />}
                {cell.inMonth && hasIncomeDot(cell.cellMs) && <View style={[styles.dot, styles.dotGreen]} />}
                {cell.inMonth && hasTxDot(cell.cellMs) && <View style={[styles.dot, styles.dotBlue]} />}
                {cell.inMonth && hasBusinessDot(cell.cellMs) && <View style={[styles.dot, styles.dotBusiness]} />}
                {cell.inMonth && (() => {
                  const gc = getGroceryDotColor(cell.cellMs);
                  return gc ? <View style={[styles.dot, gc === 'danger' ? styles.dotGroceryDanger : styles.dotGrocery]} /> : null;
                })()}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={[styles.dot, styles.dotRed]} /><Text style={styles.legendText}>Bills</Text>
        <View style={[styles.dot, styles.dotGreen]} /><Text style={styles.legendText}>Income</Text>
        <View style={[styles.dot, styles.dotBlue]} /><Text style={styles.legendText}>Transactions</Text>
        <View style={[styles.dot, styles.dotBusiness]} /><Text style={styles.legendText}>Business</Text>
        {groceryReserveOn && (groceryBudget?.weeklyLimit || 0) > 0 && (
          <>
            <View style={[styles.dot, styles.dotGrocery]} />
            <Text style={styles.legendText}>Grocery reserve</Text>
          </>
        )}
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
                  return (
                    <TouchableOpacity
                      key={`b${i}`}
                      style={styles.eventRow}
                      onPress={() => { setSheetVisible(false); if (bill) setEditingBill(bill); }}
                    >
                      <Text style={styles.eventText}>{evt.billName} - {formatCentsShort(evt.amountCents)}</Text>
                      <Text style={styles.eventMeta}>
                        from: {accountLabel(sourceAccountKey)}{paidThisMonth ? ` - paid ${formatDate(bill?.lastPaidDate || Date.now())}` : ''}
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
                    <Text style={styles.eventMeta}>business activity</Text>
                  </View>
                ))}

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
                <Text style={styles.cardTitle}>Projected Balances - {selectedLabel}</Text>
                {balanceRows.length === 0 && (
                  <Text style={styles.emptyText}>No projected balances available</Text>
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
                {mode === 'business' && (
                  <Text style={styles.scheduleNote}>cleaningChecking uses current balance. No recurring business schedule configured.</Text>
                )}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <EditBillModal
        visible={editingBill !== null}
        bill={editingBill}
        accountOptions={activeAccounts
          .map(a => ({ key: getAccountKey(a), label: (a.name || a.id).toUpperCase() }))
          .filter(option => option.key)}
        onSubmit={async (updates) => { await editBill(editingBill.id, updates); setEditingBill(null); }}
        onDelete={() => { deleteBill(editingBill.id); setEditingBill(null); }}
        onClose={() => setEditingBill(null)}
      />
      <EditTransactionModal
        visible={editingTx !== null}
        transaction={editingTx}
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
  cellDay: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  cellDayDim: {
    color: theme.textDim,
  },
  projectionText: {
    color: theme.textDim,
    fontSize: 8,
    fontFamily: theme.fontPrimary,
    marginTop: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    margin: 1,
  },
  dotRed: { backgroundColor: theme.statusDanger },
  dotGreen: { backgroundColor: theme.statusPositive },
  dotBlue: { backgroundColor: theme.calendarBillColor },
  dotBusiness: { backgroundColor: theme.calendarBusinessColor },
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
    marginRight: theme.spacingSM,
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
  dotGrocery: { backgroundColor: theme.accent },
  dotGroceryDanger: { backgroundColor: theme.statusDanger },
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
