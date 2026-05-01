import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Switch, StyleSheet,
} from 'react-native';
import theme from '../../config/theme.config';
import { parseBillInput } from '../../utils/currency';

const CATEGORIES = ['formation_legal', 'equipment', 'supplies', 'marketing', 'software_tools', 'meals_entertainment', 'other'];

export default function LogCleaningExpenseModal({ visible, onClose, onConfirm }) {
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('supplies');
  const [description, setDescription] = useState('');
  const [taxDeductible, setTaxDeductible] = useState(true);
  const [receiptNote, setReceiptNote] = useState('');

  const handleConfirm = () => {
    if (!month || !day || !year || !amount) {
      Alert.alert('Missing Fields', 'Please fill in date and amount.');
      return;
    }
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
    onConfirm({ date, amountCents: parseBillInput(amount), category, description, taxDeductible, receiptNote });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>LOG EXPENSE</Text>
          <Text style={styles.subtitle}>Cleaning LLC</Text>

          <Text style={styles.label}>Date</Text>
          <View style={styles.dateRow}>
            <TextInput style={[styles.input, styles.dateInput]} placeholder="MM" placeholderTextColor={theme.textDim} keyboardType="numeric" value={month} onChangeText={setMonth} />
            <TextInput style={[styles.input, styles.dateInput]} placeholder="DD" placeholderTextColor={theme.textDim} keyboardType="numeric" value={day} onChangeText={setDay} />
            <TextInput style={[styles.input, styles.dateInputYear]} placeholder="YYYY" placeholderTextColor={theme.textDim} keyboardType="numeric" value={year} onChangeText={setYear} />
          </View>

          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={theme.textDim} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={[styles.pill, category === cat && styles.pillActive]} onPress={() => setCategory(cat)}>
                <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor={theme.textDim} value={description} onChangeText={setDescription} />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Tax Deductible</Text>
            <Switch
              value={taxDeductible}
              onValueChange={setTaxDeductible}
              trackColor={{ false: theme.borderColorDim, true: theme.accent }}
            />
          </View>

          <Text style={styles.label}>Receipt Note</Text>
          <TextInput style={styles.input} placeholder="Receipt note (optional)" placeholderTextColor={theme.textDim} value={receiptNote} onChangeText={setReceiptNote} />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>CONFIRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlayBg, justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.backgroundCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  title: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: 16 },
  label: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: theme.background, color: theme.textPrimary, borderRadius: 8, padding: 10, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1, textAlign: 'center' },
  dateInputYear: { flex: 2, textAlign: 'center' },
  pillScroll: { marginVertical: 4 },
  pill: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginRight: 8 },
  pillActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  pillText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  pillTextActive: { color: theme.background, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  switchLabel: { color: theme.textPrimary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD },
  confirmBtn: { flex: 1, backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  confirmText: { color: theme.background, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
});
