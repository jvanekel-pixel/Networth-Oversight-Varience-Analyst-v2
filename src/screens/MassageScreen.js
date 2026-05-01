import React, { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import useStore from '../store/useStore';
import theme from '../config/theme.config';
import { formatCentsShort } from '../utils/currency';
import LogMassageIncomeModal from '../components/modals/LogMassageIncomeModal';
import LogMassageExpenseModal from '../components/modals/LogMassageExpenseModal';

export default function MassageScreen({ navigation }) {
  const massageIncome = useStore((s) => s.massageIncome);
  const massageExpenses = useStore((s) => s.massageExpenses);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

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

  const sortedIncome = [...(massageIncome || [])]
    .filter((r) => !r.deleted)
    .sort((a, b) => b.date - a.date);

  const sortedExpenses = [...(massageExpenses || [])]
    .filter((r) => !r.deleted)
    .sort((a, b) => b.date - a.date);

  const handleIncomeLongPress = (record) => {
    Alert.alert('Income Record', '', [
      { text: 'Edit', onPress: () => setSelectedRecord(record) },
      { text: 'Delete', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleExpenseLongPress = (record) => {
    Alert.alert('Expense Record', '', [
      { text: 'Edit', onPress: () => setSelectedRecord(record) },
      { text: 'Delete', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

        <Text style={styles.sectionHeader}>INCOME</Text>
        <FlatList
          data={sortedIncome}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onLongPress={() => handleIncomeLongPress(item)}>
              <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={[styles.rowAmount, { color: theme.statusPositive }]}>{formatCentsShort(item.amountCents)}</Text>
              <Text style={styles.rowMeta}>{item.paymentMethod}</Text>
              <Text style={styles.rowMeta}>{item.destinationAccount}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No income logged</Text>}
        />

        <Text style={styles.sectionHeader}>EXPENSES</Text>
        <FlatList
          data={sortedExpenses}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onLongPress={() => handleExpenseLongPress(item)}>
              <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={[styles.rowAmount, { color: theme.statusDanger }]}>{formatCentsShort(item.amountCents)}</Text>
              <Text style={styles.rowMeta}>{item.category}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No expenses logged</Text>}
        />

        <TouchableOpacity style={styles.button} onPress={() => setShowIncomeModal(true)}>
          <Text style={styles.buttonText}>LOG INCOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setShowExpenseModal(true)}>
          <Text style={styles.buttonText}>LOG EXPENSE</Text>
        </TouchableOpacity>
      </ScrollView>

      <LogMassageIncomeModal
        visible={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        onConfirm={() => {}}
      />
      <LogMassageExpenseModal
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onConfirm={() => {}}
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
  sectionHeader: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    gap: 12,
  },
  rowDate: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, flex: 1 },
  rowAmount: { fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  rowMeta: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  emptyText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginHorizontal: 16, marginBottom: 8 },
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
