import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import CardOrderSheet from '../components/settings/CardOrderSheet';
import CardOrderLink from '../components/settings/CardOrderLink';
import SpendingChartsSection from '../components/SpendingChartsSection';
import SpendingCategoryManagerCard from '../components/SpendingCategoryManagerCard';
import ReceiptAttachmentsCard from '../components/ReceiptAttachmentsCard';
import SavingsGoalsCard from '../components/SavingsGoalsCard';
import TourCueCard from '../components/TourCueCard';
import { SAVINGS_GOALS_CARD_ID, savingsGoalsForScope } from '../utils/savingsGoals';

const searchCopy = personality.transactionSearch;

export default function BusinessScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [cardOrderVisible, setCardOrderVisible] = useState(false);
  const businessVariance = useStore((s) => s.varianceCache.business);
  const businesses = useStore((s) => s.businesses);
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const novaConfig = useStore((s) => s.novaConfig);
  const businessCardOrder = useStore((s) => s.businessCardOrder);
  const businessHiddenCards = useStore((s) => s.businessHiddenCards);
  const updateBusinessCardOrder = useStore((s) => s.updateBusinessCardOrder);
  const updateBusinessHiddenCards = useStore((s) => s.updateBusinessHiddenCards);
  const activeBusinesses = (businesses || []).filter(b => b.isActive !== false);
  const businessAccountKeys = (accountRegistry || [])
    .filter(account => account.isActive !== false && account.role === 'business')
    .map(account => account.legacyKey || account.id)
    .filter(Boolean);
  const bv = businessVariance || { balance: 0, variance: 0, state: 'neutral', annotation: '--' };
  const borderColor = bv.state === 'green' ? theme.statusPositive : bv.state === 'yellow' ? theme.statusWarning : bv.state === 'red' ? theme.statusDanger : theme.borderColorDim;
  const bgColor = bv.state === 'green' ? theme.statusPositiveBg : bv.state === 'yellow' ? theme.statusWarningBg : bv.state === 'red' ? theme.statusDangerBg : theme.backgroundCard;
  const varSign = bv.variance > 0 ? '+' : '';
  const varColor = bv.variance > 0 ? theme.statusPositive : bv.variance < 0 ? theme.statusDanger : theme.textSecondary;
  const businessAnnotation = /^[\x20-\x7E]+$/.test(String(bv.annotation || '')) ? bv.annotation : '--';
  const accountLabelByKey = new Map((accountRegistry || []).flatMap(account => {
    const key = account.legacyKey || account.id;
    return key ? [[key, account.name || account.id], [account.id, account.name || account.id]] : [];
  }));
  const businessReceiptTransactions = (transactions || []).filter(tx => {
    if (!tx || tx.deleted) return false;
    const sourceType = String(tx.sourceType || '');
    if (tx.source === 'business' || sourceType.startsWith('business_') || tx.businessId) return true;
    return tx.accountKey && businessAccountKeys.includes(tx.accountKey);
  });
  const businessSavingsGoals = savingsGoalsForScope(novaConfig?.savingsGoals, 'business');
  const businessOverviewCardIds = [
    'variance',
    'spending_chart',
    'spending_categories',
    SAVINGS_GOALS_CARD_ID,
    'receipt_attachments',
  ];
  const businessDisplayCards = [
    { id: 'variance', label: 'Variance Summary' },
    { id: 'spending_chart', label: 'Spending Chart' },
    { id: 'spending_categories', label: 'Spending Categories' },
    { id: SAVINGS_GOALS_CARD_ID, label: 'Savings Goals' },
    { id: 'receipt_attachments', label: 'Receipt Photos' },
  ];
  const orderedOverviewCards = [
    ...(businessCardOrder || []).filter((id) => businessOverviewCardIds.includes(id)),
    ...businessOverviewCardIds.filter((id) => !(businessCardOrder || []).includes(id)),
  ].filter((id) => !(businessHiddenCards || []).includes(id));
  const renderBusinessOverviewCard = (id) => {
    if (id === 'variance') {
      return (
        <View style={[styles.varianceCard, { borderColor, backgroundColor: bgColor }]}>
          <Text style={styles.varianceLabel}>BUSINESS VARIANCE</Text>
          <Text style={styles.varianceBalance}>{formatCentsShort(bv.balance)}</Text>
          <Text style={[styles.varianceAmt, { color: varColor }]}>{varSign}{formatCentsShort(bv.variance)}</Text>
          <Text style={styles.varianceAnnotation}>{businessAnnotation}</Text>
        </View>
      );
    }
    if (id === 'spending_chart') return <SpendingChartsSection profile="business" />;
    if (id === 'spending_categories') return <SpendingCategoryManagerCard profile="business" />;
    if (id === SAVINGS_GOALS_CARD_ID) {
      return (
        <SavingsGoalsCard
          goals={businessSavingsGoals}
          accounts={accounts}
          accountRegistry={accountRegistry}
          scope="business"
          title="SAVINGS GOALS"
        />
      );
    }
    if (id === 'receipt_attachments') {
      return (
        <ReceiptAttachmentsCard
          title="BUSINESS RECEIPTS"
          transactions={businessReceiptTransactions}
          getAccountLabel={(tx) => accountLabelByKey.get(tx.accountKey) || tx.accountKey}
        />
      );
    }
    return null;
  };
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >
      <View style={styles.headerStrip}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{theme.tabBusiness}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => navigation.navigate('TransactionSearch', { initialFilters: { accountKeys: businessAccountKeys, sources: ['business'], matchScope: 'any' } })}
            >
              <Text style={styles.searchBtnText}>{searchCopy.searchIcon}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => navigation.navigate('Calendar', { mode: 'business' })}
            >
              <Text style={styles.calendarBtnText}>VIEW CALENDAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TourCueCard
        cueId="business_tools"
        title="Business mode: productive. Suspiciously productive."
        body="Each business gets its own workspace for income, expenses, mileage, receipts, savings goals, spending categories, and tax-ready exports. You brought extra math. Bold."
        actionLabel="VIEW CALENDAR"
        onAction={() => navigation.navigate('Calendar', { mode: 'business' })}
      />

      {activeBusinesses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No businesses configured.</Text>
        </View>
      ) : (
        activeBusinesses.map((biz) => (
          <TouchableOpacity
            key={biz.id}
            style={styles.businessButton}
            onPress={() => navigation.navigate('BusinessDetail', { businessId: biz.id })}
            activeOpacity={0.85}
          >
            <Text style={styles.businessName}>{(biz.name || 'Business').toUpperCase()}</Text>
            <Text style={styles.businessSubtext}>OPEN BUSINESS DASHBOARD</Text>
          </TouchableOpacity>
        ))
      )}

      {orderedOverviewCards.map((id) => (
        <React.Fragment key={id}>
          {renderBusinessOverviewCard(id)}
        </React.Fragment>
      ))}

      <CardOrderLink onPress={() => setCardOrderVisible(true)} />

      <CardOrderSheet
        visible={cardOrderVisible}
        title="BUSINESS CARD ORDER"
        cards={businessDisplayCards}
        currentOrder={businessCardOrder}
        currentHidden={businessHiddenCards}
        onSave={async (order, hidden) => {
          await updateBusinessCardOrder(order);
          await updateBusinessHiddenCards(hidden);
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
  headerStrip: {
    marginBottom: theme.spacingMD,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
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
  calendarBtn: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    paddingHorizontal: theme.spacingSM,
    backgroundColor: theme.backgroundCard,
  },
  calendarBtnText: {
    color: theme.accent,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  varianceCard: {
    padding: theme.spacingLG,
    borderRadius: theme.radiusLG,
    borderWidth: 2,
    marginBottom: theme.spacingMD,
  },
  varianceLabel: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    marginBottom: theme.spacingXS,
  },
  varianceBalance: {
    color: theme.textPrimary,
    fontSize: theme.fontSizeXXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  varianceAmt: {
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
    marginBottom: 2,
  },
  varianceAnnotation: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
  businessButton: {
    borderWidth: 2,
    borderColor: theme.accent,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    paddingVertical: theme.spacingLG,
    paddingHorizontal: theme.spacingMD,
    marginBottom: theme.spacingMD,
    alignItems: 'center',
  },
  businessName: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  businessSubtext: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: theme.spacingXS,
    letterSpacing: 1,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    backgroundColor: theme.backgroundCard,
    padding: theme.spacingLG,
    marginBottom: theme.spacingMD,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
  },
});
