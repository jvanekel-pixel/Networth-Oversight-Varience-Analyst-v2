import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';

export default function AccountPickerSheet({ roleFilter = [], selectedKey, onSelect, label }) {
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = (accountRegistry || []).filter(
    a => a.isActive !== false && roleFilter.includes(a.role)
  );

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      {accounts.length === 0 ? (
        <Text style={styles.empty}>No accounts configured for this category — add one in Settings.</Text>
      ) : (
        <View style={styles.toggleRow}>
          {accounts.map(acct => {
            const key = acct.legacyKey || acct.id;
            const isActive = selectedKey === key;
            return (
              <TouchableOpacity
                key={acct.id}
                style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                onPress={() => onSelect(key)}
              >
                <Text style={[styles.toggleText, isActive && styles.toggleTextActive]}>
                  {acct.name || acct.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: 4,
    marginTop: 12,
  },
  empty: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  toggleText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  toggleTextActive: {
    color: theme.background,
    fontWeight: 'bold',
  },
});
