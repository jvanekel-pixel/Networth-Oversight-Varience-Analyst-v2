import React, { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import useStore from '../store/useStore';
import theme from '../config/theme.config';
import { formatCentsShort } from '../utils/currency';
import LogCleaningExpenseModal from '../components/modals/LogCleaningExpenseModal';
import LogCleaningMileageModal from '../components/modals/LogCleaningMileageModal';

export default function CleaningScreen({ navigation }) {
  const cleaningExpenses = useStore((s) => s.cleaningExpenses);
  const cleaningMileage = useStore((s) => s.cleaningMileage);
  const logCleaningExpense = useStore((s) => s.logCleaningExpense);
  const logCleaningMileage = useStore((s) => s.logCleaningMileage);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [categoryExpanded, setCategoryExpanded] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const activeExpenses = (cleaningExpenses || []).filter((r) => !r.deleted);
  const activeMileage = (cleaningMileage || []).filter((r) => !r.deleted);

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

  const sortedExpenses = [...activeExpenses].sort((a, b) => b.date - a.date);
  const sortedMileage = [...activeMileage].sort((a, b) => b.date - a.date);

  const handleExpenseLongPress = (record) => {
    Alert.alert('Expense Record', '', [
      { text: 'Edit', onPress: () => {} },
      { text: 'Delete', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMileageLongPress = (record) => {
    Alert.alert('Mileage Record', '', [
      { text: 'Edit', onPress: () => {} },
      { text: 'Delete', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>CLEANING LLC</Text>

        <View style={styles.summaryCard}>
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

        <Text style={styles.sectionHeader}>MILEAGE</Text>
        <FlatList
          data={sortedMileage}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onLongPress={() => handleMileageLongPress(item)}>
              <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={styles.rowMeta}>{(item.miles || 0).toFixed(1)} mi</Text>
              <Text style={[styles.rowAmount, { color: theme.statusPositive }]}>{formatCentsShort(item.deductionCents)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No mileage logged</Text>}
        />

        <TouchableOpacity style={styles.categoryHeader} onPress={() => setCategoryExpanded(!categoryExpanded)}>
          <Text style={styles.sectionHeader}>BY CATEGORY</Text>
          <Text style={styles.chevron}>{categoryExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {categoryExpanded && Object.entries(categoryTotals).map(([cat, total]) => (
          <View key={cat} style={styles.row}>
            <Text style={[styles.rowMeta, { flex: 1 }]}>{cat}</Text>
            <Text style={[styles.rowAmount, { color: theme.statusDanger }]}>{formatCentsShort(total)}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.button} onPress={() => setShowExpenseModal(true)}>
          <Text style={styles.buttonText}>LOG EXPENSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setShowMileageModal(true)}>
          <Text style={styles.buttonText}>LOG MILEAGE</Text>
        </TouchableOpacity>
      </ScrollView>

      <LogCleaningExpenseModal
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onConfirm={(record) => logCleaningExpense(record)}
      />
      <LogCleaningMileageModal
        visible={showMileageModal}
        onClose={() => setShowMileageModal(false)}
        onConfirm={(record) => logCleaningMileage(record)}
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
