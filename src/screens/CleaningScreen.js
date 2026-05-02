import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import useStore from '../store/useStore';
import theme from '../config/theme.config';
import { formatCentsShort } from '../utils/currency';
import LogCleaningExpenseModal from '../components/modals/LogCleaningExpenseModal';
import LogCleaningMileageModal from '../components/modals/LogCleaningMileageModal';
import LogCleaningIncomeModal from '../components/modals/LogCleaningIncomeModal';
import CleaningRecentActivity from '../components/CleaningRecentActivity';

export default function CleaningScreen({ navigation }) {
  const cleaningIncome = useStore((s) => s.cleaningIncome);
  const cleaningExpenses = useStore((s) => s.cleaningExpenses);
  const cleaningMileage = useStore((s) => s.cleaningMileage);
  const accounts = useStore((s) => s.accounts);
  const logCleaningIncome = useStore((s) => s.logCleaningIncome);
  const editCleaningIncome = useStore((s) => s.editCleaningIncome);
  const deleteCleaningIncome = useStore((s) => s.deleteCleaningIncome);
  const logCleaningExpense = useStore((s) => s.logCleaningExpense);
  const editCleaningExpense = useStore((s) => s.editCleaningExpense);
  const deleteCleaningExpense = useStore((s) => s.deleteCleaningExpense);
  const logCleaningMileage = useStore((s) => s.logCleaningMileage);
  const editCleaningMileage = useStore((s) => s.editCleaningMileage);
  const deleteCleaningMileage = useStore((s) => s.deleteCleaningMileage);
  const irsRatePerMile = useStore((s) => s.irsRatePerMile);

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingMileage, setEditingMileage] = useState(null);
  const [categoryExpanded, setCategoryExpanded] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const activeIncome = (cleaningIncome || []).filter((r) => !r.deleted);
  const activeExpenses = (cleaningExpenses || []).filter((r) => !r.deleted);
  const activeMileage = (cleaningMileage || []).filter((r) => !r.deleted);

  const incomeThisMonth = activeIncome
    .filter((r) => new Date(r.date).getMonth() === currentMonth && new Date(r.date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + (r.amountCents || 0), 0);

  const expensesThisMonth = activeExpenses
    .filter((r) => new Date(r.date).getMonth() === currentMonth && new Date(r.date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + (r.amountCents || 0), 0);

  const expensesAllTime = activeExpenses.reduce((sum, r) => sum + (r.amountCents || 0), 0);

  const mileageDeductionYTD = activeMileage
    .filter((r) => new Date(r.date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + (r.deductionCents || 0), 0);

  const categoryTotals = activeExpenses.reduce((acc, r) => {
    const cat = r.category || 'other';
    acc[cat] = (acc[cat] || 0) + (r.amountCents || 0);
    return acc;
  }, {});

  const handleIncomeLongPress = (record) => {
    Alert.alert('Income Record', `${formatCentsShort(record.amountCents)} — ${record.paymentMethod}`, [
      {
        text: 'Edit',
        onPress: () => { setEditingIncome(record); setShowIncomeModal(true); },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Income?', 'This will reverse the balance from Cleaning Checking.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteCleaningIncome(record.id) },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleExpenseLongPress = (record) => {
    Alert.alert('Expense Record', `${formatCentsShort(record.amountCents)} — ${record.category}`, [
      {
        text: 'Edit',
        onPress: () => { setEditingExpense(record); setShowExpenseModal(true); },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Expense?', 'Remove this expense record?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteCleaningExpense(record.id) },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMileageLongPress = (record) => {
    Alert.alert('Mileage Record', `${(record.miles || 0).toFixed(1)} mi — ${formatCentsShort(record.deductionCents)}`, [
      {
        text: 'Edit',
        onPress: () => { setEditingMileage(record); setShowMileageModal(true); },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Mileage?', 'Remove this mileage record?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteCleaningMileage(record.id) },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleIncomeConfirm = (record) => {
    if (editingIncome) {
      editCleaningIncome(editingIncome.id, record);
    } else {
      logCleaningIncome(record);
    }
  };

  const handleExpenseConfirm = (record) => {
    if (editingExpense) {
      editCleaningExpense(editingExpense.id, record);
    } else {
      logCleaningExpense(record);
    }
  };

  const handleMileageConfirm = (record) => {
    if (editingMileage) {
      editCleaningMileage(editingMileage.id, record);
    } else {
      logCleaningMileage(record);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>CLEANING LLC</Text>

        <View style={styles.accountCard}>
          <Text style={styles.accountLabel}>CLEANING CHECKING</Text>
          <Text style={styles.accountBalance}>{formatCentsShort(accounts.cleaningChecking || 0)}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Income This Month</Text>
            <Text style={[styles.summaryValue, { color: theme.statusPositive }]}>{formatCentsShort(incomeThisMonth)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expenses This Month</Text>
            <Text style={[styles.summaryValue, { color: theme.statusDanger }]}>{formatCentsShort(expensesThisMonth)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>All-Time Expenses</Text>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{formatCentsShort(expensesAllTime)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mileage Deduction YTD</Text>
            <Text style={[styles.summaryValue, { color: theme.statusPositive }]}>{formatCentsShort(mileageDeductionYTD)}</Text>
          </View>
        </View>

        <CleaningRecentActivity
          incomeEntries={cleaningIncome}
          expenseEntries={cleaningExpenses}
          mileageEntries={cleaningMileage}
          onLongPressIncome={handleIncomeLongPress}
          onLongPressExpense={handleExpenseLongPress}
          onLongPressMileage={handleMileageLongPress}
        />

        <TouchableOpacity style={styles.categoryHeader} onPress={() => setCategoryExpanded(!categoryExpanded)}>
          <Text style={styles.sectionHeader}>BY CATEGORY</Text>
          <Text style={styles.chevron}>{categoryExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {categoryExpanded && Object.entries(categoryTotals).map(([cat, total]) => (
          <View key={cat} style={styles.categoryRow}>
            <Text style={[styles.categoryMeta, { flex: 1 }]}>{cat}</Text>
            <Text style={[styles.categoryAmount, { color: theme.statusDanger }]}>{formatCentsShort(total)}</Text>
          </View>
        ))}

        <TouchableOpacity style={[styles.button, { marginTop: 24 }]} onPress={() => { setEditingIncome(null); setShowIncomeModal(true); }}>
          <Text style={styles.buttonText}>LOG INCOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { setEditingExpense(null); setShowExpenseModal(true); }}>
          <Text style={styles.buttonText}>LOG EXPENSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { setEditingMileage(null); setShowMileageModal(true); }}>
          <Text style={styles.buttonText}>LOG MILEAGE</Text>
        </TouchableOpacity>
      </ScrollView>

      <LogCleaningIncomeModal
        visible={showIncomeModal}
        entry={editingIncome}
        onClose={() => { setShowIncomeModal(false); setEditingIncome(null); }}
        onConfirm={handleIncomeConfirm}
      />
      <LogCleaningExpenseModal
        visible={showExpenseModal}
        entry={editingExpense}
        onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
        onConfirm={handleExpenseConfirm}
      />
      <LogCleaningMileageModal
        visible={showMileageModal}
        entry={editingMileage}
        irsRateCents={irsRatePerMile}
        onClose={() => { setShowMileageModal(false); setEditingMileage(null); }}
        onConfirm={handleMileageConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 32 },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: theme.backgroundCard,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  accountLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  accountBalance: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  summaryCard: {
    backgroundColor: theme.backgroundCard,
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
  },
  summaryValue: {
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  sectionHeader: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  chevron: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    marginTop: 16,
    marginRight: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    gap: 12,
  },
  categoryMeta: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  categoryAmount: { fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  buttonText: {
    color: theme.background,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
