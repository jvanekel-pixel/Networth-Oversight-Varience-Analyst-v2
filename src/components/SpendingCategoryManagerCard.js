import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import {
  AUTO_ACTIVE_SPENDING_CATEGORIES,
  CATEGORY_GROCERIES,
  canonicalCategoryLabel,
  categoryKey,
  dedupeCategoryLabels,
  isAutoActiveSpendingCategory,
  SPENDING_CATEGORY_SUGGESTIONS,
} from '../utils/spendingCategories';

const PROFILE_LABELS = {
  household: 'HOUSEHOLD',
  personal: 'PERSONAL',
  business: 'BUSINESS',
};

function bucketScope(bucket) {
  return bucket?.scope || bucket?.profile || 'all';
}

function matchesProfile(bucket, profile) {
  const scope = bucketScope(bucket);
  return scope === 'all' || scope === profile;
}

function matchesAccount(bucket, accountKey = null) {
  const keys = Array.isArray(bucket?.accountKeys)
    ? bucket.accountKeys.filter(Boolean)
    : [];
  if (keys.length === 0 || !accountKey) return true;
  return keys.includes(accountKey);
}

function normalizedName(value) {
  return canonicalCategoryLabel(value, '');
}

export function getActiveSpendingCategoryNames(spendingBuckets = [], profile = null, accountKey = null) {
  return dedupeCategoryLabels([
    ...AUTO_ACTIVE_SPENDING_CATEGORIES,
    ...(spendingBuckets || [])
      .filter(bucket => bucket?.isActive !== false)
      .filter(bucket => !profile || matchesProfile(bucket, profile))
      .filter(bucket => matchesAccount(bucket, accountKey))
      .map(bucket => bucket.name || bucket.label),
  ]);
}

function accountKeyForOption(account) {
  return account?.legacyKey || account?.id || account?.key || null;
}

