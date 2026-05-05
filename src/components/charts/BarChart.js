import React from 'react';
import { Dimensions, View, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import theme from '../../config/theme.config';

const BAR_ZONES = [
  { key: 'household', color: theme.zoneHousehold },
  { key: 'personal', color: theme.zonePersonal },
  { key: 'business', color: theme.zoneBusiness },
];

export default function BarChart({ months = [], height = 120, series }) {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const activeSeries = Array.isArray(series) ? series : BAR_ZONES;
  const fallbackWidth = Math.max(240, Dimensions.get('window').width - (theme.spacingMD * 4));
  const width = Math.max(240, containerWidth || fallbackWidth);
  const labelHeight = 22;
  const chartHeight = height - labelHeight;
  const maxValue = Math.max(
    1,
    ...months.flatMap(month => activeSeries.map(item => month[item.key] || 0)),
  );
  const groupWidth = width / Math.max(months.length, 1);
  const seriesCount = Math.max(activeSeries.length, 1);
  const barGap = activeSeries.length > 4 ? 2 : 3;
  const availableBarWidth = Math.max(4, groupWidth * 0.76);
  const barWidth = Math.max(
    2,
    Math.min(12, (availableBarWidth - (Math.max(activeSeries.length - 1, 0) * barGap)) / seriesCount),
  );
  const groupBarWidth = (activeSeries.length * barWidth) + (Math.max(activeSeries.length - 1, 0) * barGap);
  const baseline = chartHeight;
  const currentIndex = months.length - 1;
  const handleLayout = React.useCallback((event) => {
    const nextWidth = Math.floor(event?.nativeEvent?.layout?.width || 0);
    if (nextWidth > 0 && Math.abs(nextWidth - containerWidth) > 1) {
      setContainerWidth(nextWidth);
    }
  }, [containerWidth]);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Svg width={width} height={height}>
        {months.map((month, monthIndex) => {
          const groupX = (monthIndex * groupWidth) + ((groupWidth - groupBarWidth) / 2);
          const isCurrent = monthIndex === currentIndex;
          return (
            <React.Fragment key={`${month.month}-${monthIndex}`}>
              {activeSeries.map((item, itemIndex) => {
                const value = month[item.key] || 0;
                const barHeight = value > 0 ? Math.max(2, (value / maxValue) * (chartHeight - theme.spacingSM)) : 0;
                const x = groupX + (itemIndex * (barWidth + barGap));
                const y = baseline - barHeight;
                return (
                  <Rect
                    key={item.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={theme.borderRadiusSM}
                    fill={item.color}
                    opacity={isCurrent ? 1 : 0.55}
                  />
                );
              })}
              <SvgText
                x={(monthIndex * groupWidth) + (groupWidth / 2)}
                y={height - 5}
                fill={isCurrent ? theme.textPrimary : theme.textSecondary}
                fontSize={theme.fontSizeXS}
                fontFamily={theme.fontPrimary}
                textAnchor="middle"
              >
                {month.month}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
});
