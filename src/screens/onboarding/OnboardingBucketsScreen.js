import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import theme from '../../config/theme.config';
import ProgressBar from './ProgressBar';
import { useWizard } from './WizardContext';
import {
  AUTO_ACTIVE_SPENDING_CATEGORIES,
  SPENDING_CATEGORY_SUGGESTIONS,
  canonicalCategoryLabel,
} from '../../utils/spendingCategories';

const STARTER_BUCKETS = [
  ...AUTO_ACTIVE_SPENDING_CATEGORIES,
  ...SPENDING_CATEGORY_SUGGESTIONS,
];

export default function OnboardingBucketsScreen({ navigation }) {
  const { wizardState, updateWizard } = useWizard();
  const [selected, setSelected] = useState(() => new Set(
    wizardState.buckets.length > 0
      ? wizardState.buckets.map((b) => canonicalCategoryLabel(b.name))
      : AUTO_ACTIVE_SPENDING_CATEGORIES,
  ));
  const [customInput, setCustomInput] = useState('');

  function togglePreset(name) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleAddCustom() {
    const name = canonicalCategoryLabel(customInput);
    if (!name) return;
    setSelected((prev) => new Set([...prev, name]));
    setCustomInput('');
  }

  function buildBuckets() {
    const now = Date.now();
    return [...selected].map((name, idx) => ({
      id: `bucket_${now}_${idx}`,
      isActive: true,
      name,
      label: name,
      categoryDefaultsAudited: true,
    }));
  }

  function handleNext() {
    const buckets = buildBuckets();
    updateWizard({ buckets });
    navigation.navigate('OnboardingSavingsGoal');
  }

  function handleSkip() {
    updateWizard({ buckets: [] });
    navigation.navigate('OnboardingSavingsGoal');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar hidden />
      <ProgressBar step={5} total={8} />
      <View style={styles.header}>
        <Text style={styles.title}>SPENDING CATEGORIES</Text>
        <Text style={styles.subtitle}>Start with suggestions, then add or remove anything.</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.chipGrid}>
          {STARTER_BUCKETS.map((name) => (
            <TouchableOpacity
              key={name}
              style={[styles.chip, selected.has(name) && styles.chipSelected]}
              onPress={() => togglePreset(name)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, selected.has(name) && styles.chipTextSelected]}>
                {name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          {[...selected].filter((n) => !STARTER_BUCKETS.includes(n)).map((name) => (
            <TouchableOpacity
              key={name}
              style={[styles.chip, styles.chipSelected]}
              onPress={() => togglePreset(name)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, styles.chipTextSelected]}>
                {name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            value={customInput}
            onChangeText={setCustomInput}
            placeholder="ADD CUSTOM CATEGORY"
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
            onSubmitEditing={handleAddCustom}
          />
          <TouchableOpacity style={styles.addCustomBtn} onPress={handleAddCustom} activeOpacity={0.8}>
            <Text style={styles.addCustomText}>+</Text>
          </TouchableOpacity>
        </View>
        {selected.size > 0 && (
          <Text style={styles.countLabel}>{selected.size} selected</Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cta} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.ctaText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: theme.spacingMD, paddingTop: theme.spacingMD, paddingBottom: theme.spacingMD },
  title: { color: theme.accent, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 2, marginBottom: theme.spacingXS },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingMD },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacingSM, marginBottom: theme.spacingMD },
  chip: { borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, paddingHorizontal: theme.spacingMD, paddingVertical: theme.spacingSM },
  chipSelected: { borderColor: theme.accent, backgroundColor: theme.accentGlow },
  chipText: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, letterSpacing: 1 },
  chipTextSelected: { color: theme.accent },
  customRow: { flexDirection: 'row', gap: theme.spacingSM, marginBottom: theme.spacingSM },
  customInput: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusSM, padding: theme.spacingSM, color: theme.textPrimary, fontFamily: theme.fontPrimary, fontSize: theme.fontSizeSM, backgroundColor: theme.backgroundPanel },
  addCustomBtn: { borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusSM, width: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentGlow },
  addCustomText: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary },
  countLabel: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, textAlign: 'center', marginTop: theme.spacingXS },
  footer: { flexDirection: 'row', paddingHorizontal: theme.spacingMD, paddingBottom: theme.spacingXXL, paddingTop: theme.spacingMD, gap: theme.spacingSM },
  back: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  backText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center' },
  skipText: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary },
  cta: { flex: 2, borderWidth: 1, borderColor: theme.accent, borderRadius: theme.borderRadiusMD, paddingVertical: theme.spacingMD, alignItems: 'center', backgroundColor: theme.accentGlow },
  ctaText: { color: theme.accent, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, fontWeight: 'bold', letterSpacing: 1 },
});
