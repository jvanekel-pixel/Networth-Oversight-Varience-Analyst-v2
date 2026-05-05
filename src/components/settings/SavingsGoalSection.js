import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../../config/theme.config';
import useStore from '../../store/useStore';
import { formatCentsShort, parseBillInput } from '../../utils/currency';
import {
  SAVINGS_GOAL_PRESETS,
  SAVINGS_GOAL_SCOPES,
  accountDisplayNameForSavingsGoal,
  getSavingsGoalProgress,
  normalizeSavingsGoal,
  normalizeSavingsGoals,
} from '../../utils/savingsGoals';

function dateToInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function inputToIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  }
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const d = new Date(year, Number(match[1]) - 1, Number(match[2]), 12, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

function centsToInput(cents) {
  return cents > 0 ? String(cents / 100) : '';
}

function makeBlankForm(defaultAccountId = null) {
  const preset = SAVINGS_GOAL_PRESETS[0];
  return {
    id: null,
    key: preset.key,
    label: preset.label,
    targetRaw: centsToInput(preset.targetCents),
    currentRaw: '',
    monthlyRaw: '',
    targetDateRaw: '',
    accountId: defaultAccountId,
    scope: 'personal',
  };
}

export default function SavingsGoalSection() {
  const novaConfig = useStore((s) => s.novaConfig);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const accounts = useStore((s) => s.accounts);
  const upsertSavingsGoal = useStore((s) => s.upsertSavingsGoal);
  const deleteSavingsGoal = useStore((s) => s.deleteSavingsGoal);
  const goals = normalizeSavingsGoals(novaConfig?.savingsGoals, novaConfig?.savingsGoal);

  const eligibleAccounts = useMemo(() => [...(accountRegistry || [])]
    .filter(account => account && account.isActive !== false)
    .sort((a, b) => {
      if (a.type === 'savings' && b.type !== 'savings') return -1;
      if (b.type === 'savings' && a.type !== 'savings') return 1;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    }), [accountRegistry]);

  const defaultAccountId = eligibleAccounts[0] ? (eligibleAccounts[0].legacyKey || eligibleAccounts[0].id) : null;
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(makeBlankForm(defaultAccountId));
  const [savedId, setSavedId] = useState(null);

  function openAdd() {
    setForm(makeBlankForm(defaultAccountId));
    setModalVisible(true);
  }

  function openEdit(goal) {
    setForm({
      id: goal.id,
      key: goal.key || 'custom',
      label: goal.label || '',
      targetRaw: centsToInput(goal.targetCents || 0),
      currentRaw: centsToInput(goal.currentCents || 0),
      monthlyRaw: centsToInput(goal.monthlyContributionCents || 0),
      targetDateRaw: dateToInput(goal.targetDate),
      accountId: goal.accountId || null,
      scope: goal.scope || 'personal',
    });
    setModalVisible(true);
  }

  function selectPreset(preset) {
    setForm(prev => ({
      ...prev,
      key: preset.key,
      label: preset.key === 'custom' ? '' : preset.label,
      targetRaw: preset.targetCents > 0 ? centsToInput(preset.targetCents) : prev.targetRaw,
    }));
  }

  async function handleSave() {
    const targetCents = parseBillInput(form.targetRaw);
    if (targetCents <= 0) {
      Alert.alert('Target needed', 'Add a target amount for this savings goal.');
      return;
    }
    const targetDate = inputToIsoDate(form.targetDateRaw);
    if (form.targetDateRaw.trim() && !targetDate) {
      Alert.alert('Check the date', 'Use MM/DD/YYYY or YYYY-MM-DD for the target date.');
      return;
    }
    const preset = SAVINGS_GOAL_PRESETS.find(item => item.key === form.key);
    const saved = await upsertSavingsGoal(normalizeSavingsGoal({
      id: form.id,
      key: form.key || 'custom',
      label: (form.label || preset?.label || 'Savings Goal').trim(),
      targetCents,
      ...(form.currentRaw.trim() ? { currentCents: parseBillInput(form.currentRaw) } : {}),
      monthlyContributionCents: parseBillInput(form.monthlyRaw),
      targetDate,
      accountId: form.accountId,
      scope: form.scope,
    }));
    setSavedId(saved.id);
    setTimeout(() => setSavedId(null), 1800);
    setModalVisible(false);
  }

  function handleDelete(goal) {
    Alert.alert('Delete Savings Goal', `Remove ${goal.label || 'this goal'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSavingsGoal(goal.id) },
    ]);
  }

  return (
    <View>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.header}>SAVINGS GOALS</Text>
          <Text style={styles.subCopy}>Sinking funds, targets, monthly contribution plans, and the account each fund lives in.</Text>
        </View>
      </View>

      {goals.length === 0 ? (
        <Text style={styles.empty}>No savings goals yet.</Text>
      ) : goals.map(goal => {
        const progress = getSavingsGoalProgress(goal, accounts, accountRegistry);
        const targetDate = dateToInput(goal.targetDate);
        const accountName = accountDisplayNameForSavingsGoal(goal, accountRegistry) || 'No linked account';
        const scopeLabel = SAVINGS_GOAL_SCOPES.find(item => item.key === goal.scope)?.label || 'Personal';
        return (
          <View key={goal.id} style={styles.goalRow}>
            <View style={styles.goalHeader}>
              <View style={styles.goalInfo}>
                <Text style={styles.goalName}>{goal.label || 'Savings Goal'}</Text>
                <Text style={styles.goalMeta}>{scopeLabel} / {accountName}</Text>
              </View>
              <Text style={[styles.percentText, progress.complete && styles.completeText]}>{progress.percent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(1, progress.percent)}%` }, progress.complete && styles.completeFill]} />
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountText}>{formatCentsShort(progress.currentCents)} / {formatCentsShort(progress.targetCents)}</Text>
              <Text style={styles.amountText}>
                {goal.monthlyContributionCents ? `${formatCentsShort(goal.monthlyContributionCents)}/mo` : `${formatCentsShort(progress.remainingCents)} left`}
              </Text>
            </View>
            {targetDate ? <Text style={styles.goalMeta}>Target date: {targetDate}</Text> : null}
            {savedId === goal.id ? <Text style={styles.savedText}>SAVED</Text> : null}
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openEdit(goal)} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(goal)} activeOpacity={0.8}>
                <Text style={styles.deleteBtnText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
        <Text style={styles.addBtnText}>+ ADD SAVINGS GOAL</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.sheetTitle}>{form.id ? 'EDIT SAVINGS GOAL' : 'ADD SAVINGS GOAL'}</Text>

              <Text style={styles.fieldLabel}>GOAL</Text>
              <View style={styles.chipGrid}>
                {SAVINGS_GOAL_PRESETS.map(preset => {
                  const selected = form.key === preset.key;
                  return (
                    <TouchableOpacity
                      key={preset.key}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => selectPreset(preset)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{preset.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.input}
                value={form.label}
                onChangeText={(value) => setForm(prev => ({ ...prev, label: value, key: prev.key === 'custom' ? 'custom' : prev.key }))}
                placeholder="Christmas, car repair, taxes..."
                placeholderTextColor={theme.textDim}
              />

              <Text style={styles.fieldLabel}>TARGET AMOUNT</Text>
              <TextInput
                style={styles.input}
                value={form.targetRaw}
                onChangeText={(value) => setForm(prev => ({ ...prev, targetRaw: value }))}
                placeholder="0.00"
                placeholderTextColor={theme.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>CURRENT SAVED</Text>
              <TextInput
                style={styles.input}
                value={form.currentRaw}
                onChangeText={(value) => setForm(prev => ({ ...prev, currentRaw: value }))}
                placeholder="0.00"
                placeholderTextColor={theme.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>MONTHLY CONTRIBUTION</Text>
              <TextInput
                style={styles.input}
                value={form.monthlyRaw}
                onChangeText={(value) => setForm(prev => ({ ...prev, monthlyRaw: value }))}
                placeholder="0.00"
                placeholderTextColor={theme.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>TARGET DATE</Text>
              <TextInput
                style={styles.input}
                value={form.targetDateRaw}
                onChangeText={(value) => setForm(prev => ({ ...prev, targetDateRaw: value }))}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={theme.textDim}
              />

              <Text style={styles.fieldLabel}>PUT MONEY INTO</Text>
              <View style={styles.chipGrid}>
                <TouchableOpacity
                  style={[styles.chip, !form.accountId && styles.chipOn]}
                  onPress={() => setForm(prev => ({ ...prev, accountId: null }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, !form.accountId && styles.chipTextOn]}>NO LINK</Text>
                </TouchableOpacity>
                {eligibleAccounts.map(account => {
                  const key = account.legacyKey || account.id;
                  const selected = form.accountId === key || form.accountId === account.id;
                  return (
                    <TouchableOpacity
                      key={account.id}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => setForm(prev => ({ ...prev, accountId: key }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{(account.name || account.id).toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>SHOW ON</Text>
              <View style={styles.chipGrid}>
                {SAVINGS_GOAL_SCOPES.map(scope => {
                  const selected = form.scope === scope.key;
                  return (
                    <TouchableOpacity
                      key={scope.key}
                      style={[styles.chip, selected && styles.chipOn]}
                      onPress={() => setForm(prev => ({ ...prev, scope: scope.key }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{scope.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveText}>SAVE GOAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    marginBottom: theme.spacingSM,
  },
  header: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  subCopy: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingXS,
  },
  empty: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingMD,
    fontStyle: 'italic',
  },
  goalRow: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
    backgroundColor: theme.backgroundPanel,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacingSM,
  },
  goalInfo: {
    flex: 1,
    minWidth: 0,
  },
  goalName: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  goalMeta: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  percentText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  completeText: {
    color: theme.statusPositive,
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.backgroundCard,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: theme.spacingSM,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  completeFill: {
    backgroundColor: theme.statusPositive,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
  },
  amountText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  savedText: {
    color: theme.statusPositive,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacingSM,
    marginTop: theme.spacingMD,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.statusDanger,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    alignItems: 'center',
    backgroundColor: theme.statusDangerBg,
  },
  deleteBtnText: {
    color: theme.statusDanger,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  addBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    alignItems: 'center',
    backgroundColor: theme.accentGlow,
  },
  addBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.overlayBg,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: theme.backgroundSecondary,
    borderTopLeftRadius: theme.borderRadiusLG,
    borderTopRightRadius: theme.borderRadiusLG,
    borderTopWidth: 1,
    borderColor: theme.borderColor,
  },
  sheetContent: {
    padding: theme.spacingLG,
    gap: theme.spacingSM,
  },
  sheetTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: theme.spacingSM,
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    letterSpacing: 1,
    marginTop: theme.spacingXS,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    backgroundColor: theme.backgroundPanel,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 5,
    backgroundColor: theme.backgroundPanel,
  },
  chipOn: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  chipTextOn: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacingMD,
    padding: theme.spacingLG,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 2,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    alignItems: 'center',
    backgroundColor: theme.accentGlow,
  },
  cancelText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  saveText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
});
