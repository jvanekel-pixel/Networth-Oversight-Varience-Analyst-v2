import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import useStore from '../store/useStore';
import theme from '../config/theme.config';
import { formatCentsShort } from '../utils/currency';
import LogMassageIncomeModal from '../components/modals/LogMassageIncomeModal';
import LogMassageExpenseModal from '../components/modals/LogMassageExpenseModal';
import MassageRecentActivity from '../components/MassageRecentActivity';

export default function MassageScreen({ navigation }) {
  const massageIncome = useStore((s) => s.massageIncome);
  const massageExpenses = useStore((s) => s.massageExpenses);
  const logMassageIncome = useStore((s) => s.logMassageIncome);
  const logMassageExpense = useStore((s) => s.logMassageExpense);
  const editMassageIncome = useStore((s) => s.editMassageIncome);
  const deleteMassageIncome = useStore((s) => s.deleteMassageIncome);
  const editMassageExpense = useStore((s) => s.editMassageExpense);
  const deleteMassageExpense = useStore((s) => s.deleteMassageExpense);

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const incomeThisMonth = (massageIncome || [])
    .filter((r) => !r.deleted && new Date(r.date).getMonth() === currentMonth && new Date(r.date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + (r.amountCents || 0), 0);

  const incomeAllTime = (massageIncome || [])
    .filter((r) => !r.deleted)
    .reduce((sum, r) => sum + (r.amountCents || 0), 0);

  const expensesThisMonth = (massageExpenses || [])
    .filter((r) => !r.deleted && new Date(r.date).getMonth() === currentMonth && new Date(r.date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + (r.amountCents || 0), 0);

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
          Alert.alert('Delete Income?', 'This will reverse the balance from the destination account.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMassageIncome(record.id) },
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
            { text: 'Delete', style: 'destructive', onPress: () => deleteMassageExpense(record.id) },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleIncomeConfirm = (record) => {
    if (editingIncome) {
      editMassageIncome(editingIncome.id, record);
    } else {
      logMassageIncome(record);
    }
  };

  const handleExpenseConfirm = (record) => {
    if (editingExpense) {
      editMassageExpense(editingExpense.id, record);
    } else {
      logMassageExpense(record);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>MASSAGE</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Income This Month</Text>
            <Text style={[styles.summaryValue, { color: theme.statusPositive }]}>{formatCentsShort(incomeThisMonth)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>All-Time Income</Text>
            <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{formatCentsShort(incomeAllTime)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expenses This Month</Text>
            <Text style={[styles.summaryValue, { color: theme.statusDanger }]}>{formatCentsShort(expensesThisMonth)}</Text>
          </View>
        </View>

        <MassageRecentActivity
          incomeEntries={massageIncome}
          expenseEntries={massageExpenses}
          onLongPressIncome={handleIncomeLongPress}
          onLongPressExpense={handleExpenseLongPress}
        />

        <TouchableOpacity style={[styles.button, { marginTop: 24 }]} onPress={() => { setEditingIncome(null); setShowIncomeModal(true); }}>
          <Text style={styles.buttonText}>LOG INCOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { setEditingExpense(null); setShowExpenseModal(true); }}>
          <Text style={styles.buttonText}>LOG EXPENSE</Text>
        </TouchableOpacity>
      </ScrollView>

      <LogMassageIncomeModal
        visible={showIncomeModal}
        entry={editingIncome}
        onClose={() => { setShowIncomeModal(false); setEditingIncome(null); }}
        onConfirm={handleIncomeConfirm}
      />
      <LogMassageExpenseModal
        visible={showExpenseModal}
        entry={editingExpense}
        onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
        onConfirm={handleExpenseConfirm}
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
