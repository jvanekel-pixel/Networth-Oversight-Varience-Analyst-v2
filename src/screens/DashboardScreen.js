import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import { timeAgo } from '../utils/dates';
import { TIERED_BADGES, TIER_ORDER } from '../config/badges.config';
import { LogTransactionModal } from '../components/TransactionModal';
import SpendingChartsSection from '../components/SpendingChartsSection';
import BadgeMedal from '../components/badges/BadgeMedal';
import BadgeDetailModal from '../components/badges/BadgeDetailModal';
import CardOrderSheet from '../components/settings/CardOrderSheet';
import CardOrderLink from '../components/settings/CardOrderLink';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import { SAVINGS_GOALS_CARD_ID, savingsGoalsForScope } from '../utils/savingsGoals';
import CashFlowForecastCard from '../components/CashFlowForecastCard';
import TourCueCard from '../components/TourCueCard';
import { CASH_FLOW_FORECAST_CARD_ID } from '../utils/forecasting';
import { buildActiveAccountOptions, submitTransactionPayload } from '../utils/splitTransactions';

const PROFILE_LABELS = { household: 'Household', personal: 'Personal', business: 'Business' };
const PROFILE_COLORS = {
  household: theme.zoneHousehold,
  personal: theme.zonePersonal,
  business: theme.zoneBusiness,
};
const TAB_NAMES = { household: 'HOUSEHOLD', personal: 'PERSONAL', business: 'BUSINESS' };
const searchCopy = personality.transactionSearch;
const reportsCopy = personality.reports;

function getBadgeState(badgeState, badgeId) {
  return badgeState?.[badgeId] || { tier: null, values: { v1: 0, v2: 0, v3: 0 } };
}

function getNextTierDef(badge, tier) {
  if (tier === 'onyx') return badge.tiers[badge.tiers.length - 1];
  const currentIndex = tier ? TIER_ORDER.indexOf(tier) : -1;
  return badge.tiers[Math.min(currentIndex + 1, badge.tiers.length - 1)];
}

function getProgressRatio(state, targetTierDef) {
  const values = state?.values || {};
  const ratios = ['v1', 'v2', 'v3'].map(key => {
    const required = targetTierDef?.[key] || 0;
    if (required <= 0) return 1;
    return Math.max(0, Math.min(1, (values[key] || 0) / required));
  });
  return Math.min(...ratios);
}

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
  const profileColor = PROFILE_COLORS[profile] || theme.accent;
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
      <View style={styles.profileTitleRow}>
        <View style={[styles.profileDot, { backgroundColor: isNeutral ? theme.textDim : profileColor }]} />
        <Text style={[styles.profileName, { color: isNeutral ? theme.textDim : profileColor }]}>
          {PROFILE_LABELS[profile]}
        </Text>
      </View>
      <Text style={styles.balance}>{formatCentsShort(data.balance)}</Text>
      <Text style={[styles.variance, { color: varianceColor }]}>
        {varianceSign}{formatCentsShort(data.variance)}
      </Text>
      <Text style={styles.annotation}>{data.annotation}</Text>
    </TouchableOpacity>
  );
}

