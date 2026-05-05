import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch, StyleSheet, Alert,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort, parseBillInput } from '../utils/currency';
import notificationsConfig from '../config/notifications.config';
import { addMonthsClamped, formatDate } from '../utils/dates';
import { useExport } from '../hooks/useExport';
import AccountFloorsSection from '../components/settings/AccountFloorsSection';
import IrsMileageRateSection from '../components/settings/IrsMileageRateSection';
import AboutSection from '../components/settings/AboutSection';
import ProfileModeSection from '../components/settings/ProfileModeSection';
import AccountsSection from '../components/settings/AccountsSection';
import ReconciliationSection from '../components/settings/ReconciliationSection';
import SpendingBucketsSection from '../components/settings/SpendingBucketsSection';
import SavingsGoalSection from '../components/settings/SavingsGoalSection';
import AndroidWidgetSettingsSection from '../components/settings/AndroidWidgetSettingsSection';
import AppLockSettingsSection from '../components/settings/AppLockSettingsSection';
import BackupEncryptionSection from '../components/settings/BackupEncryptionSection';
import EntrepreneurModeSection from '../components/settings/EntrepreneurModeSection';
import PartnerDepositSection from '../components/settings/PartnerDepositSection';
import PaycheckSplitSheet from '../components/settings/PaycheckSplitSheet';
import ExportPanel from '../components/ExportPanel';
import StatementImportPanel from '../components/StatementImportPanel';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const FREQ_OPTIONS = [
  { label: 'Weekly',      value: 'weekly' },
  { label: 'Bi-weekly',   value: 'biweekly' },
  { label: 'Monthly',     value: 'monthly' },
  { label: 'Unscheduled', value: 'unscheduled' },
];

const EXPORT_SCHEDULE_OPTIONS = [
  { label: 'Off',         value: 'off' },
  { label: 'Daily',       value: 'daily' },
  { label: 'Weekly',      value: 'weekly' },
  { label: 'Precise',     value: 'precise' },
];

const NOTIF_TOGGLES = [
  { key: 'billDueAlert',              label: 'Bill Due Alert' },
  { key: 'spendingFloorWarning',      label: 'Spending Floor Warning' },
  { key: 'scheduledIncomeMissed',     label: 'Scheduled Income Missed' },
  { key: 'balanceConfirmationNudge',  label: 'Balance Confirmation Nudge' },
  { key: 'weeklyVarianceSummary',     label: 'Weekly Variance Summary' },
  { key: 'savingsMilestone',          label: 'Savings Milestone' },
  { key: 'novaDailyDisposition',      label: 'NOVA Daily Disposition' },
  { key: 'payCycleReminder',          label: 'Pay Cycle Reminder' },
];

