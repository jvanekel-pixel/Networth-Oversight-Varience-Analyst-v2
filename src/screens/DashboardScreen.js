import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import { timeAgo } from '../utils/dates';

const PROFILE_LABELS = { household: 'Household', personal: 'Personal', business: 'Business' };
const TAB_NAMES = { household: 'HOUSEHOLD', personal: 'PERSONAL', business: 'BUSINESS' };

function getBorderBg(state) {
  switch (state) {
    case 'green':  return { border: theme.statusPositive, bg: theme.statusPositiveBg };
    case 'yellow': return { border: theme.statusWarning,  bg: theme.statusWarningBg };
    case 'red':    return { border: theme.statusDanger,   bg: theme.statusDangerBg };
    default:       return { border: theme.borderColorDim, bg: theme.backgroundCard };
  }
}

function VarianceCard({ profile, data, onPress }) {
  const { border, bg } = getBorderBg(data.state);
  const isNeutral = data.state === 'neutral';
  const varianceSign = data.variance > 0 ? '+' : '';
  const varianceColor = data.variance > 0
    ? theme.statusPositive
    : data.variance < 0
    ? theme.statusDanger
    : theme.textSecondary;

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: border, backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.profileName, { color: isNeutral ? theme.textDim : theme.accent }]}>
        {PROFILE_LABELS[profile]}
      </Text>
      <Text style={styles.balance}>{formatCentsShort(data.balance)}</Text>
      <Text style={[styles.variance, { color: varianceColor }]}>
        {varianceSign}{formatCentsShort(data.variance)}
      </Text>
      <Text style={styles.annotation}>{data.annotation}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const householdData = useStore((s) => s.varianceCache.household);
  const personalData  = useStore((s) => s.varianceCache.personal);
  const businessData  = useStore((s) => s.varianceCache.business);
  const transactions = useStore((s) => s.transactions);
  const confirmBalance = useStore((s) => s.confirmBalance);

  const now = new Date();
  const cycleLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const recentTx = [...(transactions || [])]
    .filter(t => !t.deleted)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 3);

  const navigateTo = (profile) => {
    navigation?.navigate(TAB_NAMES[profile]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>DASHBOARD</Text>
          <Text style={styles.screenSubtitle}>Three Zone Overview</Text>
        </View>
        <Text style={styles.cycleLabel}>Cycle: {cycleLabel}</Text>
      </View>

      {/* Profile cards */}
      <View style={styles.cardsContainer}>
        <VarianceCard profile="household" data={householdData || { balance: 0, variance: 0, state: 'neutral', annotation: '—' }} onPress={() => navigateTo('household')} />
        <VarianceCard profile="personal"  data={personalData  || { balance: 0, variance: 0, state: 'neutral', annotation: '—' }} onPress={() => navigateTo('personal')} />
        <VarianceCard profile="business"  data={businessData  || { balance: 0, variance: 0, state: 'neutral', annotation: '—' }} onPress={() => navigateTo('business')} />
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation?.navigate('Calendar')}
        >
          <Text style={styles.quickBtnText}>VIEW CALENDAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation?.navigate('HOUSEHOLD')}
        >
          <Text style={styles.quickBtnText}>LOG TRANSACTION</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => confirmBalance()}
        >
          <Text style={styles.quickBtnText}>CONFIRM BALANCE</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <Text style={styles.activityHeader}>RECENT ACTIVITY</Text>
        {recentTx.length === 0 && (
          <Text style={styles.emptyText}>No transactions yet.</Text>
        )}
        {recentTx.map(tx => {
          const isPositive = tx.amountCents > 0;
          const desc = (tx.description || '').slice(0, 30);
          return (
            <View key={tx.id} style={styles.activityRow}>
              <Text style={[styles.activityAmt, { color: isPositive ? theme.statusPositive : theme.textPrimary }]}>
                {isPositive ? '+' : ''}{formatCentsShort(tx.amountCents)}
              </Text>
              <Text style={styles.activityDesc} numberOfLines={1}>{desc}</Text>
              <Text style={styles.activityMeta}>{timeAgo(tx.timestamp)}</Text>
            </View>
          );
        })}
        <TouchableOpacity onPress={() => Alert.alert('Full log coming in Session 5')}>
          <Text style={styles.viewAllText}>VIEW ALL</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingVertical: theme.spacingMD,
    paddingBottom: theme.spacingXXL,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacingMD,
  },
  screenTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  screenSubtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  cycleLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: 4,
  },
  cardsContainer: {
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  card: {
    padding: theme.spacingLG,
    borderRadius: theme.radiusLG,
    borderWidth: 2,
  },
  profileName: {
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingXS,
  },
  balance: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  variance: {
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    marginBottom: 2,
  },
  annotation: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacingMD,
    gap: theme.spacingXS,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    paddingVertical: theme.spacingSM,
    paddingHorizontal: theme.spacingXS,
    alignItems: 'center',
  },
  quickBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
  },
  activitySection: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
  },
  activityHeader: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: theme.spacingMD,
    letterSpacing: 1,
  },
  emptyText: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingMD,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacingXS,
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
  },
  activityAmt: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: 'bold',
    width: 80,
  },
  activityDesc: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  activityMeta: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
  },
  viewAllText: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingSM,
    textAlign: 'right',
  },
});
