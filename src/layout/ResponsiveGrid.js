import React from 'react';
import { View } from 'react-native';
import theme from '../config/theme.config';
import { useResponsiveLayout } from './responsive';

export default function ResponsiveGrid({
  children,
  minColumnWidth = 220,
  maxColumns = 2,
  gap = theme.spacingMD,
  style = null,
  itemStyle = null,
}) {
  const layout = useResponsiveLayout();
  const available = layout.contentWidth;
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((available + gap) / (minColumnWidth + gap))));
  const basis = columns === 1 ? '100%' : `${100 / columns}%`;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2, marginBottom: theme.spacingMD }, style]}>
      {React.Children.map(children, child => {
        if (!child) return null;
        return (
          <View style={[{ width: basis, paddingHorizontal: gap / 2, marginBottom: gap }, itemStyle]}>
            {child}
          </View>
        );
      })}
    </View>
  );
}
