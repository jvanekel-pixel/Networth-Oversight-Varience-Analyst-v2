import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import DonutChart from './charts/DonutChart';
import BarChart from './charts/BarChart';
import {
  buildCategorySlices,
  buildMonthlyCategoryTotals,
  buildTopCategorySeriesForRange,
  getChartReaction,
} from '../utils/chartUtils';
import { getCurrentCycleId, getCycleBounds } from '../utils/forecasting';
import {
  AUTO_ACTIVE_SPENDING_CATEGORIES,
  SPENDING_CATEGORY_SUGGESTIONS,
  dedupeCategoryLabels,
} from '../utils/spendingCategories';

const copy = personality.chartLabels;

function previousCycleBounds(startMs) {
  const start = new Date(startMs);
  const prior = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  return getCycleBounds(`${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, '0')}`);
}

function LegendSwatch({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const PROFILE_TITLES = {
  overall: copy.cycleSpend,
  dashboard: copy.cycleSpend,
  household: 'HOUSEHOLD CYCLE SPEND',
  personal: 'PERSONAL CYCLE SPEND',
  business: 'BUSINESS CYCLE SPEND',
};

function bucketScope(bucket) {
  return bucket?.scope || bucket?.profile || 'all';
}

function bucketMatchesProfile(bucket, profile) {
  const scope = bucketScope(bucket);
  return scope === 'all' || scope === profile;
}

export default function SpendingChartsSection({
  profile = 'overall',
  title = null,
  showTrend = true,
  trendMonths = 6,
}) {
  const transactions = useStore((s) => s.transactions);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const spendingBuckets = useStore((s) => s.spendingBuckets);

  const now = useMemo(() => Date.now(), []);
  const cycleBounds = useMemo(() => getCycleBounds(getCurrentCycleId(now)), [now]);
  const priorBounds = useMemo(() => previousCycleBounds(cycleBounds.startMs), [cycleBounds.startMs]);
  const categoryOrder = useMemo(() => dedupeCategoryLabels([
    ...AUTO_ACTIVE_SPENDING_CATEGORIES,
    ...(spendingBuckets || [])
      .filter(bucket => bucket?.isActive !== false)
      .filter(bucket => profile === 'overall' || profile === 'dashboard' || bucketMatchesProfile(bucket, profile))
      .map(bucket => bucket.name || bucket.label),
    ...SPENDING_CATEGORY_SUGGESTIONS,
  ]), [spendingBuckets, profile]);

  const slices = useMemo(
    () => buildCategorySlices(
      transactions,
      new Date(cycleBounds.startMs),
      new Date(cycleBounds.endMs),
      theme,
      { profile, accountRegistry, categoryOrder },
    ),
    [transactions, cycleBounds.startMs, cycleBounds.endMs, profile, accountRegistry, categoryOrder],
  );
  const priorMonthSlices = useMemo(
    () => buildCategorySlices(
      transactions,
      new Date(priorBounds.startMs),
      new Date(priorBounds.endMs),
      theme,
      { profile, accountRegistry, categoryOrder },
    ),
    [transactions, priorBounds.startMs, priorBounds.endMs, profile, accountRegistry, categoryOrder],
  );
  const novaComment = useMemo(
    () => getChartReaction(slices, priorMonthSlices, personality),
    [slices, priorMonthSlices],
  );
  const trendSeries = useMemo(
    () => (showTrend ? buildTopCategorySeriesForRange(
      transactions,
      now,
      accountRegistry,
      profile,
      theme,
      { categoryOrder, monthCount: trendMonths, limit: 6 },
    ) : []),
    [showTrend, transactions, now, accountRegistry, profile, categoryOrder, trendMonths],
  );
  const months = useMemo(
    () => (showTrend ? buildMonthlyCategoryTotals(
      transactions,
      now,
      accountRegistry,
      profile,
      trendSeries.map(item => item.key),
      { monthCount: trendMonths },
    ) : []),
    [showTrend, transactions, accountRegistry, now, profile, trendSeries, trendMonths],
  );
  const trendTitle = trendMonths >= 12 ? '12-MONTH TREND' : copy.sixMonthTrend;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>{title || PROFILE_TITLES[profile] || copy.cycleSpend}</Text>
      <DonutChart slices={slices} novaComment={novaComment} />

      {showTrend && (
        <>
          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>{trendTitle}</Text>
          <BarChart months={months} series={trendSeries} height={trendMonths >= 12 ? 150 : 120} />
          {trendSeries.length > 0 && (
            <View style={styles.zoneLegend}>
              {trendSeries.map(item => (
                <LegendSwatch key={item.key} color={item.color} label={item.label} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundCard,
    borderColor: theme.borderColorDim,
    borderWidth: 1,
    borderRadius: theme.borderRadiusMD,
    marginBottom: theme.spacingMD,
    padding: theme.spacingMD,
  },
  sectionHeader: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: theme.spacingMD,
  },
  divider: {
    height: 1,
    backgroundColor: theme.borderColorDim,
    marginVertical: theme.spacingLG,
  },
  zoneLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacingMD,
    marginTop: theme.spacingMD,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingXS,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: theme.borderRadiusSM,
  },
  legendText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
  },
});
