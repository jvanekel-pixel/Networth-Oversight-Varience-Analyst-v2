import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import { formatCentsShort } from '../utils/currency';

function fmt(ms) { return new Date(ms).toLocaleDateString(); }

export default function MassageRecentActivity({ incomeEntries, expenseEntries, onLongPressIncome, onLongPressExpense }) {
  const income = [...(incomeEntries || [])].filter(r => !r.deleted).sort((a, b) => b.date - a.date);
  const expenses = [...(expenseEntries || [])].filter(r => !r.deleted).sort((a, b) => b.date - a.date);

  return (
    <View>
      <Text style={styles.sectionHeader}>INCOME</Text>
      {income.length === 0
        ? <Text style={styles.empty}>No income logged</Text>
        : income.map(item => (
          <TouchableOpacity key={item.id} style={styles.row} onLongPress={() => onLongPressIncome(item)} delayLongPress={400}>
            <Text style={styles.date}>{fmt(item.date)}</Text>
            <Text style={[styles.amount, { color: theme.statusPositive }]}>{formatCentsShort(item.amountCents)}</Text>
            <Text style={styles.meta}>{item.paymentMethod}</Text>
          </TouchableOpacity>
        ))}

      <Text style={styles.sectionHeader}>EXPENSES</Text>
      {expenses.length === 0
        ? <Text style={styles.empty}>No expenses logged</Text>
        : expenses.map(item => (
          <TouchableOpacity key={item.id} style={styles.row} onLongPress={() => onLongPressExpense(item)} delayLongPress={400}>
            <Text style={styles.date}>{fmt(item.date)}</Text>
            <Text style={[styles.amount, { color: theme.statusDanger }]}>-{formatCentsShort(item.amountCents)}</Text>
            <Text style={styles.meta}>{item.category}</Text>
          </TouchableOpacity>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginHorizontal: 16,
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
  date: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    flex: 1,
  },
  amount: {
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  meta: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
});
