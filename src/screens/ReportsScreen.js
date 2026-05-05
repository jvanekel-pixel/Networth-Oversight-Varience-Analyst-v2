import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import personality from '../config/personality.config';
import SpendingChartsSection from '../components/SpendingChartsSection';
import SpendingTrendsReport from '../components/SpendingTrendsReport';
import ExportPanel from '../components/ExportPanel';
import useStore from '../store/useStore';
import ScrollScreen from '../layout/ScrollScreen';

const copy = personality.reports;

export default function ReportsScreen({ navigation }) {
  const rotateFlavorTextForEvent = useStore((s) => s.rotateFlavorTextForEvent);

  useEffect(() => {
    rotateFlavorTextForEvent?.('report_opened');
  }, [rotateFlavorTextForEvent]);

  return (
    <ScrollScreen contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>{copy.title}</Text>
          <Text style={styles.screenSubtitle}>{copy.subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backBtnText}>{copy.back}</Text>
        </TouchableOpacity>
      </View>

      <SpendingChartsSection showTrend={false} />
      <SpendingTrendsReport />

      <ExportPanel />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacingMD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacingMD,
    marginBottom: theme.spacingMD,
  },
  screenTitle: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXL,
    fontWeight: '700',
  },
  screenSubtitle: {
    color: theme.textSecondary,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeSM,
    marginTop: theme.spacingXS,
  },
  backBtn: {
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadiusSM,
    borderWidth: 1,
    backgroundColor: theme.accentGlow,
    paddingHorizontal: theme.spacingMD,
    paddingVertical: theme.spacingSM,
  },
  backBtnText: {
    color: theme.accent,
    fontFamily: theme.fontPrimary,
    fontSize: theme.fontSizeXS,
    fontWeight: '700',
  },
});