function addDays(ms, days) { return ms + days * 24 * 60 * 60 * 1000; }
function nextMonthSameDay(ms) { return addMonthsClamped(ms, 1); }
function computeFollowingPaycheck(nextDateMs, frequency) {
  if (!nextDateMs || frequency === 'unscheduled') return null;
  if (frequency === 'weekly')   return addDays(nextDateMs, 7);
  if (frequency === 'biweekly') return addDays(nextDateMs, 14);
  if (frequency === 'monthly')  return nextMonthSameDay(nextDateMs);
  return null;
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.segRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.segBtn, value === opt.value && styles.segBtnActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.segText, value === opt.value && styles.segTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SubDivider() {
  return <View style={styles.subDivider} />;
}

function CollapsibleSection({ title, summary, badge, children }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <View style={styles.collapsible}>
      <TouchableOpacity style={styles.collapsibleHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.collapsibleHeaderLeft}>
          <View style={styles.collapsibleTitleRow}>
            <Text style={styles.collapsibleTitle}>{title}</Text>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {summary ? <Text style={styles.collapsibleSummary}>{summary}</Text> : null}
        </View>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.collapsibleContent}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    incomeEvents, varianceConfig, novaConfig, updateConfig, recomputeVariance,
    resetStore, updateVarianceConfig, updateNovaConfig,
  } = useStore();
  const { importAllData } = useExport();

  const [payFrequency, setPayFrequency] = useState('biweekly');
  const [pcMonth, setPcMonth] = useState('');
  const [pcDay, setPcDay] = useState('');
  const [pcYear, setPcYear] = useState('');

  const [hhRedRaw, setHhRedRaw] = useState('');
  const [personalRedRaw, setPersonalRedRaw] = useState('');
  const [bizRedRaw, setBizRedRaw] = useState('');

  const [notifToggles, setNotifToggles] = useState({});
  const [dailyTime, setDailyTime] = useState('09:00');

  const [exportSchedule, setExportSchedule] = useState('off');
  const [exportPreciseDates, setExportPreciseDates] = useState('');
  const [exportDestinationLabel, setExportDestinationLabel] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');

  const [paydayReminderEnabled, setPaydayReminderEnabled] = useState(
    notificationsConfig.paydayReminder.enabled ?? true
  );

  const [ppdExpiryHours, setPpdExpiryHours] = useState('12');
  const [confirmNudgeHours, setConfirmNudgeHours] = useState('48');

  const [resetInput, setResetInput] = useState('');

  useEffect(() => {
    if (novaConfig?.paydayReminderEnabled !== undefined) {
      setPaydayReminderEnabled(novaConfig.paydayReminderEnabled);
    }
  }, [novaConfig]);

  useEffect(() => {
    if (!incomeEvents) return;
    setPayFrequency(incomeEvents.payFrequency || incomeEvents.paycheckFrequency || 'biweekly');
    if (incomeEvents.nextPaycheckDate) {
      const d = new Date(incomeEvents.nextPaycheckDate);
      setPcMonth(String(d.getMonth() + 1));
      setPcDay(String(d.getDate()));
      setPcYear(String(d.getFullYear()));
    }
  }, []);

  useEffect(() => {
    if (!varianceConfig) return;
    setHhRedRaw(String(Math.abs(varianceConfig.household?.redThresholdCents ?? 0) / 100));
    setPersonalRedRaw(String(Math.abs(varianceConfig.personal?.redThresholdCents ?? 30000) / 100));
    setBizRedRaw(String(Math.abs(varianceConfig.business?.redThresholdCents ?? 30000) / 100));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('nova_v2_export_config').then(raw => {
      if (raw) {
        const cfg = JSON.parse(raw);
        setExportSchedule(cfg.schedule || 'off');
        const preciseDates = Array.isArray(cfg.preciseDates) ? cfg.preciseDates.join(', ') : (cfg.preciseDates || '');
        setExportPreciseDates(preciseDates);
        setExportDestinationLabel(cfg.destinationLabel || '');
      }
    });
    AsyncStorage.getItem('nova_v2_notif_toggles').then(raw => {
      if (raw) setNotifToggles(JSON.parse(raw));
    });
    AsyncStorage.getItem('nova_v2_notif_daily_time').then(raw => {
      if (raw) setDailyTime(JSON.parse(raw));
    });
    AsyncStorage.getItem('nova_v2_config').then(raw => {
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.postPaydayExpiryHours != null) setPpdExpiryHours(String(cfg.postPaydayExpiryHours));
        if (cfg.balanceConfirmNudgeHours != null) setConfirmNudgeHours(String(cfg.balanceConfirmNudgeHours));
      }
    });
  }, []);

  const pcMonthN = parseInt(pcMonth, 10);
  const pcDayN   = parseInt(pcDay, 10);
  const pcYearN  = parseInt(pcYear, 10);
  const pcDateValid = pcMonthN >= 1 && pcMonthN <= 12 && pcDayN >= 1 && pcDayN <= 31 && pcYearN >= 2000 && pcYearN <= 2100;
  const nextPaycheckDateMs = pcDateValid ? new Date(pcYearN, pcMonthN - 1, pcDayN).getTime() : null;
  const followingMs = computeFollowingPaycheck(nextPaycheckDateMs, payFrequency);
  const followingLabel = followingMs ? formatDate(followingMs) : null;

  const handleSavePaySchedule = async () => {
    const nextPaycheckDate = payFrequency === 'unscheduled' ? null : nextPaycheckDateMs;
    await updateConfig({ incomeEvents: { ...incomeEvents, payFrequency, nextPaycheckDate } });
    recomputeVariance();
    Alert.alert('Saved', 'Pay schedule updated.');
  };

  const handleSaveVariance = async () => {
    await updateVarianceConfig('household', { redThresholdCents: -(parseBillInput(hhRedRaw) || 0) });
    await updateVarianceConfig('personal',  { redThresholdCents: -(parseBillInput(personalRedRaw) || 30000) });
    await updateVarianceConfig('business',  { redThresholdCents: -(parseBillInput(bizRedRaw) || 30000) });
    recomputeVariance();
    Alert.alert('Saved', 'Variance thresholds updated.');
  };

  const handleToggleNotif = async (key, val) => {
    const updated = { ...notifToggles, [key]: val };
    setNotifToggles(updated);
    await AsyncStorage.setItem('nova_v2_notif_toggles', JSON.stringify(updated));
  };

  const handleDailyTimeBlur = async () => {
    await AsyncStorage.setItem('nova_v2_notif_daily_time', JSON.stringify(dailyTime));
  };

  const handlePpdExpiryBlur = async () => {
    const hours = parseFloat(ppdExpiryHours) || 12;
    await updateNovaConfig({ postPaydayExpiryHours: hours });
  };

  const handleConfirmNudgeBlur = async () => {
    const raw = parseFloat(confirmNudgeHours) || 48;
    const hours = Math.max(24, Math.min(168, raw));
    setConfirmNudgeHours(String(hours));
    await updateNovaConfig({ balanceConfirmNudgeHours: hours });
  };

  const handlePaydayReminderToggle = async (val) => {
    setPaydayReminderEnabled(val);
    await updateNovaConfig({ paydayReminderEnabled: val });
  };

  const handleSaveExportSchedule = async (val) => {
    setExportSchedule(val);
    const raw = await AsyncStorage.getItem('nova_v2_export_config');
    const cfg = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem('nova_v2_export_config', JSON.stringify({ ...cfg, schedule: val }));
  };

  const handleSaveExportPreciseDates = async () => {
    const preciseDates = exportPreciseDates
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const raw = await AsyncStorage.getItem('nova_v2_export_config');
    const cfg = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem('nova_v2_export_config', JSON.stringify({ ...cfg, preciseDates }));
  };

  const handleSaveExportDestination = async () => {
    const raw = await AsyncStorage.getItem('nova_v2_export_config');
    const cfg = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem('nova_v2_export_config', JSON.stringify({ ...cfg, destinationLabel: exportDestinationLabel.trim() }));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >
      <View style={styles.headerStrip}>
        <Text style={styles.screenTitle}>SETTINGS</Text>
        <Text style={styles.screenSubtitle}>Configuration</Text>
      </View>

      {/* PROFILE */}
      <CollapsibleSection title="PROFILE" summary="User mode & entrepreneur features">
        <ProfileModeSection />
        <SubDivider />
        <EntrepreneurModeSection />
      </CollapsibleSection>

      {/* PAY & INCOME */}
      <CollapsibleSection title="PAY & INCOME" summary="Schedule, splits & scheduled deposits">
        <SectionHeader title="INCOME SCHEDULE" />
        <Text style={styles.label}>Income frequency</Text>
        <SegmentedControl options={FREQ_OPTIONS} value={payFrequency} onChange={setPayFrequency} />
        {payFrequency !== 'unscheduled' && (
          <>
            <Text style={styles.label}>Next income date</Text>
            <View style={styles.dateRow}>
              <TextInput style={styles.dateInput} placeholder="MM" placeholderTextColor={theme.textDim} keyboardType="numeric" maxLength={2} value={pcMonth} onChangeText={t => setPcMonth(t.replace(/\D/g, ''))} />
              <Text style={styles.dateSep}>/</Text>
              <TextInput style={styles.dateInput} placeholder="DD" placeholderTextColor={theme.textDim} keyboardType="numeric" maxLength={2} value={pcDay} onChangeText={t => setPcDay(t.replace(/\D/g, ''))} />
              <Text style={styles.dateSep}>/</Text>
              <TextInput style={styles.dateInputYear} placeholder="YYYY" placeholderTextColor={theme.textDim} keyboardType="numeric" maxLength={4} value={pcYear} onChangeText={t => setPcYear(t.replace(/\D/g, ''))} />
            </View>
            {followingLabel && <Text style={styles.previewText}>Following: {followingLabel}</Text>}
          </>
        )}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Remind me when income is expected</Text>
          <Switch
            value={paydayReminderEnabled}
            onValueChange={handlePaydayReminderToggle}
            trackColor={{ false: theme.borderColorDim, true: theme.accent }}
            thumbColor={theme.background}
          />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSavePaySchedule}>
          <Text style={styles.saveBtnText}>SAVE</Text>
        </TouchableOpacity>

        <SubDivider />
        <SectionHeader title="INCOME SPLIT" />
        <PaycheckSplitSheet />

        <SubDivider />
        <SectionHeader title="POST-INCOME ACTIONS" />
        <Text style={styles.label}>Follow-up window (hours)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={ppdExpiryHours}
          onChangeText={setPpdExpiryHours}
          onBlur={handlePpdExpiryBlur}
          placeholder="12"
          placeholderTextColor={theme.textDim}
        />
        <Text style={styles.previewText}>Follow-ups are generated from the accounts in your income split.</Text>

        <SubDivider />
        <PartnerDepositSection />
      </CollapsibleSection>

      {/* BILLS */}
      <CollapsibleSection title="BILLS" summary="Account floors, accounts & reconciliation">
        <AccountFloorsSection />
        <SubDivider />
        <AccountsSection />
        <SubDivider />
        <SectionHeader title="RECONCILIATION" />
        <ReconciliationSection />
        <SubDivider />
        <IrsMileageRateSection />
      </CollapsibleSection>

      {/* SPENDING CATEGORIES */}
      <CollapsibleSection title="SPENDING CATEGORIES" summary="Budget buckets">
        <SpendingBucketsSection />
      </CollapsibleSection>

      {/* SAVINGS */}
      <CollapsibleSection title="SAVINGS" summary="Goals & sinking funds">
        <SavingsGoalSection />
      </CollapsibleSection>

      {/* WIDGETS */}
      <CollapsibleSection title="WIDGETS" summary="Android home-screen shortcuts">
        <AndroidWidgetSettingsSection />
      </CollapsibleSection>

      {/* SECURITY */}
      <CollapsibleSection title="SECURITY" summary="Biometric & PIN app lock">
        <AppLockSettingsSection />
      </CollapsibleSection>

      {/* VARIANCE */}
      <CollapsibleSection title="VARIANCE" summary="Red floor thresholds per zone">
        <SectionHeader title="VARIANCE THRESHOLDS" />
        <Text style={styles.label}>Household red floor ($)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={hhRedRaw} onChangeText={setHhRedRaw} placeholderTextColor={theme.textDim} placeholder="0.00" />
        <Text style={styles.label}>Personal red floor ($)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={personalRedRaw} onChangeText={setPersonalRedRaw} placeholderTextColor={theme.textDim} placeholder="300.00" />
        <Text style={styles.label}>Business red floor ($)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={bizRedRaw} onChangeText={setBizRedRaw} placeholderTextColor={theme.textDim} placeholder="300.00" />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveVariance}>
          <Text style={styles.saveBtnText}>SAVE</Text>
        </TouchableOpacity>
      </CollapsibleSection>

      {/* NOTIFICATIONS */}
      <CollapsibleSection title="NOTIFICATIONS" summary="8 alert toggles & timing">
        {NOTIF_TOGGLES.map(({ key, label }) => (
          <View key={key} style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch
              value={notifToggles[key] !== false}
              onValueChange={val => handleToggleNotif(key, val)}
              trackColor={{ false: theme.borderColorDim, true: theme.accent }}
              thumbColor={theme.background}
            />
          </View>
        ))}
        {notifToggles.novaDailyDisposition !== false && (
          <View>
            <Text style={styles.label}>Daily time (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={dailyTime}
              onChangeText={setDailyTime}
              onBlur={handleDailyTimeBlur}
              placeholder="09:00"
              placeholderTextColor={theme.textDim}
            />
          </View>
        )}
        <Text style={styles.label}>Balance confirmation nudge (hours)</Text>
        <TextInput
          style={styles.input}
          value={confirmNudgeHours}
          keyboardType="decimal-pad"
          onChangeText={setConfirmNudgeHours}
          onBlur={handleConfirmNudgeBlur}
          placeholder="48"
          placeholderTextColor={theme.textDim}
        />
        <Text style={styles.previewText}>Allowed range: 24 hours to 7 days.</Text>
      </CollapsibleSection>

      {/* DISPLAY */}
      <CollapsibleSection title="DISPLAY" summary="Per-screen card controls">
        <Text style={styles.v2Note}>Use Customize View on Dashboard, Household, Personal, and Business screens to reorder or hide cards.</Text>
      </CollapsibleSection>

      {/* ACHIEVEMENTS */}
      <CollapsibleSection title="ACHIEVEMENTS" summary="XP, streaks & badge vault">
        <TouchableOpacity style={styles.saveBtn} onPress={() => navigation?.navigate('Badges')}>
          <Text style={styles.saveBtnText}>OPEN BADGE VAULT</Text>
        </TouchableOpacity>
      </CollapsibleSection>

      {/* DATA */}
      <CollapsibleSection title="DATA" summary="Export, import & factory reset">
        <SectionHeader title="EXPORT / IMPORT" />
        <Text style={styles.previewText}>No cloud sync. Full system backups can be run manually or by schedule.</Text>
        <SectionHeader title="BACKUP ENCRYPTION" />
        <BackupEncryptionSection />
        <SubDivider />
        <Text style={styles.label}>Auto-export schedule</Text>
        <SegmentedControl options={EXPORT_SCHEDULE_OPTIONS} value={exportSchedule} onChange={handleSaveExportSchedule} />
        {exportSchedule === 'precise' && (
          <>
            <Text style={styles.label}>Precise backup dates</Text>
            <TextInput
              style={styles.input}
              value={exportPreciseDates}
              onChangeText={setExportPreciseDates}
              onBlur={handleSaveExportPreciseDates}
              placeholder="2026-05-04, 2026-06-01"
              placeholderTextColor={theme.textDim}
            />
          </>
        )}
        <Text style={styles.label}>Backup destination note</Text>
        <TextInput
          style={styles.input}
          value={exportDestinationLabel}
          onChangeText={setExportDestinationLabel}
          onBlur={handleSaveExportDestination}
          placeholder="Android share sheet, Drive folder, USB copy, etc."
          placeholderTextColor={theme.textDim}
        />
        <ExportPanel destinationLabel={exportDestinationLabel.trim()} />
        <Text style={styles.label}>Encrypted import password</Text>
        <TextInput
          style={styles.input}
          value={importPassphrase}
          onChangeText={setImportPassphrase}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Only needed for encrypted NOVA backups"
          placeholderTextColor={theme.textDim}
        />
        <TouchableOpacity
          style={[styles.saveBtn, styles.importBtn]}
          onPress={() => importAllData({ backupPassphrase: importPassphrase })}
        >
          <Text style={styles.importBtnText}>IMPORT NOVA BACKUP</Text>
        </TouchableOpacity>
        <StatementImportPanel />

        <SubDivider />
        <Text style={styles.dangerHeader}>DANGER ZONE</Text>
        <Text style={styles.dangerLabel}>Type RESET to confirm</Text>
        <TextInput
          style={styles.input}
          placeholder="RESET"
          placeholderTextColor={theme.textDim}
          autoCapitalize="characters"
          value={resetInput}
          onChangeText={setResetInput}
        />
        <TouchableOpacity
          style={[styles.resetBtn, resetInput !== 'RESET' && styles.resetBtnDisabled]}
          disabled={resetInput !== 'RESET'}
          onPress={() => Alert.alert('Reset All Data?', 'This will wipe everything. Cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: async () => { setResetInput(''); await resetStore(); } },
          ])}
        >
          <Text style={[styles.resetBtnText, resetInput !== 'RESET' && styles.resetBtnTextDisabled]}>
            RESET ALL DATA
          </Text>
        </TouchableOpacity>
      </CollapsibleSection>

      {/* ABOUT */}
      <CollapsibleSection title="ABOUT" summary="Version info & credits">
        <AboutSection />
      </CollapsibleSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: theme.spacingMD, paddingBottom: theme.spacingXXL },
  headerStrip: { marginBottom: theme.spacingMD },
  screenTitle: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  screenSubtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: theme.spacingXS },

  // Collapsible card
  collapsible: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    marginBottom: theme.spacingMD,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacingMD,
  },
  collapsibleHeaderLeft: { flex: 1, marginRight: theme.spacingSM },
  collapsibleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacingSM },
  collapsibleTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  collapsibleSummary: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  chevron: {
    color: theme.textSecondary,
    fontSize: 20,
    fontFamily: theme.fontPrimary,
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    color: theme.accent,
    transform: [{ rotate: '90deg' }],
  },
  collapsibleContent: {
    paddingHorizontal: theme.spacingMD,
    paddingBottom: theme.spacingMD,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },

  // Sub-section divider
  subDivider: {
    height: 1,
    backgroundColor: theme.borderColorDim,
    marginVertical: theme.spacingMD,
  },

  // Inner section header (sub-section label inside collapsible)
  sectionHeader: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingSM,
    marginTop: theme.spacingSM,
    letterSpacing: 1,
  },

  label: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS, marginTop: theme.spacingSM },
  input: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, marginBottom: theme.spacingXS },
  previewText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginBottom: theme.spacingSM },
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingXS, marginBottom: theme.spacingSM },
  segBtn: { borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingSM, paddingVertical: theme.spacingXS },
  segBtnActive: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  segText: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
  segTextActive: { color: theme.accent, fontWeight: 'bold' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacingXS },
  dateInput: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, width: 52, textAlign: 'center' },
  dateInputYear: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, width: 72, textAlign: 'center' },
  dateSep: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeLG, marginHorizontal: theme.spacingXS },
  saveBtn: { backgroundColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD },
  saveBtnText: { color: theme.background, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacingSM, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim },
  toggleLabel: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, flex: 1 },
  importBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent, marginTop: theme.spacingSM },
  importBtnText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  dangerHeader: { color: theme.statusDanger, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingSM, letterSpacing: 1 },
  dangerLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS, marginTop: theme.spacingSM },
  resetBtn: { borderWidth: 1, borderColor: theme.statusDanger, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD, backgroundColor: theme.statusDangerBg },
  resetBtnDisabled: { borderColor: theme.borderColorDim, backgroundColor: 'transparent', opacity: 0.4 },
  resetBtnText: { color: theme.statusDanger, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  resetBtnTextDisabled: { color: theme.textDim },

  // Display note
  v2Note: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, paddingVertical: theme.spacingSM, fontStyle: 'italic' },

  // Badge
  badge: { backgroundColor: theme.accentGlow, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingXS, paddingVertical: 2 },
  badgeText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeXS, fontWeight: 'bold' },

  // Legacy styles kept for subcomponents that might reference them via prop pass-through
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacingXS },
  splitLabel: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, flex: 1 },
  splitInput: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, width: 110, textAlign: 'right' },
  splitTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.borderColorDim, paddingTop: theme.spacingSM, marginTop: theme.spacingXS },
  splitTotalLabel: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
  splitTotalAmt: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  confirmBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD },
  confirmBtnDisabled: { borderColor: theme.borderColorDim, opacity: 0.5 },
  confirmBtnText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  confirmBtnTextDisabled: { color: theme.textDim },
  lastConfirmedText: { color: theme.textDim, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginTop: theme.spacingSM, textAlign: 'center' },
});
