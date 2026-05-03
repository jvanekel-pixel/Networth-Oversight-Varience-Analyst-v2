import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort, parseBillInput } from '../utils/currency';
import DatePickerField from '../components/DatePickerField';

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AddEntryModal({ visible, title, fields, onSubmit, onClose }) {
  const [values, setValues] = useState({});

  function handleClose() { setValues({}); onClose(); }
  function handleSubmit() {
    onSubmit(values);
    setValues({});
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {fields.map((f) => (
            <View key={f.key}>
              {f.type === 'date' ? (
                <DatePickerField
                  label={f.label}
                  value={values[f.key] || ''}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                />
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={values[f.key] || ''}
                    onChangeText={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder || ''}
                    placeholderTextColor={theme.textDim}
                    keyboardType={f.numeric ? 'decimal-pad' : 'default'}
                  />
                </>
              )}
            </View>
          ))}
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleSubmit} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BusinessDetailScreen({ route, navigation }) {
  const { businessId } = route.params || {};
  const businesses = useStore((s) => s.businesses);
  const massageIncome = useStore((s) => s.massageIncome);
  const massageExpenses = useStore((s) => s.massageExpenses);
  const cleaningIncome = useStore((s) => s.cleaningIncome);
  const cleaningExpenses = useStore((s) => s.cleaningExpenses);
  const cleaningMileage = useStore((s) => s.cleaningMileage);

  const biz = (businesses || []).find((b) => b.id === businessId);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  if (!biz) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Business not found.</Text>
      </View>
    );
  }

  const bizIncome = biz.id === 'biz_legacy_massage' ? massageIncome : cleaningIncome;
  const bizExpenses = biz.id === 'biz_legacy_massage' ? massageExpenses : cleaningExpenses;
  const bizMileage = biz.id === 'biz_legacy_cleaning' ? cleaningMileage : [];

  const activeIncome = (bizIncome || []).filter((r) => !r.deleted);
  const activeExpenses = (bizExpenses || []).filter((r) => !r.deleted);
  const activeMileage = (bizMileage || []).filter((r) => !r.deleted);

  const totalIncome = activeIncome.reduce((s, r) => s + (r.amountCents || 0), 0);
  const totalExpenses = activeExpenses.reduce((s, r) => s + (r.amountCents || 0), 0);
  const totalMileage = activeMileage.reduce((s, r) => s + (r.miles || 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isThisMonth = (r) => {
    const d = new Date(r.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const monthIncome = activeIncome.filter(isThisMonth).reduce((s, r) => s + (r.amountCents || 0), 0);
  const monthExpenses = activeExpenses.filter(isThisMonth).reduce((s, r) => s + (r.amountCents || 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{biz.name.toUpperCase()}</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>THIS MONTH</Text>
          <Text style={[styles.summaryAmt, { color: monthIncome - monthExpenses >= 0 ? theme.statusPositive : theme.statusDanger }]}>
            {monthIncome - monthExpenses >= 0 ? '+' : ''}{formatCentsShort(monthIncome - monthExpenses)}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>INCOME</Text>
          <Text style={[styles.summaryAmt, { color: theme.statusPositive }]}>{formatCentsShort(totalIncome)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>EXPENSES</Text>
          <Text style={[styles.summaryAmt, { color: theme.statusDanger }]}>{formatCentsShort(totalExpenses)}</Text>
        </View>
      </View>

      {biz.trackIncome && (
        <Section title="INCOME">
          <TouchableOpacity style={styles.addRowBtn} onPress={() => setShowIncomeModal(true)}>
            <Text style={styles.addRowBtnText}>+ ADD INCOME</Text>
          </TouchableOpacity>
          {activeIncome.slice(0, 10).map((r, i) => (
            <View key={r.id || i} style={styles.entryRow}>
              <Text style={styles.entryLabel}>{r.clientName || r.description || 'Income'}</Text>
              <Text style={[styles.entryAmt, { color: theme.statusPositive }]}>{formatCentsShort(r.amountCents)}</Text>
            </View>
          ))}
          {activeIncome.length === 0 && <Text style={styles.emptyNote}>No income recorded yet.</Text>}
        </Section>
      )}

      {biz.trackExpenses && (
        <Section title="EXPENSES">
          <TouchableOpacity style={styles.addRowBtn} onPress={() => setShowExpenseModal(true)}>
            <Text style={styles.addRowBtnText}>+ ADD EXPENSE</Text>
          </TouchableOpacity>
          {activeExpenses.slice(0, 10).map((r, i) => (
            <View key={r.id || i} style={styles.entryRow}>
              <Text style={styles.entryLabel}>{r.description || r.vendor || 'Expense'}</Text>
              <Text style={[styles.entryAmt, { color: theme.statusDanger }]}>{formatCentsShort(r.amountCents)}</Text>
            </View>
          ))}
          {activeExpenses.length === 0 && <Text style={styles.emptyNote}>No expenses recorded yet.</Text>}
        </Section>
      )}

      {biz.trackMileage && (
        <Section title={`MILEAGE (${totalMileage.toFixed(1)} mi total)`}>
          {activeMileage.slice(0, 10).map((r, i) => (
            <View key={r.id || i} style={styles.entryRow}>
              <Text style={styles.entryLabel}>{r.date || '—'} · {r.description || ''}</Text>
              <Text style={styles.entryAmt}>{r.miles} mi</Text>
            </View>
          ))}
          {activeMileage.length === 0 && <Text style={styles.emptyNote}>No mileage recorded yet.</Text>}
        </Section>
      )}

      <AddEntryModal
        visible={showIncomeModal}
        title="ADD INCOME"
        fields={[
          { key: 'clientName', label: 'CLIENT / SOURCE', placeholder: 'Client name' },
          { key: 'amount', label: 'AMOUNT', placeholder: '0.00', numeric: true },
          { key: 'date', label: 'DATE', type: 'date' },
        ]}
        onSubmit={(vals) => {
          const entry = {
            id: `inc_${Date.now()}`,
            clientName: vals.clientName || 'Unknown',
            amountCents: parseBillInput(vals.amount || '0'),
            date: vals.date || new Date().toISOString().slice(0, 10),
            createdAt: Date.now(),
          };
          console.log('BusinessDetail: income entry (not yet persisted)', entry);
        }}
        onClose={() => setShowIncomeModal(false)}
      />

      <AddEntryModal
        visible={showExpenseModal}
        title="ADD EXPENSE"
        fields={[
          { key: 'description', label: 'DESCRIPTION', placeholder: 'What was it?' },
          { key: 'amount', label: 'AMOUNT', placeholder: '0.00', numeric: true },
          { key: 'date', label: 'DATE', type: 'date' },
        ]}
        onSubmit={(vals) => {
          const entry = {
            id: `exp_${Date.now()}`,
            description: vals.description || 'Expense',
            amountCents: parseBillInput(vals.amount || '0'),
            date: vals.date || new Date().toISOString().slice(0, 10),
            createdAt: Date.now(),
          };
          console.log('BusinessDetail: expense entry (not yet persisted)', entry);
        }}
        onClose={() => setShowExpenseModal(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  backBtn: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: 8 },
  title: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  errorText: { color: theme.statusDanger, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, margin: 24 },
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, backgroundColor: theme.backgroundCard, overflow: 'hidden' },
  summaryCell: { flex: 1, padding: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.borderColorDim },
  summaryLabel: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginBottom: 4 },
  summaryAmt: { color: theme.textPrimary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  section: { marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, backgroundColor: theme.backgroundCard, overflow: 'hidden' },
  sectionTitle: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim, backgroundColor: theme.backgroundPanel },
  addRowBtn: { margin: 12, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: 10, alignItems: 'center', borderStyle: 'dashed' },
  addRowBtnText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.borderColorDim },
  entryLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, flex: 1 },
  entryAmt: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  emptyNote: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, padding: 12, fontStyle: 'italic' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlayBg },
  sheet: { backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: theme.borderRadiusLG, borderTopRightRadius: theme.borderRadiusLG, padding: theme.spacingLG, gap: theme.spacingSM },
  sheetTitle: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingSM },
  fieldLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingXS },
  input: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  sheetActions: { flexDirection: 'row', gap: theme.spacingMD, marginTop: theme.spacingSM },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  cancelText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  addBtn: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  addBtnText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
});
