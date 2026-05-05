import React, { useMemo } from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { formatCentsShort } from '../../utils/currency';
import {
  DEFAULT_ANDROID_WIDGET_SETTINGS,
  buildAndroidWidgetSnapshot,
  resolveAndroidWidgetSettings,
  scheduleAndroidWidgetSync,
} from '../../utils/androidWidgets';

const PROFILE_OPTIONS = [
  { key: 'personal', label: 'Personal' },
  { key: 'household', label: 'Household' },
  { key: 'business', label: 'Business' },
];

function accountKey(account) {
  return account ? (account.legacyKey || account.id) : null;
}

function accountOptions(accountRegistry = [], accounts = {}) {
  const fromRegistry = (accountRegistry || [])
    .filter(account => account && account.isActive !== false)
    .map(account => ({
      key: accountKey(account),
      label: account.name || account.id || account.legacyKey,
      role: account.role || 'personal',
      balanceCents: accounts?.[accountKey(account)] || 0,
    }))
    .filter(account => account.key);
  if (fromRegistry.length > 0) return fromRegistry;
  return Object.keys(accounts || {}).map(key => ({
    key,
    label: key,
    role: key.toLowerCase().includes('joint') ? 'household' : 'personal',
    balanceCents: accounts[key] || 0,
  }));
}

export default function AndroidWidgetSettingsSection() {
  const accounts = useStore((s) => s.accounts);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const novaConfig = useStore((s) => s.novaConfig);
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const state = useStore();
  const settings = resolveAndroidWidgetSettings(novaConfig);
  const options = useMemo(() => accountOptions(accountRegistry, accounts), [accountRegistry, accounts]);
  const snapshot = useMemo(() => buildAndroidWidgetSnapshot(state), [state]);

  const saveSettings = async (updates) => {
    const widgetSettings = {
      ...DEFAULT_ANDROID_WIDGET_SETTINGS,
      ...settings,
      ...updates,
    };
    await updateNovaConfig({ widgetSettings });
    scheduleAndroidWidgetSync(useStore.getState(), 100);
  };

  return (
    <View>
      <Text style={styles.header}>ANDROID WIDGETS</Text>
      <Text style={styles.subtitle}>
        Choose the account and data NOVA publishes to the Android home-screen widgets.
      </Text>
      {Platform.OS !== 'android' ? (
        <Text style={styles.platformNote}>These settings sync when this app is installed on Android.</Text>
      ) : null}

      <Text style={styles.label}>Designated account</Text>
      <View style={styles.chipRow}>
        {options.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[styles.chip, settings.accountKey === option.key && styles.chipActive]}
            onPress={() => saveSettings({ accountKey: option.key, profile: option.role || settings.profile })}
          >
            <Text style={[styles.chipText, settings.accountKey === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
            <Text style={styles.chipMeta}>{formatCentsShort(option.balanceCents)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Fallback zone</Text>
      <View style={styles.chipRow}>
        {PROFILE_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[styles.profileChip, settings.profile === option.key && styles.chipActive]}
            onPress={() => saveSettings({ profile: option.key })}
          >
            <Text style={[styles.chipText, settings.profile === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <WidgetToggle
        label="Spending left this cycle"
        value={settings.showSpendingLeft !== false}
        onChange={(showSpendingLeft) => saveSettings({ showSpendingLeft })}
      />
      <WidgetToggle
        label="Next bill due"
        value={settings.showNextBill !== false}
        onChange={(showNextBill) => saveSettings({ showNextBill })}
      />
      <WidgetToggle
        label="Savings goal progress"
        value={settings.showSavingsGoal !== false}
        onChange={(showSavingsGoal) => saveSettings({ showSavingsGoal })}
      />

      <View style={styles.preview}>
        <Text style={styles.previewLabel}>Current widget feed</Text>
        <Text style={styles.previewLine}>{snapshot.accountName}: {snapshot.spendingLeftAmount} left</Text>
        <Text style={styles.previewLine}>{snapshot.nextBillName}: {snapshot.nextBillDueLabel}</Text>
        <Text style={styles.previewLine}>{snapshot.savingsGoalName}: {snapshot.savingsGoalPercentLabel}</Text>
      </View>
    </View>
  );
}

function WidgetToggle({ label, value, onChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.borderColorDim, true: theme.accent }}
        thumbColor={theme.background}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    lineHeight: 18,
    marginBottom: theme.spacingMD,
  },
  platformNote: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingSM,
  },
  label: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingSM,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
    minWidth: 110,
  },
  profileChip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: theme.spacingXS,
  },
  chipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  chipTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  chipMeta: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacingSM,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColorDim,
  },
  toggleLabel: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    flex: 1,
    marginRight: theme.spacingSM,
  },
  preview: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginTop: theme.spacingMD,
    backgroundColor: theme.backgroundPanel,
  },
  previewLabel: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  previewLine: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: 2,
  },
});