function BadgePreviewCard({ badgeState, entrepreneurMode }) {
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState(null);
  const earnedCount = TIERED_BADGES.filter(badge => getBadgeState(badgeState, badge.id).tier).length;
  const cardInnerWidth = Math.max(272, width - (theme.spacingMD * 4));
  const medalSize = Math.max(54, Math.min(74, Math.floor((cardInnerWidth - 28) / 4)));
  const badgeRows = [
    TIERED_BADGES.slice(0, 3),
    TIERED_BADGES.slice(3, 7),
    TIERED_BADGES.slice(7, 10),
  ];
  const selectedBadge = selectedId ? TIERED_BADGES.find(badge => badge.id === selectedId) : null;
  const selectedState = selectedBadge ? getBadgeState(badgeState, selectedBadge.id) : null;

  return (
    <View style={styles.badgeCard}>
      <View style={styles.achievementHeader}>
        <View style={styles.achievementLine} />
        <Text style={styles.achievementTitle}>ACHIEVEMENTS</Text>
        <View style={styles.achievementLine} />
      </View>
      <Text style={styles.achievementCount}>{earnedCount}/{TIERED_BADGES.length}</Text>
      <View style={styles.achievementBoard}>
        {badgeRows.map((row, rowIndex) => (
          <View
            key={`row_${rowIndex}`}
            style={[
              styles.achievementRow,
              rowIndex > 0 && { marginTop: -Math.floor(medalSize * 0.18) },
            ]}
          >
            {row.map((badge) => {
              const state = getBadgeState(badgeState, badge.id);
              const target = getNextTierDef(badge, state.tier);
              const progress = state.tier === 'onyx' ? 1 : getProgressRatio(state, target);
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeMedalCell, { width: medalSize, height: medalSize }]}
                  onPress={() => setSelectedId(badge.id)}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={`${badge.name} badge details`}
                >
                  <BadgeMedal badgeId={badge.id} tier={state.tier} size={medalSize} progress={progress} completed={state.tier === 'onyx'} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <BadgeDetailModal
        visible={!!selectedBadge}
        badge={selectedBadge}
        state={selectedState}
        entrepreneurMode={entrepreneurMode}
        onClose={() => setSelectedId(null)}
      />
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const householdData = useStore((s) => s.varianceCache.household);
  const personalData  = useStore((s) => s.varianceCache.personal);
  const businessData  = useStore((s) => s.varianceCache.business);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const confirmBalance = useStore((s) => s.confirmBalance);
  const logTransaction = useStore((s) => s.logTransaction);
  const checkSpendingFloors = useStore((s) => s.checkSpendingFloors);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const savingsGoals = useStore((s) => s.novaConfig?.savingsGoals || []);
  const badgeState = useStore((s) => s.badgeState);
  const entrepreneurMode = useStore((s) => s.novaConfig?.entrepreneurMode);
  const lastActivityAt = useStore((s) => s.lastActivityAt);
  const dashboardCardOrder = useStore((s) => s.dashboardCardOrder);
  const dashboardHiddenCards = useStore((s) => s.dashboardHiddenCards);
  const updateDashboardCardOrder = useStore((s) => s.updateDashboardCardOrder);
  const updateDashboardHiddenCards = useStore((s) => s.updateDashboardHiddenCards);
  const userMode = useStore((s) => s.novaConfig?.userMode);
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [cardOrderVisible, setCardOrderVisible] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const showHousehold = userMode === 'partnered' && (accountRegistry || []).some(a => a.isActive !== false && a.role === 'household');
  const showBusiness = entrepreneurMode !== false;
  const defaultLogAccount = useMemo(() => {
    const preferredRole = showHousehold ? 'household' : 'personal';
    return (accountRegistry || []).find(a => a.isActive !== false && a.role === preferredRole)
      || (accountRegistry || []).find(a => a.isActive !== false && a.role === 'personal')
      || null;
  }, [accountRegistry, showHousehold]);
  const defaultLogAccountKey = defaultLogAccount ? (defaultLogAccount.legacyKey || defaultLogAccount.id) : null;
  const defaultLogAccountName = defaultLogAccount ? (defaultLogAccount.name || defaultLogAccount.id) : 'No account configured';
  const defaultLogProfile = defaultLogAccount?.role || null;
  const dashboardLogAccountOptions = useMemo(
    () => buildActiveAccountOptions(accountRegistry, accounts).map(option => ({
      ...option,
      label: String(option.label || option.key).toUpperCase(),
    })),
    [accountRegistry, accounts],
  );

  const now = new Date();
  const cycleLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lastLoggedLabel = useMemo(() => `Last logged: ${timeAgo(lastActivityAt)}`, [clockTick, lastActivityAt]);

  const recentTx = [...(transactions || [])]
    .filter(t => !t.deleted)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 3);
  const allSavingsGoals = savingsGoalsForScope(savingsGoals);
  const activeDashboardCardIds = ['variance', CASH_FLOW_FORECAST_CARD_ID, 'charts', SAVINGS_GOALS_CARD_ID, 'quick_actions', 'badges', 'recent_activity'];
  const dashboardDisplayCards = [
    { id: 'variance', label: 'Zone Overview' },
    { id: CASH_FLOW_FORECAST_CARD_ID, label: 'Cash-Flow Forecast' },
    { id: 'charts', label: 'Spending Charts' },
    { id: SAVINGS_GOALS_CARD_ID, label: 'Savings Goals' },
    { id: 'quick_actions', label: 'Quick Actions' },
    { id: 'badges', label: 'Achievements' },
    { id: 'recent_activity', label: 'Recent Activity' },
  ];
  const orderedDashboardCards = [
    ...(dashboardCardOrder || []).filter((id) => activeDashboardCardIds.includes(id)),
    ...activeDashboardCardIds.filter((id) => !(dashboardCardOrder || []).includes(id)),
  ];

  const navigateTo = (profile) => {
    navigation?.navigate(TAB_NAMES[profile]);
  };

  const handleQuickLogPress = () => {
    if (defaultLogAccountKey) {
      setQuickLogVisible(true);
      return;
    }
    navigation?.navigate(theme.tabSettings);
  };

  const handleQuickLogSubmit = async (payload) => {
    const result = await submitTransactionPayload(logTransaction, payload, defaultLogAccountKey);
    checkSpendingFloors();
    return result;
  };

  const renderVarianceOverviewCard = () => (
    <View style={styles.cardsContainer}>
      {showHousehold && (
        <VarianceCard profile="household" data={householdData || { balance: 0, variance: 0, state: 'neutral', annotation: '-' }} onPress={() => navigateTo('household')} />
      )}
      <VarianceCard profile="personal" data={personalData || { balance: 0, variance: 0, state: 'neutral', annotation: '-' }} onPress={() => navigateTo('personal')} />
      {showBusiness && (
        <VarianceCard profile="business" data={businessData || { balance: 0, variance: 0, state: 'neutral', annotation: '-' }} onPress={() => navigateTo('business')} />
      )}
    </View>
  );

  const renderQuickActionsCard = () => (
    <View style={styles.quickRow}>
      <TouchableOpacity
        style={styles.quickBtn}
        onPress={() => navigation?.navigate('Calendar', { mode: 'dashboard' })}
      >
        <Text style={styles.quickBtnText}>VIEW CALENDAR</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickBtn}
        onPress={handleQuickLogPress}
      >
        <Text style={styles.quickBtnText}>LOG TRANSACTION</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRecentActivityCard = () => (
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
            <Text style={[styles.activityAmt, { color: isPositive ? theme.calendarIncomeColor : theme.statusDanger }]}>
              {isPositive ? '+' : ''}{formatCentsShort(tx.amountCents)}
            </Text>
            <Text style={styles.activityDesc} numberOfLines={1}>{desc}</Text>
            <Text style={styles.activityMeta}>{timeAgo(tx.timestamp)}</Text>
          </View>
        );
      })}
      <TouchableOpacity onPress={() => navigation?.navigate('Calendar', { mode: 'dashboard' })}>
        <Text style={styles.viewAllText}>VIEW ALL</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDashboardCard = (id) => {
    if (id === 'variance') return renderVarianceOverviewCard();
    if (id === CASH_FLOW_FORECAST_CARD_ID) return <CashFlowForecastCard profile="dashboard" />;
    if (id === 'charts') return <SpendingChartsSection />;
    if (id === SAVINGS_GOALS_CARD_ID) {
      return (
        <SavingsGoalsCard
          goals={allSavingsGoals}
          accounts={accounts}
          accountRegistry={accountRegistry}
          title="ALL SAVINGS GOALS"
        />
      );
    }
    if (id === 'quick_actions') return renderQuickActionsCard();
    if (id === 'badges') return <BadgePreviewCard badgeState={badgeState} entrepreneurMode={entrepreneurMode} />;
    if (id === 'recent_activity') return renderRecentActivityCard();
    return null;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >
      {/* Header */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>DASHBOARD</Text>
          <View style={styles.headerButtonRow}>
            <TouchableOpacity
              style={styles.reportsBtn}
              onPress={() => navigation?.navigate('Reports')}
            >
              <Text style={styles.reportsBtnText}>{reportsCopy.dashboardLink}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmTopBtn}
              onPress={() => confirmBalance()}
            >
              <Text style={styles.confirmTopBtnText}>CONFIRM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => navigation?.navigate('TransactionSearch')}
            >
              <Text style={styles.searchBtnText}>{searchCopy.searchIcon}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerMetaRow}>
          <Text style={styles.headerMetaLabel}>{lastLoggedLabel}</Text>
          <Text style={styles.headerMetaLabel}>Cycle: {cycleLabel}</Text>
        </View>
      </View>

      <TourCueCard
        cueId="dashboard_overview"
        title="Start here. Then touch everything."
        body="Dashboard is your command view: cash-flow forecast, spending wheel, goals, badges, search, reports, and Customize View. It is not judging you. It is arranging the math."
        actionLabel="OPEN REPORTS"
        onAction={() => navigation?.navigate('Reports')}
      />

      {orderedDashboardCards
        .filter((id) => !(dashboardHiddenCards || []).includes(id))
        .map((id) => (
          <React.Fragment key={id}>
            {renderDashboardCard(id)}
          </React.Fragment>
        ))}

      <CardOrderLink onPress={() => setCardOrderVisible(true)} />

      <LogTransactionModal
        visible={quickLogVisible}
        type="expense"
        accountName={defaultLogAccountName}
        profile={defaultLogProfile}
        defaultAccountKey={defaultLogAccountKey}
        accountOptions={dashboardLogAccountOptions}
        onSubmit={handleQuickLogSubmit}
        onClose={() => setQuickLogVisible(false)}
      />
      <CardOrderSheet
        visible={cardOrderVisible}
        title="DASHBOARD CARD ORDER"
        cards={dashboardDisplayCards}
        currentOrder={dashboardCardOrder}
        currentHidden={dashboardHiddenCards}
        onSave={async (order, hidden) => {
          await updateDashboardCardOrder(order);
          await updateDashboardHiddenCards(hidden);
        }}
        onClose={() => setCardOrderVisible(false)}
      />
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
    paddingHorizontal: theme.spacingMD,
  },
  headerBlock: {
    marginBottom: theme.spacingMD,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacingMD,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
    marginTop: 4,
  },
  headerButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
  },
  reportsBtn: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.backgroundCard,
    paddingHorizontal: theme.spacingSM,
  },
  reportsBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  confirmTopBtn: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.accentGlow,
    paddingHorizontal: theme.spacingSM,
  },
  confirmTopBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  searchBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusSM,
    backgroundColor: theme.accentGlow,
  },
  searchBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  screenTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  headerMetaLabel: {
    color: theme.textDim,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
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
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  profileDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    minHeight: 48,
    paddingVertical: theme.spacingSM,
    paddingHorizontal: theme.spacingXS,
    alignItems: 'center',
  },
  badgeCard: {
    backgroundColor: '#010205',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    marginBottom: theme.spacingXS,
  },
  achievementLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.borderColor,
  },
  achievementTitle: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  achievementCount: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    textAlign: 'center',
    marginBottom: theme.spacingXS,
  },
  achievementBoard: {
    alignItems: 'center',
    paddingTop: theme.spacingXS,
    paddingBottom: theme.spacingSM,
  },
  achievementRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacingXS,
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacingSM,
  },
  badgeTitle: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  badgeSub: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  badgeCount: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  badgeSlots: {
    flexDirection: 'row',
    gap: theme.spacingSM,
  },
  badgeMedalSlots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacingXS,
  },
  badgeMedalCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAction: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginTop: theme.spacingSM,
    textAlign: 'right',
  },
  badgeSlot: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundPanel,
  },
  badgeSlotEarned: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  badgeInitials: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  badgeInitialsEarned: {
    color: theme.accent,
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
