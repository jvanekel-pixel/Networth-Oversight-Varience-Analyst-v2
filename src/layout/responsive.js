import { PixelRatio, useWindowDimensions } from 'react-native';
import theme from '../config/theme.config';

export const WIDTH_CLASS = {
  NARROW: 'narrow',
  COMPACT: 'compact',
  MEDIUM: 'medium',
  EXPANDED: 'expanded',
};

export const WIDTH_BREAKPOINTS = {
  narrow: 360,
  compact: 600,
  medium: 840,
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getWidthClass(width) {
  if (width < WIDTH_BREAKPOINTS.narrow) return WIDTH_CLASS.NARROW;
  if (width < WIDTH_BREAKPOINTS.compact) return WIDTH_CLASS.COMPACT;
  if (width < WIDTH_BREAKPOINTS.medium) return WIDTH_CLASS.MEDIUM;
  return WIDTH_CLASS.EXPANDED;
}

export function getResponsiveTokens(width, height, fontScale = 1) {
  const widthClass = getWidthClass(width);
  const isNarrow = widthClass === WIDTH_CLASS.NARROW;
  const isCompact = widthClass === WIDTH_CLASS.NARROW || widthClass === WIDTH_CLASS.COMPACT;
  const isMedium = widthClass === WIDTH_CLASS.MEDIUM;
  const isExpanded = widthClass === WIDTH_CLASS.EXPANDED;
  const contentPadding = isNarrow ? theme.spacingSM : isCompact ? theme.spacingMD : theme.spacingLG;
  const contentMaxWidth = isExpanded ? 760 : isMedium ? 680 : 520;
  const contentWidth = Math.max(0, Math.min(width - contentPadding * 2, contentMaxWidth - contentPadding * 2));
  const density = PixelRatio.get();

  return {
    width,
    height,
    density,
    fontScale,
    widthClass,
    isNarrow,
    isCompact,
    isMedium,
    isExpanded,
    isLargeText: fontScale >= 1.2,
    isTall: height / Math.max(width, 1) >= 2,
    contentPadding,
    contentWidth,
    contentMaxWidth,
    cardGap: isNarrow ? theme.spacingSM : theme.spacingMD,
    minTouchTarget: 48,
  };
}

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  return getResponsiveTokens(width, height, fontScale);
}

export function screenContentStyle(layout, insets, extraBottom = 0) {
  return {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingTop: theme.spacingMD,
    paddingHorizontal: layout.contentPadding,
    paddingBottom: theme.spacingXXL + Math.max(insets?.bottom || 0, theme.spacingMD) + extraBottom,
  };
}

export function calendarGridMetrics(layout) {
  const maxGridWidth = layout.isExpanded ? 560 : layout.isMedium ? 504 : 420;
  const gridWidth = Math.floor(Math.min(layout.contentWidth, maxGridWidth));
  const cellSize = Math.floor(gridWidth / 7);
  const cellHeight = clamp(cellSize, 46, layout.isExpanded ? 76 : 64);
  return {
    gridWidth: cellSize * 7,
    cellSize,
    cellHeight,
    cellPadding: layout.isNarrow ? 2 : 3,
  };
}
