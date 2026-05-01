import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { parseBillInput } from '../../utils/currency';

const ACCOUNTS = [
  { key: 'jointChecking', label: 'Joint Checking' },
  { key: 'entChecking',   label: 'ENT Checking' },
  { key: 'entSavings',   label: 'ENT Savings' },
  { key: 'venmo',        label: 'Venmo' },
  { key: 'cash',         label: 'Cash' },
];

export default function AccountFloorsSection() {
  const accountFloors = useStore(s => s.accountFloors);
  const updateConfig = useStore(s => s.updateConfig);

  const [values, setValues] = useState(() =>
    Object.fromEntries(ACCOUNTS.map(({ key }) => [key, ((accountFloors[key] || 0) / 100).toFixed(2)]))
  );

  const handleBlur = (key) => {
    updateConfig({ accountFloors: { ...accountFloors, [key]: parseBillInput(values[key]) } });
  };

  return (
    <View>
      <Text style={styles.header}>ACCOUNT FLOORS</Text>
      <Text style={styles.subtitle}>Minimum safe balance per account.</Text>
      {ACCOUNTS.map(({ key, label }) => (
        <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={values[key]}
            onChangeText={text => setValues(v => ({ ...v, [key]: text }))}
            onBlur={() => handleBlur(key)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingXS },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingMD },
  label: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: theme.spacingSM, marginBottom: theme.spacingXS },
  input: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS },
});
