import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import useStore from '../store/useStore';
import BarChart from './charts/BarChart';
import {
  buildMonthlyCategoryTotals,
  buildTopCategorySeriesForRange,
  buildYearOverYearCategoryTotals,
} from '../utils/chartUtils';
import { formatCentsShort } from '../utils/currency';
import {
  AUTO_ACTIVE_SPENDING_CATEGORIES,
  SPENDING_CATEGORY_SUGGESTIONS,
  dedupeCategoryLabels,
} from '../utils/spendingCategories';

const PERIODS = [
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
];

function bucketScope(bucket) {
  return bucket?.scope || bucket?.profile || 'all';
}

function bucketMatchesProfile(bucket, profile) {
  const scope = bucketScope(bucket);
  return scope === 'all' || scope === profile;
}

function deltaLabel(row) {
  if (row.deltaPct == null) return row.currentCents > 0 ? 'NEW' : '0%';
  const rounded = Math.round(row.deltaPct);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function deltaColor(row) {
  if (row.deltaCents > 0) return theme.statusDanger;
  if (row.deltaCents < 0) return theme.statusPositive;
  return theme.textSecondary;
}

function TrendLegend({ series }) {
  if (!series.length) return null;
  return (
    <View style={styles.legend}>
      {series.map(item => (
        <View key={item.key} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function YearOverYearRow({ row }) {
  const max = Math.max(1, row.currentCents, row.previousCents);
  const currentPct = row.currentCents > 0 ? Math.max(2, Math.round((row.currentCents / max) * 100)) : 0;
  const previousPct = row.previousCents > 0 ? Math.max(2, Math.round((row.previousCents / max) * 100)) : 0;

  return (
    <View style={styles.yoyRow}>
      <View style={styles.yoyTopRow}>
        <Text style={styles.categoryText} numberOfLines={1}>{row.category}</Text>
        <Text style={[styles.deltaText, { color: deltaColor(row) }]}>{deltaLabel(row)}</Text>
      </View>

      <View style={styles.barLine}>
        <Text style={styles.barLabel}>LAST 12M</Text>
        <View style={styles.barTrack}>
          <View style={[styles.currentFill, { width: `${currentPct}%`, backgroundColor: row.color }]} />
        </View>
        <Text style={styles.amountText}>{formatCentsShort(row.currentCents)}</Text>
      </View>

      <View style={styles.barLine}>
        <Text style={styles.barLabel}>PRIOR</Text>
        <View style={styles.barTrack}>
          <View style={[styles.previousFill, { width: `${previousPct}%` }]} />
        </View>
        <Text style={styles.amountText}>{formatCentsShort(row.previousCents)}</Text>
      </View>
    </View>
  );
}

export default function SpendingTrendsReport({ profile = 'overall' }) {
  const [period, setPeriod] = useState(12);
  const transactions = useStore((s) => s.transactions);
  const accountRegistry = useStore((s) => s.accountRegistry);
  const spendingBuckets = useStore((s) => s.spendingBuckets);
  const now = useMemo(() => Date.now(), []);

  const categoryOrder = useMemo(() => dedupeCategoryLabels([
    ...AUTO_ACTIVE_SPENDING_CATEGORIES,
    ...(spendingBuckets || [])
      .filter(bucket => bucket?.isActive !== false)
      .filter(bucket => profile === 'overall' || profile === 'dashboard' || bucketMatchesProfile(bucket, profile))
      .map(bucket => bucket.name || bucket.label),
    ...SPENDING_CATEGORY_SUGGESTIONS,
  ]), [spendingBuckets, profile]);

  const trendSeries = useMemo(
    () => buildTopCategorySeriesForRange(
      transactions,
      now,
      accountRegistry,
      profile,
      theme,
      { categoryOrder, monthCount: period, limit: period >= 12 ? 5 : 6 },
    ),
    [transactions, now, accountRegistry, profile, categoryOrder, period],
  );

  const months = useMemo(
    () => buildMonthlyCategoryTotals(
      transactions,
      now,
      accountRegistry,
      profile,
      trendSeries.map(item => item.key),
      { monthCount: period },
    ),
    [transactions, now, accountRegistry, profile, trendSeries, period],
  );

  const yoyRows = useMemo(
    () => buildYearOverYearCategoryTotals(
      transactions,
      now,
      accountRegistry,
      profile,
      theme,
      { categoryOrder, monthCount: 12, limit: 6 },
    ),
    [transactions, now, accountRegistry, profile, categoryOrder],
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.sectionHeader}>SPENDING TRENDS</Text>
          <Text style={styles.subHeader}>TOP CATEGORIES BY MONTH</Text>
        </View>
        <View style={styles.segment}>
          {PERIODS.map(option => {
            const active = option.value === period;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setPeriod(option.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <BarChart months={months} series={trendSeries} height={period >= 12 ? 164 : 132} />
      <TrendLegend series={trendSeries} />

      <View style={styles.divider} />

      <View style={styles.yoyHeaderRow}>
        <Text style={styles.sectionHeader}>YEAR OVER YEAR</Text>
        <Text style={styles.subHeader}>LAST 12M VS PRIOR 12M</Text>
      </View>

      {yoyRows.length > 0 ? (
        yoyRows.map(row => <YearOverYearRow key={row.key} row={row} />)
      ) : (
        <Text style={styles.emptyText}>{personality.chartLabels.noSpend}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  headerCopy: {
    flex: 1,
    minWidth: 170,
  },
  sectionHeader: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subHeader: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
    marginTop: theme.spacingXS,
  },
  segment: {
    flexDirection: 'row',
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 52,
    paddingHorizontal: theme.spacingSM,
  },
  segmentBtnActive: {
    backgroundColor: theme.accentGlow,
  },
  segmentText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: theme.accent,
  },
  legend: {
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
  divider: {
    height: 1,
    backgroundColor: theme.borderColorDim,
    marginVertical: theme.spacingLG,
  },
  yoyHeaderRow: {
    marginBottom: theme.spacingSM,
  },
  yoyRow: {
    borderTopColor: theme.borderColorDim,
    borderTopWidth: 1,
    gap: theme.spacingSM,
    paddingTop: theme.spacingMD,
    marginTop: theme.spacingMD,
  },
  yoyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
  },
  categoryText: {
    color: theme.textPrimary,
    flex: 1,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
  },
  deltaText: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
  },
  barLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacingSM,
    minHeight: 18,
  },
  barLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
    width: 58,
  },
  barTrack: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadiusSM,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  currentFill: {
    borderRadius: theme.borderRadiusSM,
    height: '100%',
  },
  previousFill: {
    backgroundColor: theme.textDim,
    borderRadius: theme.borderRadiusSM,
    height: '100%',
  },
  amountText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
    textAlign: 'right',
    width: 64,
  },
  emptyText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: theme.spacingMD,
  },
});