export default function SpendingCategoryManagerCard({ profile = 'personal', style }) {
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const addBucket = useStore((s) => s.addBucket);
  const editBucket = useStore((s) => s.editBucket);
  const [newName, setNewName] = useState('');
  const [groceryAccountKey, setGroceryAccountKey] = useState('all');

  const profileBuckets = useMemo(
    () => (spendingBuckets || []).filter(bucket => matchesProfile(bucket, profile)),
    [spendingBuckets, profile],
  );
  const activeNames = getActiveSpendingCategoryNames(spendingBuckets, profile);
  const activeNameKeys = new Set(activeNames.map(categoryKey));
  const profileAccountOptions = useMemo(
    () => (accountRegistry || [])
      .filter(account => account?.isActive !== false && (!profile || account.role === profile))
      .map(account => ({
        key: accountKeyForOption(account),
        label: account.name || account.id || account.legacyKey,
      }))
      .filter(option => option.key),
    [accountRegistry, profile],
  );
  const accountLabelByKey = new Map(profileAccountOptions.map(option => [option.key, option.label]));
  const existingByName = new Map();
  profileBuckets.forEach(bucket => {
    const key = categoryKey(bucket.name || bucket.label);
    if (!key) return;
    const existing = existingByName.get(key);
    const bucketIsActive = bucket?.isActive !== false;
    const existingIsActive = existing?.isActive !== false;
    const bucketIsProfileExact = bucketScope(bucket) === profile;
    const existingIsProfileExact = existing && bucketScope(existing) === profile;
    if (!existing || (!existingIsActive && bucketIsActive) || (!existingIsProfileExact && bucketIsProfileExact)) {
      existingByName.set(key, bucket);
    }
  });
  const suggestions = SPENDING_CATEGORY_SUGGESTIONS
    .filter(name => !activeNameKeys.has(categoryKey(name)));
  const canConfigureGroceryAccount = suggestions.some(name => categoryKey(name) === categoryKey(CATEGORY_GROCERIES));

  function getAccountScopedUpdates(name) {
    if (categoryKey(name) !== categoryKey(CATEGORY_GROCERIES)) return {};
    const selectedAccount = profileAccountOptions.find(option => option.key === groceryAccountKey);
    return selectedAccount ? { accountKeys: [selectedAccount.key] } : { accountKeys: null };
  }

  function getActiveAccountLabel(name) {
    if (categoryKey(name) !== categoryKey(CATEGORY_GROCERIES)) return '';
    const bucket = existingByName.get(categoryKey(name));
    const keys = Array.isArray(bucket?.accountKeys) ? bucket.accountKeys.filter(Boolean) : [];
    if (keys.length === 0) return 'ALL';
    if (keys.length === 1) return accountLabelByKey.get(keys[0]) || keys[0];
    return `${keys.length} ACCOUNTS`;
  }

  async function activateName(name) {
    const clean = normalizedName(name);
    if (!clean) return;
    const scopedUpdates = getAccountScopedUpdates(clean);
    const existing = existingByName.get(categoryKey(clean));
    if (existing) {
      await editBucket(existing.id, { isActive: true, scope: profile, profile, ...scopedUpdates });
      return;
    }
    await addBucket({ name: clean, label: clean, isActive: true, scope: profile, profile, ...scopedUpdates });
  }

  async function deactivateCategory(name) {
    if (isAutoActiveSpendingCategory(name)) return;
    const key = categoryKey(name);
    const matchingBuckets = profileBuckets.filter(item =>
      item?.isActive !== false && categoryKey(item.name || item.label) === key
    );
    await Promise.all(matchingBuckets.map(item => editBucket(item.id, { isActive: false })));
  }

  async function handleCustomAdd() {
    const clean = normalizedName(newName);
    if (!clean) return;
    await activateName(clean);
    setNewName('');
  }

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.header}>{PROFILE_LABELS[profile] || 'SPENDING'} CATEGORIES</Text>

      {activeNames.length > 0 && (
        <View style={styles.chipGrid}>
          {activeNames.map(name => {
            const isLocked = isAutoActiveSpendingCategory(name);
            const accountLabel = getActiveAccountLabel(name);
            return (
            <TouchableOpacity
              key={categoryKey(name)}
              style={[styles.chip, styles.chipActive, isLocked && styles.chipLocked]}
              onPress={() => deactivateCategory(name)}
              activeOpacity={0.8}
              disabled={isLocked}
            >
              <Text style={styles.chipTextActive}>
                {normalizedName(name).toUpperCase()}{accountLabel ? ` - ${accountLabel.toUpperCase()}` : ''}
              </Text>
            </TouchableOpacity>
          );})}
        </View>
      )}

      <Text style={styles.subhead}>AVAILABLE</Text>
      {canConfigureGroceryAccount && profileAccountOptions.length > 0 && (
        <View style={styles.scopePanel}>
          <Text style={styles.scopeLabel}>GROCERY TRACKING ACCOUNT</Text>
          <View style={styles.chipGridTight}>
            <TouchableOpacity
              style={[styles.scopeChip, groceryAccountKey === 'all' && styles.scopeChipActive]}
              onPress={() => setGroceryAccountKey('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.scopeChipText, groceryAccountKey === 'all' && styles.scopeChipTextActive]}>
                ALL
              </Text>
            </TouchableOpacity>
            {profileAccountOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.scopeChip, groceryAccountKey === option.key && styles.scopeChipActive]}
                onPress={() => setGroceryAccountKey(option.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.scopeChipText, groceryAccountKey === option.key && styles.scopeChipTextActive]}>
                  {String(option.label || option.key).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <View style={styles.chipGrid}>
        {suggestions.map(name => (
          <TouchableOpacity
            key={name}
            style={styles.chip}
            onPress={() => activateName(name)}
            activeOpacity={0.8}
          >
            <Text style={styles.chipText}>{name.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Custom category"
          placeholderTextColor={theme.textDim}
          returnKeyType="done"
          onSubmitEditing={handleCustomAdd}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleCustomAdd} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>ADD</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  header: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
    letterSpacing: 1,
  },
  meta: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  subhead: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    letterSpacing: 1,
    marginBottom: theme.spacingSM,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingXS,
    marginBottom: theme.spacingMD,
  },
  chipGridTight: {
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
  chipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipLocked: {
    borderColor: theme.borderColor,
  },
  chipText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  chipTextActive: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  scopePanel: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    marginBottom: theme.spacingSM,
    backgroundColor: theme.backgroundPanel,
  },
  scopeLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  scopeChip: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    paddingVertical: 4,
    backgroundColor: theme.backgroundCard,
  },
  scopeChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  scopeChipText: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  scopeChipTextActive: {
    color: theme.accent,
    fontWeight: 'bold',
  },
  addRow: {
    flexDirection: 'row',
    gap: theme.spacingSM,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    padding: theme.spacingSM,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    backgroundColor: theme.backgroundPanel,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingMD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentGlow,
  },
  addBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
});
