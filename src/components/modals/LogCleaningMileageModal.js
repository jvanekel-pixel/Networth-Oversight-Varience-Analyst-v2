import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import theme from '../../config/theme.config';

export default function LogCleaningMileageModal({ visible, onClose, onConfirm, irsRateCents = 70, entry = null }) {
  const today = new Date();
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [day, setDay] = useState(String(today.getDate()));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [miles, setMiles] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    if (visible && entry) {
      const d = new Date(entry.date);
      setMonth(String(d.getMonth() + 1));
      setDay(String(d.getDate()));
      setYear(String(d.getFullYear()));
      setMiles(entry.miles != null ? String(entry.miles) : '');
      setPurpose(entry.purpose || '');
    } else if (!visible) {
      const t = new Date();
      setMonth(String(t.getMonth() + 1));
      setDay(String(t.getDate()));
      setYear(String(t.getFullYear()));
      setMiles('');
      setPurpose('');
    }
  }, [visible, entry]);

  const milesFloat = parseFloat(miles) || 0;
  const deductionCents = Math.floor(milesFloat * irsRateCents);
  const deductionDisplay = (deductionCents / 100).toFixed(2);
  const rateDisplay = (irsRateCents / 100).toFixed(2);

  const handleConfirm = () => {
    if (!month || !day || !year || !miles) {
      Alert.alert('Missing Fields', 'Please fill in date and miles.');
      return;
    }
    const milesVal = parseFloat(miles);
    if (isNaN(milesVal) || milesVal <= 0) {
      Alert.alert('Invalid Miles', 'Please enter a valid positive number for miles.');
      return;
    }
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
    onConfirm({ date, miles: milesVal, purpose, irsRateCents, deductionCents: Math.floor(milesVal * irsRateCents) });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>LOG MILEAGE</Text>

          <Text style={styles.label}>Date</Text>
          <View style={styles.dateRow}>
            <TextInput style={[styles.input, styles.dateInput]} placeholder="MM" placeholderTextColor={theme.textDim} keyboardType="numeric" value={month} onChangeText={setMonth} />
            <TextInput style={[styles.input, styles.dateInput]} placeholder="DD" placeholderTextColor={theme.textDim} keyboardType="numeric" value={day} onChangeText={setDay} />
            <TextInput style={[styles.input, styles.dateInputYear]} placeholder="YYYY" placeholderTextColor={theme.textDim} keyboardType="numeric" value={year} onChangeText={setYear} />
          </View>

          <Text style={styles.label}>Miles</Text>
          <TextInput style={styles.input} placeholder="0.0" placeholderTextColor={theme.textDim} keyboardType="decimal-pad" value={miles} onChangeText={setMiles} />
          <Text style={styles.deductionText}>Deduction: ${deductionDisplay} (at ${rateDisplay}/mile)</Text>

          <Text style={styles.label}>Purpose / Destination</Text>
          <TextInput style={styles.input} placeholder="Purpose / destination" placeholderTextColor={theme.textDim} value={purpose} onChangeText={setPurpose} />

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
  deductionText: { color: theme.statusPositive, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD },
  confirmBtn: { flex: 1, backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  confirmText: { color: theme.background, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
});
