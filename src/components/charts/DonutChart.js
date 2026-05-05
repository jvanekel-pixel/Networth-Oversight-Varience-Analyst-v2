import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import theme from '../../config/theme.config';
import personality from '../../config/personality.config';
import { formatCentsShort } from '../../utils/currency';

const copy = personality.chartLabels;

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function legendRows(slices) {
  if ((slices || []).length <= 7) return slices || [];
  const top = slices.slice(0, 6);
  const remainder = slices.slice(6);
  return [
    ...top,
    {
      category: copy.other,
      categoryCount: remainder.length,
      totalCents: remainder.reduce((sum, slice) => sum + (slice.totalCents || 0), 0),
      color: theme.muted,
    },
  ];
}

export default function DonutChart({ slices = [], size = 180, strokeWidth = 28, novaComment = '' }) {
  const total = slices.reduce((sum, slice) => sum + (slice.totalCents || 0), 0);
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const rows = useMemo(() => legendRows(slices), [slices]);
  let offset = 0;
  const topSlice = slices[0] || null;
  const topCategory = topSlice?.category || copy.noSpend;
  const topPct = topSlice ? percent(topSlice.totalCents, total) : 0;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.borderColorDim}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <G rotation="-90" origin={`${center}, ${center}`}>
          {slices.map((slice) => {
            const arc = total > 0 ? (slice.totalCents / total) * circumference : 0;
            const dashOffset = -offset;
            offset += arc;
            return (
              <Circle
                key={`${slice.category}-${slice.color}`}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc} ${circumference - arc}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })}
        </G>
        <SvgText
          x={center}
          y={center - 5}
          fill={theme.textPrimary}
          fontSize={theme.fontSizeSM}
          fontFamily={theme.fontPrimary}
          fontWeight="700"
          textAnchor="middle"
        >
          {topCategory.slice(0, 14)}
        </SvgText>
        <SvgText
          x={center}
          y={center + 18}
          fill={theme.textPrimary}
          fontSize={theme.fontSizeXL}
          fontFamily={theme.fontPrimary}
          fontWeight="700"
          textAnchor="middle"
        >
          {topPct}%
        </SvgText>
      </Svg>

      <View style={styles.legend}>
        {rows.map((slice) => {
          const pct = percent(slice.totalCents, total);
          const label = slice.categoryCount
            ? `${copy.other} - ${slice.categoryCount} ${copy.categories}`
            : slice.category;
          return (
            <View key={`${slice.category}-${slice.color}`} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: slice.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{label}</Text>
              <Text style={styles.legendPct}>{pct}%</Text>
              <Text style={styles.legendAmount}>{formatCentsShort(slice.totalCents)}</Text>
            </View>
          );
        })}
      </View>

      {!!novaComment && (
        <Text style={styles.novaComment}>{novaComment}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  legend: {
    width: '100%',
    marginTop: theme.spacingMD,
    gap: theme.spacingXS,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacingSM,
    minHeight: 24,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: theme.borderRadiusSM,
  },
  legendLabel: {
    flex: 1,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
  },
  legendPct: {
    width: 38,
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    textAlign: 'right',
  },
  legendAmount: {
    width: 76,
    color: theme.textPrimary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    textAlign: 'right',
  },
  novaComment: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: theme.spacingMD,
    textAlign: 'center',
  },
});
