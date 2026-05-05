import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';

export default function SpendingBucketsSection() {
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const addBucket = useStore((s) => s.addBucket);
  const removeBucket = useStore((s) => s.removeBucket);
  const [newName, setNewName] = useState('');

  const buckets = spendingBuckets || [];

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    await addBucket({ name, label: name, isActive: true });
    setNewName('');
  }

  function handleRemove(id) {
    Alert.alert('Remove Category', 'Remove this spending category?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBucket(id) },
    ]);
  }

  return (
    <View>
      <Text style={styles.header}>SPENDING CATEGORIES</Text>
      {buckets.length === 0 && (
        <Text style={styles.empty}>No categories configured.</Text>
      )}
      <View style={styles.chipGrid}>
        {buckets.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={styles.chip}
            onLongPress={() => handleRemove(b.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.chipText}>{b.name.toUpperCase()}</Text>
            <Text style={styles.chipX}>×</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="New category name"
          placeholderTextColor={theme.textDim}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>ADD</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Long press a category to remove it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, marginBottom: theme.spacingMD, fontWeight: 'bold' },
  empty: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingMD, fontStyle: 'italic' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingSM, marginBottom: theme.spacingMD },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: 4 },
  chipText: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  chipX: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  addRow: { flexDirection: 'row', gap: theme.spacingSM },
  input: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  addBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentGlow },
  addBtnText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  hint: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: theme.spacingSM, fontStyle: 'italic' },
});
