import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';

export default function IrsMileageRateSection() {
  const irsRatePerMile = useStore(s => s.irsRatePerMile);
  const updateConfig = useStore(s => s.updateConfig);
  const [rateRaw, setRateRaw] = useState(() => ((irsRatePerMile || 70) / 100).toFixed(2));

  const handleBlur = () => {
    updateConfig({ irsRatePerMile: Math.round(parseFloat(rateRaw) * 100) || 70 });
  };

  return (
    <View>
      <Text style={styles.header}>IRS MILEAGE RATE</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={rateRaw}
        onChangeText={setRateRaw}
        onBlur={handleBlur}
      />
      <Text style={styles.note}>IRS updates this rate annually — verify each January.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingSM },
  input: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
  note: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
});
