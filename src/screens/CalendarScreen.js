import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert,
} from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { getBillEventsBetween, getIncomeEventsBetween, projectBalance } from '../utils/forecasting';
import { EditBillModal, EditTransactionModal } from '../components/TransactionModal';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CELL_SIZE = Math.floor(Dimensions.get('window').width / 7);

function isSameDayMs(ms1, ms2) {
  const a = new Date(ms1);
  const b = new Date(ms2);
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CalendarScreen({ navigation }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [editingBill, setEditingBill] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

  const { accounts, accountFloors, householdBills, personalBills, incomeEvents, transactions, editBill, deleteBill, editTransaction, accountRegistry, novaConfig } = useStore();
  const userMode = novaConfig?.userMode ?? null;
  const householdAccount = (accountRegistry || []).find(a => a.isActive !== false && a.role === 'household');
  const householdAccountKey = householdAccount ? (householdAccount.legacyKey || householdAccount.id) : null;
  const allBills = useMemo(() => [...(householdBills || []), ...(personalBills || [])], [householdBills, personalBills]);

  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999);
  const startMs = monthStart.getTime();
  const endMs = monthEnd.getTime();

  const billEvents = useMemo(() => getBillEventsBetween(allBills, startMs, endMs), [allBills, startMs, endMs]);
  const incomeEvts = useMemo(() => getIncomeEventsBetween(incomeEvents, startMs, endMs, accountRegistry, userMode), [incomeEvents, startMs, endMs, accountRegistry, userMode]);

  const monthTx = useMemo(() => (transactions || []).filter(t => !t.deleted && t.timestamp >= startMs && t.timestamp <= endMs), [transactions, startMs, endMs]);

  // Compute which bill-event days need red background (low balance projection)
  const householdFloor = householdAccountKey ? (accountFloors?.[householdAccountKey] ?? 0) : 0;
  const redDays = useMemo(() => {
    const days = new Set();
    if (!householdAccountKey) return days;
    for (const evt of billEvents) {
      if (evt.accountKey === householdAccountKey) {
        const { projectedBalance } = projectBalance({
          currentBalance: accounts[householdAccountKey] || 0,
          accountKey: householdAccountKey,
          targetDateMs: evt.dateMs,
          bills: allBills,
          incomeEvents,
          accountRegistry,
          userMode,
        });
        if (projectedBalance < householdFloor) days.add(evt.dateMs);
      }
    }
    return days;
  }, [billEvents, accounts, allBills, incomeEvents, householdFloor, householdAccountKey, accountRegistry, userMode]);

  // Build grid cells
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

  const selectedBillEvts = billEvents.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedIncomeEvts = incomeEvts.filter(e => isSameDayMs(e.dateMs, selectedMs));
  const selectedTxEvts = monthTx.filter(t => isSameDayMs(t.timestamp, selectedMs));

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
  };

  const isToday = (dayNum) =>
    dayNum === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();

  const hasBillDot = (cellMs) => cellMs && billEvents.some(e => isSameDayMs(e.dateMs, cellMs));
  const hasIncomeDot = (cellMs) => cellMs && incomeEvts.some(e => isSameDayMs(e.dateMs, cellMs));
  const hasTxDot = (cellMs) => cellMs && monthTx.some(t => isSameDayMs(t.timestamp, cellMs));
  const isRedDay = (cellMs) => cellMs && [...redDays].some(d => isSameDayMs(d, cellMs));

  const currentMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ BACK</Text>
      </TouchableOpacity>

      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{headerLabel}</Text>
        <TouchableOpacity onPress={goToday} style={styles.todayBtn}>
          <Text style={styles.todayText}>TODAY</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day of week row */}
      <View style={styles.dowRow}>
        {DAYS.map(d => (
          <View key={d} style={styles.dowCell}>
            <Text style={styles.dowText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          const todayCell = cell.inMonth && isToday(cell.dayNum);
          const selectedCell = cell.inMonth && cell.dayNum === selectedDay;
          const redBg = cell.inMonth && isRedDay(cell.cellMs);
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.cell,
                todayCell && styles.todayCell,
                selectedCell && styles.selectedCell,
                redBg && styles.redCell,
              ]}
              onPress={() => cell.inMonth && setSelectedDay(cell.dayNum)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cellDay, !cell.inMonth && styles.cellDayDim]}>
                {cell.inMonth ? cell.dayNum : ''}
              </Text>
              <View style={styles.dotsRow}>
                {cell.inMonth && hasBillDot(cell.cellMs) && <View style={[styles.dot, styles.dotRed]} />}
                {cell.inMonth && hasIncomeDot(cell.cellMs) && <View style={[styles.dot, styles.dotGreen]} />}
                {cell.inMonth && hasTxDot(cell.cellMs) && <View style={[styles.dot, styles.dotBlue]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day panel */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.panelHeader}>{selectedLabel}</Text>

        {selectedBillEvts.length === 0 && selectedIncomeEvts.length === 0 && selectedTxEvts.length === 0 && (
          <Text style={styles.nothingText}>Nothing scheduled</Text>
        )}

        {selectedBillEvts.map((evt, i) => {
          const bill = allBills.find(b => b.id === evt.billId);
          const paidThisMonth = bill?.lastPaidMonth === currentMonth;
          const label = paidThisMonth
            ? `🔴 ${evt.billName} — PAID ${formatCentsShort(evt.amountCents)} on ${formatDate(bill?.lastPaidDate || Date.now())}`
            : `🔴 ${evt.billName} — ${formatCentsShort(evt.amountCents)} — UNPAID`;
          return (
            <TouchableOpacity key={`b${i}`} style={styles.eventRow} onPress={() => bill && setEditingBill(bill)}>
              <Text style={styles.eventText}>{label}</Text>
            </TouchableOpacity>
          );
        })}

        {selectedIncomeEvts.map((evt, i) => {
          const sourceLabel = evt.source === 'operator_paycheck' ? 'Paycheck' : 'Partner Deposit';
          return (
            <TouchableOpacity
              key={`i${i}`}
              style={styles.eventRow}
              onPress={() => Alert.alert('Income event editing coming in V2')}
            >
              <Text style={styles.eventText}>
                🟢 {sourceLabel} — {formatCentsShort(evt.amountCents)} (expected)
              </Text>
            </TouchableOpacity>
          );
        })}

        {selectedTxEvts.map((tx, i) => {
          const desc = (tx.description || '').slice(0, 30) || tx.category || 'Transaction';
          return (
            <TouchableOpacity key={`t${i}`} style={styles.eventRow} onPress={() => setEditingTx(tx)}>
              <Text style={styles.eventText}>
                🔵 {desc} — {formatCentsShort(tx.amountCents)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <EditBillModal
        visible={editingBill !== null}
        bill={editingBill}
        accountOptions={[
          { key: 'jointChecking', label: 'JOINT CHECKING' },
          { key: 'entChecking', label: 'ENT CHECKING' },
          { key: 'venmo', label: 'VENMO' },
          { key: 'cash', label: 'CASH' },
        ]}
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
  redCell: {
    backgroundColor: theme.statusDangerBg,
  },
  cellDay: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  cellDayDim: {
    color: theme.textDim,
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
  dotRed:   { backgroundColor: theme.statusDanger },
  dotGreen: { backgroundColor: theme.statusPositive },
  dotBlue:  { backgroundColor: theme.calendarBillColor },
  panel: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  panelContent: {
    padding: theme.spacingMD,
    paddingBottom: theme.spacingXXL,
  },
  panelHeader: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingMD,
  },
  nothingText: {
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
});
