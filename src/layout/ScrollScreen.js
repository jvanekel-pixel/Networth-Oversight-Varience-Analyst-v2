import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import { screenContentStyle, useResponsiveLayout } from './responsive';

export default function ScrollScreen({
  children,
  contentStyle = null,
  extraBottom = 0,
  keyboardShouldPersistTaps,
  showsVerticalScrollIndicator = false,
}) {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[screenContentStyle(layout, insets, extraBottom), contentStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
});
