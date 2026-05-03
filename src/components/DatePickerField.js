import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDisplay(value) {
  const date = parseDate(value);
  if (!date) return 'Select a date';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}/${date.getFullYear()}`;
}

function sameDay(a, b) {
  return a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function DatePickerField({ value, onChange, label }) {
  const selectedDate = parseDate(value);
  const [visible, setVisible] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  const cells = useMemo(() => {
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDow = start.getDay();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, idx) => {
      const day = idx - firstDow + 1;
      return day >= 1 && day <= daysInMonth ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day) : null;
    });
  }, [viewDate]);

  const monthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  function openPicker() {
    setViewDate(selectedDate || new Date());
    setVisible(true);
  }

  function changeMonth(delta) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function chooseDate(date) {
    onChange(toValue(date));
    setVisible(false);
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.8}>
        <Text style={[styles.fieldText, !selectedDate && styles.placeholder]}>{toDisplay(value)}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
                <Text style={styles.navText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
                <Text style={styles.navText}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dowRow}>
              {DAYS.map((day, idx) => (
                <Text key={`${day}_${idx}`} style={styles.dowText}>{day}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((date, idx) => {
                const isSelected = date && sameDay(date, selectedDate);
                const isToday = date && sameDay(date, today);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dayCell, isSelected && styles.daySelected]}
                    onPress={() => date && chooseDate(date)}
                    disabled={!date}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {date ? date.getDate() : ''}
                    </Text>
                    {isToday && !isSelected ? <View style={styles.todayDot} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginTop: theme.spacingSM, marginBottom: theme.spacingXS },
  field: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, backgroundColor: theme.backgroundPanel },
  fieldText: { color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  placeholder: { color: theme.textDim },
  overlay: { flex: 1, backgroundColor: theme.overlayBg, alignItems: 'center', justifyContent: 'center', padding: theme.spacingLG },
  panel: { width: '100%', backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusLG, padding: theme.spacingMD },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacingMD },
  navBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM },
  navText: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  monthTitle: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  dowRow: { flexDirection: 'row', marginBottom: theme.spacingXS },
  dowText: { flex: 1, color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadiusSM },
  daySelected: { backgroundColor: theme.accent },
  dayText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  dayTextSelected: { color: theme.background, fontWeight: 'bold' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent, marginTop: 2 },
  cancelBtn: { marginTop: theme.spacingMD, padding: theme.spacingSM, alignItems: 'center' },
  cancelText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
});
