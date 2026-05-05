import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';

export default function TourCueCard({
  cueId,
  title,
  body,
  actionLabel = null,
  onAction = null,
}) {
  const novaConfig = useStore((s) => s.novaConfig || {});
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const dismissed = Array.isArray(novaConfig.tourDismissedCues) ? novaConfig.tourDismissedCues : [];

  if (!cueId || novaConfig.guidedTourEnabled === false || dismissed.includes(cueId)) return null;

  const dismissCue = async () => {
    await updateNovaConfig({ tourDismissedCues: [...new Set([...dismissed, cueId])] });
  };

  const turnOffGuidedSignals = async () => {
    await updateNovaConfig({ guidedTourEnabled: false });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>NOVA SIGNAL</Text>
        <TouchableOpacity onPress={turnOffGuidedSignals} activeOpacity={0.8}>
          <Text style={styles.quietText}>TURN OFF GUIDED SIGNALS</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        {actionLabel && onAction && (
          <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.8}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.dismissBtn} onPress={dismissCue} activeOpacity={0.8}>
          <Text style={styles.dismissText}>GOT IT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacingSM,
    marginBottom: theme.spacingSM,
  },
  kicker: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  quietText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  title: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  body: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingSM,
    marginTop: theme.spacingMD,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    backgroundColor: theme.accentGlow,
  },
  actionText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  dismissBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  dismissText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
});
