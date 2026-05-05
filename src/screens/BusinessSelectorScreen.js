import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../config/theme.config';
import useStore from '../store/useStore';

export default function BusinessSelectorScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const businesses = useStore((s) => s.businesses);
  const active = (businesses || []).filter((b) => b.isActive !== false);

  function handleSelect(biz) {
    navigation.navigate('BusinessDetail', { businessId: biz.id });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: theme.spacingXXL + Math.max(insets.bottom, theme.spacingMD) }]}
    >
      <Text style={styles.title}>BUSINESS</Text>
      <Text style={styles.subtitle}>Open a business dashboard</Text>
      {active.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No businesses configured.</Text>
          <Text style={styles.emptySubtext}>Add businesses in Settings - Business Mode.</Text>
        </View>
      )}
      {active.map((biz) => (
        <TouchableOpacity
          key={biz.id}
          style={styles.card}
          onPress={() => handleSelect(biz)}
          activeOpacity={0.8}
        >
          <Text style={styles.cardLabel}>{(biz.name || 'Business').toUpperCase()}</Text>
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
  cardLabel: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, textAlign: 'center' },
});
