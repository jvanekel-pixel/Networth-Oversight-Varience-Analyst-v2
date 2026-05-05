import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import { formatCentsShort } from '../utils/currency';
import { useResponsiveLayout } from '../layout/responsive';
import {
  buildCashFlowForecast,
  FORECAST_HORIZON_OPTIONS,
  normalizeForecastHorizon,
} from '../utils/forecasting';

const PROFILE_LABELS = {
  dashboard: 'Dashboard',
  household: 'Household',
  personal: 'Personal',
  business: 'Business',
};

const PROFILE_COLORS = {
  household: theme.zoneHousehold,
  personal: theme.zonePersonal,
  business: theme.zoneBusiness,
};

function pointColor(state, fallback) {
  if (state === 'red') return theme.statusDanger;
  if (state === 'yellow') return theme.statusWarning;
  return fallback;
}

function formatDateLabel(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function HorizonButton({ days, selected, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.horizonButton, selected && styles.horizonButtonActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.horizonText, selected && styles.horizonTextActive]}>{days}D</Text>
    </TouchableOpacity>
  );
}

function ForecastLineChart({ forecast, color }) {
  const [width, setWidth] = useState(0);
  const points = forecast?.points || [];
  const height = 148;
  const padX = 16;
  const top = 18;
  const bottom = 34;
  const plotHeight = height - top - bottom;

  const values = points.map(point => point.balanceCents);
  const floorValue = forecast?.floorCents || 0;
  const rawMin = Math.min(...values, floorValue);
  const rawMax = Math.max(...values, floorValue);
  const rawRange = Math.max(rawMax - rawMin, 1);
  const padY = Math.max(Math.round(rawRange * 0.16), 5000);
  const min = rawMin - padY;
  const max = rawMax + padY;
  const range = Math.max(max - min, 1);

  const xFor = (index) => {
    if (points.length <= 1) return width / 2;
    return padX + (index * (width - padX * 2)) / (points.length - 1);
  };
  const yFor = (value) => top + ((max - value) / range) * plotHeight;
  const linePoints = width > 0
    ? points.map((point, index) => `${xFor(index)},${yFor(point.balanceCents)}`).join(' ')
    : '';
  const floorY = yFor(floorValue);
  const showFloor = width > 0 && floorY >= top && floorY <= top + plotHeight;

  return (
    <View style={styles.chartWrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && points.length > 0 && (
        <Svg width={width} height={height}>
          <Line
            x1={padX}
            y1={top + plotHeight}
            x2={width - padX}
            y2={top + plotHeight}
            stroke={theme.borderColorDim}
            strokeWidth={1}
          />
          {showFloor && (
            <>
              <Line
                x1={padX}
                y1={floorY}
                x2={width - padX}
                y2={floorY}
                stroke={theme.statusWarning}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={padX}
                y={Math.max(10, floorY - 6)}
                fill={theme.statusWarning}
                fontSize={10}
                fontFamily={theme.fontPrimary}
              >
                FLOOR
              </SvgText>
            </>
          )}
          <Polyline
            points={linePoints}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, index) => (
            <Circle
              key={`${point.day}-${point.balanceCents}`}
              cx={xFor(index)}
              cy={yFor(point.balanceCents)}
              r={4}
              fill={pointColor(point.state, color)}
              stroke={theme.backgroundCard}
              strokeWidth={2}
            />
          ))}
        </Svg>
      )}
      <View style={styles.chartLabels}>
        {points.map(point => (
          <View key={point.day} style={styles.chartLabelBlock}>
            <Text style={styles.chartLabel}>{point.label}</Text>
            <Text style={styles.chartDate}>{formatDateLabel(point.dateMs)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Metric({ label, value, tone = null }) {
  const color = tone === 'danger'
    ? theme.statusDanger
    : tone === 'warning'
      ? theme.statusWarning
      : tone === 'positive'
        ? theme.statusPositive
        : tone === 'outflow'
          ? theme.calendarTransactionColor
          : theme.textPrimary;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ForecastProfileBlock({ forecast }) {
  const layout = useResponsiveLayout();
  const color = PROFILE_COLORS[forecast.profile] || theme.accent;
  const deltaSign = forecast.deltaCents > 0 ? '+' : '';
  const lowTone = forecast.minBalanceCents < 0
    ? 'danger'
    : forecast.state === 'yellow'
      ? 'warning'
      : null;
  const deltaTone = forecast.deltaCents > 0
    ? 'positive'
    : forecast.deltaCents < 0 && forecast.state === 'red'
      ? 'danger'
      : forecast.deltaCents < 0
        ? 'outflow'
        : null;
  const statusText = forecast.accountCount === 0
    ? `No active ${PROFILE_LABELS[forecast.profile]?.toLowerCase() || 'profile'} accounts.`
    : forecast.state === 'red'
      ? `Cash dips below zero around ${forecast.minDay}D. Ends at ${formatCentsShort(forecast.endingBalanceCents)}.`
      : forecast.state === 'yellow'
        ? `Touches floor around ${forecast.minDay}D. Ends at ${formatCentsShort(forecast.endingBalanceCents)}.`
        : `Ends at ${formatCentsShort(forecast.endingBalanceCents)}; low point ${formatCentsShort(forecast.minBalanceCents)} around ${forecast.minDay}D.`;

  return (
    <View style={styles.profileBlock}>
      <View style={styles.profileHeader}>
        <View style={styles.profileTitleRow}>
          <View style={[styles.profileDot, { backgroundColor: color }]} />
          <Text style={styles.profileTitle}>{(PROFILE_LABELS[forecast.profile] || forecast.profile).toUpperCase()}</Text>
        </View>
        <Text style={[styles.profileState, { color: pointColor(forecast.state, color) }]}>{forecast.state.toUpperCase()}</Text>
      </View>

      {forecast.accountCount > 0 ? (
        <>
          <ForecastLineChart forecast={forecast} color={color} />
          <View style={[styles.metricRow, (layout.isNarrow || layout.isLargeText) && styles.metricRowWrap]}>
            <Metric label="START" value={formatCentsShort(forecast.startingBalanceCents)} />
            <Metric label={`NET ${forecast.horizonDays}D`} value={`${deltaSign}${formatCentsShort(forecast.deltaCents)}`} tone={deltaTone} />
            <Metric label="LOW" value={formatCentsShort(forecast.minBalanceCents)} tone={lowTone} />
          </View>
        </>
      ) : (
        <Text style={styles.emptyText}>No active accounts configured for this profile.</Text>
      )}

      <Text style={styles.statusText}>{statusText}</Text>
    </View>
  );
}

export default function CashFlowForecastCard({ profile = 'personal', title = null }) {
  const layout = useResponsiveLayout();
  const accounts = useStore((s) => s.accounts || {});
  const accountFloors = useStore((s) => s.config?.accountFloors || s.accountFloors || {});
  const accountRegistry = useStore((s) => s.accountRegistry || []);
  const householdBills = useStore((s) => s.householdBills || []);
  const personalBills = useStore((s) => s.personalBills || []);
  const incomeEvents = useStore((s) => s.incomeEvents || {});
  const groceryBudget = useStore((s) => s.groceryBudget || null);
  const personalGroceryBudget = useStore((s) => s.personalGroceryBudget || null);
  const includeGroceryReserve = useStore((s) => s.groceryReserveOn !== false);
  const novaConfig = useStore((s) => s.novaConfig || {});
  const updateNovaConfig = useStore((s) => s.updateNovaConfig);
  const recomputeVariance = useStore((s) => s.recomputeVariance);

  const horizon = normalizeForecastHorizon(novaConfig.cashFlowForecastHorizonDays, 30);
  const userMode = novaConfig.userMode;
  const bills = useMemo(() => [...householdBills, ...personalBills], [householdBills, personalBills]);
  const profiles = useMemo(() => {
    if (profile !== 'dashboard') return [profile];
    const hasHouseholdAccount = (accountRegistry || []).some(account => account.isActive !== false && account.role === 'household');
    const hasPersonalAccount = (accountRegistry || []).some(account => account.isActive !== false && account.role === 'personal');
    const list = [];
    if (userMode === 'partnered' || hasHouseholdAccount) list.push('household');
    if (hasPersonalAccount || list.length === 0) list.push('personal');
    return list;
  }, [profile, accountRegistry, userMode]);
  const now = useMemo(() => Date.now(), [
    accounts,
    accountFloors,
    bills,
    incomeEvents,
    groceryBudget,
    personalGroceryBudget,
    horizon,
  ]);

  const forecasts = useMemo(() => profiles.map(scope => buildCashFlowForecast({
    profile: scope,
    accounts,
    accountFloors,
    bills,
    incomeEvents,
    recurringTransactions: [],
    groceryBudget: scope === 'personal' ? personalGroceryBudget : groceryBudget,
    accountRegistry,
    userMode,
    novaConfig,
    daysAhead: horizon,
    now,
    includeGroceryReserve,
  })), [
    profiles,
    accounts,
    accountFloors,
    bills,
    incomeEvents,
    groceryBudget,
    personalGroceryBudget,
    accountRegistry,
    userMode,
    novaConfig,
    horizon,
    now,
    includeGroceryReserve,
  ]);

  const handleHorizonPress = async (days) => {
    if (days === horizon) return;
    await updateNovaConfig({ cashFlowForecastHorizonDays: days });
    recomputeVariance();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, layout.isNarrow && styles.headerRowStack]}>
        <View style={styles.titleBlock}>
          <Text style={styles.sectionHeader}>{title || 'CASH-FLOW FORECAST'}</Text>
          <Text style={styles.subtitle}>30 / 60 / 90 day projection</Text>
        </View>
        <View style={styles.horizonGroup}>
          {FORECAST_HORIZON_OPTIONS.map(days => (
            <HorizonButton
              key={days}
              days={days}
              selected={days === horizon}
              onPress={() => handleHorizonPress(days)}
            />
          ))}
        </View>
      </View>

      {forecasts.map(forecast => (
        <ForecastProfileBlock key={forecast.profile} forecast={forecast} />
      ))}
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
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  headerRowStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: 3,
  },
  horizonGroup: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    overflow: 'hidden',
  },
  horizonButton: {
    minWidth: 42,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacingSM,
    backgroundColor: theme.backgroundPanel,
  },
  horizonButtonActive: {
    backgroundColor: theme.accentGlow,
  },
  horizonText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
  horizonTextActive: {
    color: theme.accent,
  },
  profileBlock: {
    borderTopWidth: 1,
    borderTopColor: theme.borderColorDim,
    paddingTop: theme.spacingMD,
    marginTop: theme.spacingSM,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacingSM,
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    minWidth: 0,
  },
  profileDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
  },
  profileTitle: {
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontWeight: '700',
  },
  profileState: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
  chartWrap: {
    marginTop: theme.spacingSM,
    minHeight: 178,
  },
  chartLabels: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabelBlock: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  chartLabel: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
  chartDate: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: 9,
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacingSM,
    marginTop: theme.spacingSM,
  },
  metricRowWrap: {
    flexDirection: 'column',
  },
  metric: {
    flex: 1,
    minHeight: 62,
    minWidth: 0,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusSM,
    paddingVertical: theme.spacingSM,
    paddingHorizontal: theme.spacingSM,
  },
  metricLabel: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
  metricValue: {
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeMD,
    fontWeight: '700',
    marginTop: 2,
  },
  statusText: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    marginTop: theme.spacingSM,
  },
  emptyText: {
    color: theme.textDim,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: theme.spacingMD,
  },
});
