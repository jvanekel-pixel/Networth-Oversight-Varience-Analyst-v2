import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import { timeAgo } from '../utils/dates';
import {
  deleteReceiptFileAsync,
  getReceiptAttachments,
  pickReceiptImageAsync,
  receiptCount,
} from '../utils/receiptFiles';

function txTitle(tx) {
  return String(tx?.description || tx?.category || 'Transaction').trim() || 'Transaction';
}

export function TransactionReceiptModal({ visible, transaction, onClose }) {
  const liveTransaction = useStore((s) =>
    transaction?.id ? (s.transactions || []).find(tx => tx.id === transaction.id) || transaction : transaction
  );
  const addReceiptAttachmentToTransaction = useStore((s) => s.addReceiptAttachmentToTransaction);
  const removeReceiptAttachmentFromTransaction = useStore((s) => s.removeReceiptAttachmentFromTransaction);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const attachments = getReceiptAttachments(liveTransaction);
  const selected = attachments[Math.min(selectedIndex, Math.max(attachments.length - 1, 0))] || null;

  useEffect(() => {
    if (visible) {
      setSelectedIndex(0);
      setBusy(false);
    }
  }, [visible, transaction?.id]);

  if (!visible || !liveTransaction) return null;

  const addReceipt = async (source) => {
    if (busy) return;
    try {
      setBusy(true);
      const attachment = await pickReceiptImageAsync(source, liveTransaction.id);
      if (attachment) {
        await addReceiptAttachmentToTransaction(liveTransaction.id, attachment);
        setSelectedIndex(attachments.length);
      }
    } catch (e) {
      Alert.alert('Receipt not attached', e.message || 'N.O.V.A. could not save that image.');
    } finally {
      setBusy(false);
    }
  };

  const chooseUpload = () => {
    if (busy) return;
    Alert.alert('Upload Receipt', '', [
      { text: 'Photo Library', onPress: () => addReceipt('library') },
      { text: 'Image File', onPress: () => addReceipt('file') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeSelected = () => {
    if (!selected || busy) return;
    Alert.alert('Remove Receipt?', 'This removes the image from this transaction.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await removeReceiptAttachmentFromTransaction(liveTransaction.id, selected.id);
          await deleteReceiptFileAsync(selected);
          setSelectedIndex(0);
          setBusy(false);
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleCol}>
              <Text style={styles.modalTitle}>RECEIPTS</Text>
              <Text style={styles.modalSub} numberOfLines={1}>{txTitle(liveTransaction)}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewFrame}>
            {selected ? (
              <Image source={{ uri: selected.uri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <Text style={styles.emptyText}>No receipt attached.</Text>
            )}
          </View>

          {attachments.length > 1 && (
            <View style={styles.pagerRow}>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex <= 0}
              >
                <Text style={[styles.smallBtnText, selectedIndex <= 0 && styles.disabledText]}>PREV</Text>
              </TouchableOpacity>
              <Text style={styles.pagerText}>{selectedIndex + 1} / {attachments.length}</Text>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => setSelectedIndex(Math.min(attachments.length - 1, selectedIndex + 1))}
                disabled={selectedIndex >= attachments.length - 1}
              >
                <Text style={[styles.smallBtnText, selectedIndex >= attachments.length - 1 && styles.disabledText]}>NEXT</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, busy && styles.disabled]} onPress={() => addReceipt('camera')} disabled={busy}>
              <Text style={styles.actionText}>CAMERA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, busy && styles.disabled]} onPress={chooseUpload} disabled={busy}>
              <Text style={styles.actionText}>UPLOAD</Text>
            </TouchableOpacity>
            {selected && (
              <TouchableOpacity style={[styles.removeBtn, busy && styles.disabled]} onPress={removeSelected} disabled={busy}>
                <Text style={styles.removeText}>REMOVE</Text>
              </TouchableOpacity>
            )}
          </View>

          {attachments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
              {attachments.map((attachment, index) => (
                <TouchableOpacity
                  key={attachment.id || attachment.uri || index}
                  style={[styles.thumb, index === selectedIndex && styles.thumbActive]}
                  onPress={() => setSelectedIndex(index)}
                >
                  <Image source={{ uri: attachment.uri }} style={styles.thumbImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ReceiptAttachmentsCard({
  title = 'RECEIPTS',
  transactions = [],
  getAccountLabel = null,
  style,
  limit = 10,
}) {
  const [activeTxId, setActiveTxId] = useState(null);
  const liveTransactions = useStore((s) => s.transactions);
  const rows = useMemo(() => [...(transactions || [])]
    .filter(tx => tx && !tx.deleted)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit), [transactions, limit]);
  const liveActiveTx = activeTxId
    ? (liveTransactions || []).find(tx => tx.id === activeTxId) || rows.find(tx => tx.id === activeTxId)
    : null;
  const totalReceipts = (transactions || []).reduce((sum, tx) => sum + receiptCount(tx), 0);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardCount}>{totalReceipts}</Text>
      </View>

      {rows.length === 0 && <Text style={styles.emptyCardText}>No transactions yet.</Text>}
      {rows.map(tx => {
        const count = receiptCount(tx);
        const isPositive = (tx.amountCents || 0) > 0;
        const accountLabel = getAccountLabel ? getAccountLabel(tx) : tx.accountKey;
        return (
          <TouchableOpacity
            key={tx.id}
            style={styles.txRow}
            onPress={() => setActiveTxId(tx.id)}
            activeOpacity={0.8}
          >
            <View style={styles.txMain}>
              <Text style={styles.txDesc} numberOfLines={1}>{txTitle(tx)}</Text>
              <Text style={styles.txMeta} numberOfLines={1}>
                {accountLabel || 'Account'} - {timeAgo(tx.timestamp)}
              </Text>
            </View>
            <View style={styles.txSide}>
              <Text style={[styles.txAmount, { color: isPositive ? theme.statusPositive : theme.statusDanger }]}>
                {isPositive ? '+' : ''}{formatCentsShort(tx.amountCents || 0)}
              </Text>
              <Text style={[styles.receiptBadge, count > 0 && styles.receiptBadgeOn]}>
                {count > 0 ? `${count} PHOTO${count === 1 ? '' : 'S'}` : 'NO PHOTO'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <TransactionReceiptModal
        visible={!!liveActiveTx}
        transaction={liveActiveTx}
        onClose={() => setActiveTxId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    marginBottom: theme.spacingMD,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacingMD,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
    backgroundColor: theme.backgroundPanel,
  },
  cardTitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardCount: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  emptyCardText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    padding: theme.spacingMD,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    gap: theme.spacingSM,
  },
  txMain: {
    flex: 1,
    minWidth: 0,
  },
  txDesc: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  txMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  txSide: {
    alignItems: 'flex-end',
    minWidth: 86,
  },
  txAmount: {
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  receiptBadge: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  receiptBadgeOn: {
    color: theme.accent,
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.overlayBg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacingMD,
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusLG,
    backgroundColor: theme.backgroundPanel,
    padding: theme.spacingMD,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  modalTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  modalSub: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  closeText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 0.78,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    marginTop: theme.spacingMD,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    alignItems: 'center',
    backgroundColor: theme.accentGlow,
  },
  actionText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  removeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    alignItems: 'center',
    backgroundColor: theme.statusDangerBg,
  },
  removeText: {
    color: theme.statusDanger,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacingSM,
    marginTop: theme.spacingSM,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  smallBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  disabledText: {
    color: theme.textDim,
  },
  pagerText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  thumbRow: {
    gap: theme.spacingXS,
    paddingTop: theme.spacingMD,
  },
  thumb: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    overflow: 'hidden',
  },
  thumbActive: {
    borderColor: theme.accent,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
