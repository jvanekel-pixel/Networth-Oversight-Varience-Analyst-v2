import React, { useEffect, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCents, formatCentsShort, parseBillInput } from '../utils/currency';
import { getCurrentWeekStart, timeAgo } from '../utils/dates';

function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

function GrocerySpendModal({ visible, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewCents = parseBillInput(raw);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (previewCents <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(previewCents);
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>LOG GROCERY SPEND</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="0.00"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          <Text style={styles.modalPreview}>{formatCentsShort(previewCents)}</Text>
          <TouchableOpacity style={[styles.modalSubmit, (previewCents <= 0 || isSubmitting) && styles.btnDisabled]} onPress={handleSubmit} disabled={previewCents <= 0 || isSubmitting}>
            <Text style={styles.modalSubmitText}>LOG SPEND</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SetLimitModal({ visible, currentLimit, onSubmit, onClose }) {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setRaw(currentLimit > 0 ? (currentLimit / 100).toFixed(2) : '');
  }, [visible, currentLimit]);

  const handleClose = () => { setRaw(''); setIsSubmitting(false); onClose(); };
  const handleSubmit = async () => {
    if (!raw || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(parseBillInput(raw));
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalPanel}>
          <Text style={styles.modalTitle}>SET WEEKLY LIMIT</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Weekly grocery limit"
            placeholderTextColor={theme.textDim}
            keyboardType="decimal-pad"
            value={raw}
            onChangeText={setRaw}
          />
          <TouchableOpacity style={[styles.modalSubmit, isSubmitting && styles.btnDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.modalSubmitText}>SET LIMIT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
            <Text style={styles.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function GroceryBudgetCard() {
  const groceryBudget = useStore((s) => s.groceryBudget);
  const groceryEntries = useStore((s) => s.groceryEntries);
  const logGrocerySpend = useStore((s) => s.logGrocerySpend);
  const updateGroceryBudget = useStore((s) => s.updateGroceryBudget);
  const editGroceryEntry = useStore((s) => s.editGroceryEntry);
  const deleteGroceryEntry = useStore((s) => s.deleteGroceryEntry);
  const checkSpendingFloors = useStore((s) => s.checkSpendingFloors);

  const [groceryVisible, setGroceryVisible] = useState(false);
  const [limitVisible, setLimitVisible] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState(null);
  const [editGroceryRaw, setEditGroceryRaw] = useState('');

  const { weeklyLimit = 0, currentWeekSpend = 0 } = groceryBudget || {};
  const thisWeekEntries = (() => {
    const ws = getCurrentWeekStart();
    return [...(groceryEntries || [])]
      .filter(e => !e.deleted && e.weekStartDate === ws)
      .sort((a, b) => b.timestamp - a.timestamp);
  })();
  const groceryPct = weeklyLimit > 0 ? currentWeekSpend / weeklyLimit : 0;
  const groceryBarColor = groceryPct >= 0.95
    ? theme.statusDanger
    : groceryPct >= 0.60
    ? theme.statusWarning
    : theme.statusPositive;

  return (
    <>
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardLabel}>GROCERY BUDGET</Text>
          <TouchableOpacity onPress={() => setLimitVisible(true)}>
            <Text style={styles.linkText}>SET LIMIT</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.metaText}>
          Weekly limit: {weeklyLimit > 0 ? formatCents(weeklyLimit) : 'Not set'}
        </Text>
        <Text style={styles.metaText}>
          This week: {formatCents(currentWeekSpend)}
          {weeklyLimit > 0 ? `  (${Math.floor(groceryPct * 100)}%)` : ''}
        </Text>
        {weeklyLimit > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.min(Math.floor(groceryPct * 100), 100)}%`, backgroundColor: groceryBarColor }]} />
          </View>
        )}
        <TouchableOpacity style={[styles.btnIncome, { marginTop: theme.spacingSM }]} onPress={() => setGroceryVisible(true)}>
          <Text style={styles.btnText}>LOG GROCERY SPEND</Text>
        </TouchableOpacity>
        {thisWeekEntries.map(entry => (
          <TouchableOpacity
            key={entry.id}
            style={styles.groceryEntryRow}
            onLongPress={() => {
              Alert.alert(
                formatCents(entry.amountCents),
                timeAgo(entry.timestamp),
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Edit', onPress: () => { setEditingGrocery(entry); setEditGroceryRaw((entry.amountCents / 100).toFixed(2)); } },
                  { text: 'Delete', style: 'destructive', onPress: () => {
                    Alert.alert('Delete entry?', 'Week spend will be recalculated.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteGroceryEntry(entry.id) },
                    ]);
                  }},
                ]
              );
            }}
          >
            <Text style={styles.groceryEntryAmt}>{formatCents(entry.amountCents)}</Text>
            <Text style={styles.groceryEntryMeta}>{timeAgo(entry.timestamp)}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      <GrocerySpendModal
        visible={groceryVisible}
        onSubmit={async (cents) => { await logGrocerySpend(cents); checkSpendingFloors(); }}
        onClose={() => setGroceryVisible(false)}
      />
      <SetLimitModal
        visible={limitVisible}
        currentLimit={weeklyLimit}
        onSubmit={async (cents) => { await updateGroceryBudget({ weeklyLimitCents: cents }); }}
        onClose={() => setLimitVisible(false)}
      />
      <Modal visible={editingGrocery !== null} transparent animationType="fade" onRequestClose={() => setEditingGrocery(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>EDIT GROCERY ENTRY</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
              value={editGroceryRaw}
              onChangeText={setEditGroceryRaw}
            />
            {editGroceryRaw.length > 0 && (
              <Text style={styles.modalPreview}>{formatCents(parseBillInput(editGroceryRaw))}</Text>
            )}
            <TouchableOpacity
              style={styles.modalSubmit}
              onPress={async () => {
                const amt = parseBillInput(editGroceryRaw);
                if (amt > 0 && editingGrocery) {
                  await editGroceryEntry(editingGrocery.id, { amountCents: amt });
                  setEditingGrocery(null);
                  setEditGroceryRaw('');
                }
              }}
            >
              <Text style={styles.modalSubmitText}>SAVE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setEditingGrocery(null); setEditGroceryRaw(''); }}>
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.backgroundCard, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, marginBottom: theme.spacingMD },
  cardLabel: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1, marginBottom: theme.spacingXS },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacingXS },
  metaText: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  linkText: { color: theme.accent, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  btnIncome: { backgroundColor: theme.accentGlow, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingSM, marginRight: theme.spacingXS, marginBottom: theme.spacingXS },
  btnText: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS, fontWeight: 'bold' },
  barTrack: { height: 6, backgroundColor: theme.backgroundPanel, borderRadius: 3, marginTop: theme.spacingXS, marginBottom: theme.spacingSM, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  groceryEntryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacingXS, borderTopWidth: 1, borderTopColor: theme.borderColorDim, marginTop: theme.spacingXS },
  groceryEntryAmt: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
  groceryEntryMeta: { color: theme.textDim, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS },
  backdrop: { flex: 1, backgroundColor: theme.overlayBg, justifyContent: 'center', alignItems: 'center', padding: theme.spacingLG },
  modalPanel: { backgroundColor: theme.backgroundPanel, padding: theme.spacingLG, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusLG, width: '100%' },
  modalTitle: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingMD },
  modalInput: { backgroundColor: theme.backgroundCard, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, marginBottom: theme.spacingSM },
  modalPreview: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginBottom: theme.spacingSM },
  modalSubmit: { backgroundColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD, marginBottom: theme.spacingSM },
  btnDisabled: { opacity: 0.5 },
  modalSubmitText: { color: theme.background, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  modalCancel: { padding: theme.spacingSM, alignItems: 'center' },
  modalCancelText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
});
