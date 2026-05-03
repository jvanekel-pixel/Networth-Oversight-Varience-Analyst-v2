import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch, StyleSheet, Alert,
} from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort, parseBillInput } from '../utils/currency';
import notificationsConfig from '../config/notifications.config';
import { formatDate } from '../utils/dates';
import { useExport } from '../hooks/useExport';
import AccountFloorsSection from '../components/settings/AccountFloorsSection';
import IrsMileageRateSection from '../components/settings/IrsMileageRateSection';
import AboutSection from '../components/settings/AboutSection';
import ProfileModeSection from '../components/settings/ProfileModeSection';
import AccountsSection from '../components/settings/AccountsSection';
import SpendingBucketsSection from '../components/settings/SpendingBucketsSection';
import SavingsGoalSection from '../components/settings/SavingsGoalSection';
import EntrepreneurModeSection from '../components/settings/EntrepreneurModeSection';
import PartnerDepositSection from '../components/settings/PartnerDepositSection';
import PaycheckSplitSheet from '../components/settings/PaycheckSplitSheet';
import CardOrderSheet from '../components/settings/CardOrderSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  { label: 'Significant', value: 'significant' },
];

const NOTIF_TOGGLES = [
  { key: 'billDueAlert',           label: 'Bill Due Alert' },
  { key: 'spendingFloorWarning',   label: 'Spending Floor Warning' },
  { key: 'partnerDepositMissed',   label: 'Partner Deposit Missed' },
  { key: 'balanceConfirmationNudge', label: 'Balance Confirmation Nudge' },
  { key: 'weeklyVarianceSummary',  label: 'Weekly Variance Summary' },
  { key: 'savingsMilestone',       label: 'Savings Milestone' },
  { key: 'novaDailyDisposition',   label: 'NOVA Daily Disposition' },
  { key: 'payCycleReminder',       label: 'Pay Cycle Reminder' },
];

function addDays(ms, days) { return ms + days * 24 * 60 * 60 * 1000; }
function nextMonthSameDay(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime();
}
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

