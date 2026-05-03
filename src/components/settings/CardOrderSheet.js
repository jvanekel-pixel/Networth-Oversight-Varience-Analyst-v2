import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';

export default function CardOrderSheet({ visible, title, cards, currentOrder, onSave, onClose }) {
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    if (visible) {
      const activeIds = new Set((cards || []).map(c => c.id));
      const ordered = [...(currentOrder || []).filter(id => activeIds.has(id))];
      for (const card of cards || []) {
        if (!ordered.includes(card.id)) ordered.push(card.id);
      }
      setDraft(ordered);
    }
  }, [visible, cards, currentOrder]);

  const labels = Object.fromEntries((cards || []).map(c => [c.id, c.label]));

  function move(id, delta) {
    setDraft((prev) => {
      const idx = prev.indexOf(id);
      const nextIdx = idx + delta;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(nextIdx, 0, item);
      return next;
    });
  }

  async function handleSave() {
    await onSave(draft);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>{title || 'CUSTOMIZE CARD ORDER'}</Text>
          {draft.length === 0 && <Text style={styles.empty}>No reorderable cards are currently visible.</Text>}
          {draft.map((id, idx) => (
            <View key={id} style={styles.row}>
              <Text style={styles.handle}>=</Text>
              <Text style={styles.label}>{labels[id] || id}</Text>
              <TouchableOpacity style={styles.moveBtn} onPress={() => move(id, -1)} disabled={idx === 0}>
                <Text style={[styles.moveText, idx === 0 && styles.moveTextDisabled]}>UP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.moveBtn} onPress={() => move(id, 1)} disabled={idx === draft.length - 1}>
                <Text style={[styles.moveText, idx === draft.length - 1 && styles.moveTextDisabled]}>DOWN</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlayBg, justifyContent: 'flex-end' },
  panel: { width: '100%', backgroundColor: theme.backgroundPanel, borderTopWidth: 1, borderColor: theme.borderColor, borderTopLeftRadius: theme.borderRadiusLG, borderTopRightRadius: theme.borderRadiusLG, padding: theme.spacingLG },
  title: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingMD },
  empty: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingMD },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacingSM, borderTopWidth: 1, borderTopColor: theme.borderColorDim },
  handle: { color: theme.textDim, width: 24, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary },
  label: { flex: 1, color: theme.textPrimary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  moveBtn: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS, marginLeft: theme.spacingXS },
  moveText: { color: theme.accent, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  moveTextDisabled: { color: theme.textDim },
  actions: { flexDirection: 'row', gap: theme.spacingMD, marginTop: theme.spacingLG },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center' },
  saveBtn: { flex: 1, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  cancelText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  saveText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
});
