import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import theme from '../../config/theme.config';
import { parseBillInput } from '../../utils/currency';
import useStore from '../../store/useStore';
import AccountPickerSheet from '../AccountPickerSheet';

export default function LogMassageIncomeModal({ visible, onClose, onConfirm, entry = null }) {
  const accountRegistry = useStore((s) => s.accountRegistry);

  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [destinationAccount, setDestinationAccount] = useState(null);
  const [notes, setNotes] = useState('');

  const personalAccounts = (accountRegistry || []).filter(
    a => a.isActive !== false && a.role === 'personal'
  );

  const firstCheckingKey = (() => {
    const acct = personalAccounts.find(a => a.type === 'checking');
    return acct ? (acct.legacyKey || acct.id) : null;
  })();

  const firstCashKey = (() => {
    const acct = personalAccounts.find(a => a.type === 'cash');
    return acct ? (acct.legacyKey || acct.id) : null;
  })();

  const firstPersonalKey = personalAccounts.length > 0
    ? (personalAccounts[0].legacyKey || personalAccounts[0].id)
    : null;

  useEffect(() => {
    if (visible && entry) {
      const d = new Date(entry.date);
      setMonth(String(d.getMonth() + 1));
      setDay(String(d.getDate()));
      setYear(String(d.getFullYear()));
      setAmount(entry.amountCents ? (entry.amountCents / 100).toFixed(2) : '');
      setPaymentMethod(entry.paymentMethod || 'cash');
      setDestinationAccount(entry.destinationAccount || firstPersonalKey);
      setNotes(entry.notes || '');
    } else if (!visible) {
      const t = new Date();
      setMonth(String(t.getMonth() + 1));
      setDay(String(t.getDate()));
      setYear(String(t.getFullYear()));
      setAmount('');
      setPaymentMethod('cash');
      setDestinationAccount(firstCashKey || firstPersonalKey);
      setNotes('');
    }
  }, [visible, entry]);

  useEffect(() => {
    if (paymentMethod === 'venmo') {
      setDestinationAccount(firstCheckingKey || firstPersonalKey);
    } else if (paymentMethod === 'cash') {
      setDestinationAccount(firstCashKey || firstPersonalKey);
    }
  }, [paymentMethod]);

  const handleConfirm = () => {
    if (!month || !day || !year || !amount) {
      Alert.alert('Missing Fields', 'Please fill in date and amount.');
      return;
    }
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
    onConfirm({ date, amountCents: parseBillInput(amount), paymentMethod, destinationAccount, notes });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>LOG INCOME</Text>

          <Text style={styles.label}>Date</Text>
          <View style={styles.dateRow}>
            <TextInput style={[styles.input, styles.dateInput]} placeholder="MM" placeholderTextColor={theme.textDim} keyboardType="numeric" value={month} onChangeText={setMonth} />
            <TextInput style={[styles.input, styles.dateInput]} placeholder="DD" placeholderTextColor={theme.textDim} keyboardType="numeric" value={day} onChangeText={setDay} />
            <TextInput style={[styles.input, styles.dateInputYear]} placeholder="YYYY" placeholderTextColor={theme.textDim} keyboardType="numeric" value={year} onChangeText={setYear} />
          </View>

          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={theme.textDim} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          <Text style={styles.label}>Payment Method</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, paymentMethod === 'cash' && styles.toggleBtnActive]} onPress={() => setPaymentMethod('cash')}>
              <Text style={[styles.toggleText, paymentMethod === 'cash' && styles.toggleTextActive]}>CASH</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, paymentMethod === 'venmo' && styles.toggleBtnActive]} onPress={() => setPaymentMethod('venmo')}>
              <Text style={[styles.toggleText, paymentMethod === 'venmo' && styles.toggleTextActive]}>VENMO</Text>
            </TouchableOpacity>
          </View>

          <AccountPickerSheet
            label="Destination Account"
            roleFilter={['personal']}
            selectedKey={destinationAccount}
            onSelect={setDestinationAccount}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} placeholder="Notes (optional)" placeholderTextColor={theme.textDim} value={notes} onChangeText={setNotes} />

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
  title: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, marginBottom: 20, fontWeight: 'bold' },
  label: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: theme.background, color: theme.textPrimary, borderRadius: 8, padding: 10, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1, textAlign: 'center' },
  dateInputYear: { flex: 2, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  toggleText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  toggleTextActive: { color: theme.background, fontWeight: 'bold' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD },
  confirmBtn: { flex: 1, backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  confirmText: { color: theme.background, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
});