export default function SettingsScreen() {
  const {
    incomeEvents, varianceConfig, novaConfig, updateConfig, recomputeVariance,
    resetStore, updateVarianceConfig, updateNovaConfig,
    personalCardOrder, updateCardOrder,
    householdCardOrder, updateHouseholdCardOrder,
    businessCardOrder, updateBusinessCardOrder,
    spendingBuckets,
  } = useStore();
  const { exportAllData, importAllData, exportBusinessCsvs } = useExport();

  // --- Pay Schedule ---
  const [payFrequency, setPayFrequency] = useState('biweekly');
  const [pcMonth, setPcMonth] = useState('');
  const [pcDay, setPcDay] = useState('');
  const [pcYear, setPcYear] = useState('');

  // --- Variance Thresholds ---
  const [hhRedRaw, setHhRedRaw] = useState('');
  const [personalRedRaw, setPersonalRedRaw] = useState('');
  const [bizRedRaw, setBizRedRaw] = useState('');

  // --- Notifications ---
  const [notifToggles, setNotifToggles] = useState({});
  const [dailyTime, setDailyTime] = useState('09:00');

  // --- Export ---
  const [exportSchedule, setExportSchedule] = useState('off');

  // --- Payday Reminder ---
  const [paydayReminderEnabled, setPaydayReminderEnabled] = useState(
    notificationsConfig.paydayReminder.enabled ?? true
  );

  // --- Post-Payday Actions ---
  const [ppdExpiryHours, setPpdExpiryHours] = useState('12');
  const [ppdToggles, setPpdToggles] = useState({ venmo: true, savings: true });

  // --- Danger Zone ---
  const [resetInput, setResetInput] = useState('');
  const [personalOrderVisible, setPersonalOrderVisible] = useState(false);
  const [householdOrderVisible, setHouseholdOrderVisible] = useState(false);
  const [businessOrderVisible, setBusinessOrderVisible] = useState(false);

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
        if (cfg.postPaydayActionToggles) setPpdToggles(cfg.postPaydayActionToggles);
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
  const entrepreneurMode = novaConfig?.entrepreneurMode;
  const userMode = novaConfig?.userMode;
  const savingsGoalVisible = !!(novaConfig?.savingsGoal?.targetCents > 0);
  const hasGroceriesBucket = (spendingBuckets || []).some((b) => b.isActive !== false && b.type === 'groceries');
  const personalDisplayCards = [
    { id: 'accounts', label: 'Account Balances' },
    { id: 'pay_cycle', label: 'Pay Cycle' },
    ...(savingsGoalVisible ? [{ id: 'savings_goal', label: 'Savings Goal' }] : []),
    { id: 'bills', label: 'Bills & Subscriptions' },
    ...(hasGroceriesBucket && userMode === 'solo' ? [{ id: 'grocery', label: 'Grocery Budget' }] : []),
    { id: 'recent_activity', label: 'Recent Activity' },
  ];
  const householdDisplayCards = [
    { id: 'joint_balance', label: 'Shared Account' },
    { id: 'partner_deposit', label: 'Partner Deposit' },
    ...(hasGroceriesBucket ? [{ id: 'grocery', label: 'Grocery Budget' }] : []),
    { id: 'bills', label: 'Household Bills' },
    { id: 'recent_activity', label: 'Recent Activity' },
  ];
  const businessDisplayCards = [
    { id: 'business_balance', label: 'Business Summary' },
    { id: 'income', label: 'Income' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'mileage', label: 'Mileage' },
  ];

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

  const handlePpdToggle = async (key, val) => {
    const updated = { ...ppdToggles, [key]: val };
    setPpdToggles(updated);
    await updateNovaConfig({ postPaydayActionToggles: updated });
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerStrip}>
        <Text style={styles.screenTitle}>SETTINGS</Text>
        <Text style={styles.screenSubtitle}>Configuration</Text>
      </View>

      {/* 0a. PROFILE MODE */}
      <View style={styles.section}>
        <ProfileModeSection />
      </View>

      {/* 0b. ENTREPRENEUR MODE */}
      <View style={styles.section}>
        <EntrepreneurModeSection />
      </View>

      {/* 1. ACCOUNT FLOORS */}
      <View style={styles.section}>
        <AccountFloorsSection />
      </View>

      {/* 1b. ACCOUNTS */}
      <View style={styles.section}>
        <AccountsSection />
      </View>

      {/* 1c. SPENDING CATEGORIES */}
      <View style={styles.section}>
        <SpendingBucketsSection />
      </View>

      {/* 1d. SAVINGS GOAL */}
      <View style={styles.section}>
        <SavingsGoalSection />
      </View>

      {/* 2. PAY SCHEDULE */}
      <View style={styles.section}>
        <SectionHeader title="PAY SCHEDULE" />
        <Text style={styles.label}>Pay frequency</Text>
        <SegmentedControl options={FREQ_OPTIONS} value={payFrequency} onChange={setPayFrequency} />
        {payFrequency !== 'unscheduled' && (
          <>
            <Text style={styles.label}>Next paycheck date</Text>
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
          <Text style={styles.toggleLabel}>Remind me on payday</Text>
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
      </View>

      {/* 2a. PAYCHECK SPLIT */}
      <View style={styles.section}>
        <SectionHeader title="PAYCHECK SPLIT" />
        <PaycheckSplitSheet />
      </View>

      {/* 2b. POST-PAYDAY ACTIONS */}
      <View style={styles.section}>
        <SectionHeader title="POST-PAYDAY ACTIONS" />
        <Text style={styles.label}>Action window (hours)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={ppdExpiryHours}
          onChangeText={setPpdExpiryHours}
          onBlur={handlePpdExpiryBlur}
          placeholder="12"
          placeholderTextColor={theme.textDim}
        />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Remind me to move to Venmo</Text>
          <Switch
            value={ppdToggles.venmo !== false}
            onValueChange={val => handlePpdToggle('venmo', val)}
            trackColor={{ false: theme.borderColorDim, true: theme.accent }}
            thumbColor={theme.background}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Remind me to move to Savings</Text>
          <Switch
            value={ppdToggles.savings !== false}
            onValueChange={val => handlePpdToggle('savings', val)}
            trackColor={{ false: theme.borderColorDim, true: theme.accent }}
            thumbColor={theme.background}
          />
        </View>
      </View>

      {/* 3. PARTNER DEPOSIT */}
      <View style={styles.section}>
        <PartnerDepositSection />
      </View>

      {/* 4. VARIANCE THRESHOLDS */}
      <View style={styles.section}>
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
      </View>

      {/* 5. IRS MILEAGE RATE */}
      <View style={styles.section}>
        <IrsMileageRateSection />
      </View>

      {/* 6. NOTIFICATIONS */}
      <View style={styles.section}>
        <SectionHeader title="NOTIFICATIONS" />
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
      </View>

      {/* 7. EXPORT / IMPORT */}
      <View style={styles.section}>
        <SectionHeader title="DATA" />
        <Text style={styles.label}>Auto-export schedule</Text>
        <SegmentedControl options={EXPORT_SCHEDULE_OPTIONS} value={exportSchedule} onChange={handleSaveExportSchedule} />
        <TouchableOpacity style={styles.saveBtn} onPress={exportAllData}>
          <Text style={styles.saveBtnText}>EXPORT ALL DATA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={exportBusinessCsvs}>
          <Text style={styles.saveBtnText}>EXPORT BUSINESS CSVs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, styles.importBtn]} onPress={importAllData}>
          <Text style={styles.importBtnText}>IMPORT DATA</Text>
        </TouchableOpacity>
      </View>

      {/* 8. DISPLAY */}
      <View style={styles.section}>
        <SectionHeader title="DISPLAY" />
        <TouchableOpacity style={styles.saveBtn} onPress={() => setPersonalOrderVisible(true)}>
          <Text style={styles.saveBtnText}>PERSONAL CARD ORDER</Text>
        </TouchableOpacity>
        {userMode === 'partnered' && (
          <TouchableOpacity style={styles.saveBtn} onPress={() => setHouseholdOrderVisible(true)}>
            <Text style={styles.saveBtnText}>HOUSEHOLD CARD ORDER</Text>
          </TouchableOpacity>
        )}
        {entrepreneurMode && (
          <TouchableOpacity style={styles.saveBtn} onPress={() => setBusinessOrderVisible(true)}>
            <Text style={styles.saveBtnText}>BUSINESS CARD ORDER</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 9. ABOUT */}
      <View style={styles.section}>
        <AboutSection />
      </View>

      {/* DANGER ZONE */}
      <View style={[styles.section, styles.dangerSection]}>
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
      </View>
      <CardOrderSheet
        visible={personalOrderVisible}
        title="PERSONAL CARD ORDER"
        cards={personalDisplayCards}
        currentOrder={personalCardOrder}
        onSave={updateCardOrder}
        onClose={() => setPersonalOrderVisible(false)}
      />
      <CardOrderSheet
        visible={householdOrderVisible}
        title="HOUSEHOLD CARD ORDER"
        cards={householdDisplayCards}
        currentOrder={householdCardOrder}
        onSave={updateHouseholdCardOrder}
        onClose={() => setHouseholdOrderVisible(false)}
      />
      <CardOrderSheet
        visible={businessOrderVisible}
        title="BUSINESS CARD ORDER"
        cards={businessDisplayCards}
        currentOrder={businessCardOrder}
        onSave={updateBusinessCardOrder}
        onClose={() => setBusinessOrderVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: theme.spacingMD, paddingBottom: theme.spacingXXL },
  headerStrip: { marginBottom: theme.spacingMD },
  screenTitle: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, fontWeight: 'bold' },
  screenSubtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginTop: theme.spacingXS },
  section: { backgroundColor: theme.backgroundCard, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, marginBottom: theme.spacingMD },
  sectionHeader: { color: theme.accent, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingMD, letterSpacing: 1 },
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
  confirmBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD },
  confirmBtnDisabled: { borderColor: theme.borderColorDim, opacity: 0.5 },
  confirmBtnText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  confirmBtnTextDisabled: { color: theme.textDim },
  lastConfirmedText: { color: theme.textDim, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, marginTop: theme.spacingSM, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacingSM, borderBottomWidth: 1, borderBottomColor: theme.borderColorDim },
  toggleLabel: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, flex: 1 },
  importBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent, marginTop: theme.spacingSM },
  importBtnText: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacingXS },
  splitLabel: { color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, flex: 1 },
  splitInput: { backgroundColor: theme.backgroundPanel, borderWidth: 1, borderColor: theme.borderColorDim, borderRadius: theme.borderRadiusMD, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, width: 110, textAlign: 'right' },
  splitTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.borderColorDim, paddingTop: theme.spacingSM, marginTop: theme.spacingXS },
  splitTotalLabel: { color: theme.textSecondary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM },
  splitTotalAmt: { color: theme.accent, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  dangerSection: { borderColor: theme.statusDanger },
  dangerHeader: { color: theme.statusDanger, fontSize: theme.fontSizeLG, fontFamily: theme.fontPrimary, fontWeight: 'bold', marginBottom: theme.spacingMD, letterSpacing: 1 },
  dangerLabel: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, marginBottom: theme.spacingXS, marginTop: theme.spacingSM },
  resetBtn: { borderWidth: 1, borderColor: theme.statusDanger, borderRadius: theme.borderRadiusMD, padding: theme.spacingMD, alignItems: 'center', marginTop: theme.spacingMD, backgroundColor: theme.statusDangerBg },
  resetBtnDisabled: { borderColor: theme.borderColorDim, backgroundColor: 'transparent', opacity: 0.4 },
  resetBtnText: { color: theme.statusDanger, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeMD, fontWeight: 'bold' },
  resetBtnTextDisabled: { color: theme.textDim },
});
