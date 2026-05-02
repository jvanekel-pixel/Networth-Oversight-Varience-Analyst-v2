import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';

export default function BusinessSelectorScreen({ navigation }) {
  const businesses = useStore((s) => s.businesses);
  const active = (businesses || []).filter((b) => b.isActive !== false);

  function handleSelect(biz) {
    if (biz.id === 'biz_legacy_massage') {
      navigation.navigate('Massage');
    } else if (biz.id === 'biz_legacy_cleaning') {
      navigation.navigate('Cleaning');
    } else {
      navigation.navigate('BusinessDetail', { businessId: biz.id });
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>BUSINESS</Text>
      <Text style={styles.subtitle}>Select a zone</Text>
      {active.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No businesses configured.</Text>
          <Text style={styles.emptySubtext}>Add businesses in Settings → Business Mode.</Text>
        </View>
      )}
      {active.map((biz) => (
        <TouchableOpacity
          key={biz.id}
          style={styles.card}
          onPress={() => handleSelect(biz)}
          activeOpacity={0.8}
        >
          <Text style={styles.cardLabel}>{biz.name.toUpperCase()}</Text>
          <View style={styles.trackBadges}>
            {biz.trackIncome && <Text style={styles.badge}>INCOME</Text>}
            {biz.trackExpenses && <Text style={styles.badge}>EXPENSES</Text>}
            {biz.trackMileage && <Text style={styles.badge}>MILEAGE</Text>}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 32 },
  title: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, marginTop: 24, marginHorizontal: 16 },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, marginHorizontal: 16, marginBottom: 24 },
  emptyState: { margin: 16, padding: 24, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, alignItems: 'center' },
  emptyText: { color: theme.textSecondary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, marginBottom: 8 },
  emptySubtext: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, textAlign: 'center' },
  card: { marginHorizontal: 16, marginVertical: 8, paddingVertical: 32, paddingHorizontal: 20, borderRadius: 12, borderWidth: 2, borderColor: theme.accent, backgroundColor: theme.backgroundCard, alignItems: 'center' },
  cardLabel: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, marginBottom: 12 },
  trackBadges: { flexDirection: 'row', gap: 8 },
  badge: { color: theme.textDim, fontSize: theme.fontSizeXS, fontFamily: theme.fontPrimary, borderWidth: 1, borderColor: theme.borderColor, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
});
