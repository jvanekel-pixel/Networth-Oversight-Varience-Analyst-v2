import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';

const MODES = [
  { key: 'solo', label: 'SOLO', desc: 'Independent finances' },
  { key: 'partnered', label: 'PARTNERED', desc: 'Shared household' },
];

export default function ProfileModeSection() {
  const novaConfig = useStore((s) => s.novaConfig);
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const currentMode = novaConfig?.userMode || 'solo';
  const [pending, setPending] = useState(currentMode);

  function handleChange(mode) {
    if (mode === currentMode) return;
    Alert.alert(
      'Change Profile Mode',
      'Your existing data is preserved — only what is shown changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setPending(mode);
            updateNovaConfig({ userMode: mode });
          },
        },
      ]
    );
  }

  return (
    <View>
      <Text style={styles.header}>PROFILE MODE</Text>
      <View style={styles.cards}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.card, currentMode === m.key && styles.cardSelected]}
            onPress={() => handleChange(m.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardLabel, currentMode === m.key && styles.cardLabelSelected]}>
              {m.label}
            </Text>
            <Text style={styles.cardDesc}>{m.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.note}>Changing mode preserves all existing data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.textSecondary, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 2, marginBottom: theme.spacingMD, fontWeight: 'bold' },
  cards: { flexDirection: 'row', gap: theme.spacingSM },
  card: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, backgroundColor: theme.backgroundPanel },
  cardSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  cardLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  cardLabelSelected: { color: theme.accent },
  cardDesc: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary },
  note: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, marginTop: theme.spacingSM, fontStyle: 'italic' },
});
