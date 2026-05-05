import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';
import useStore from '../store/useStore';
import ScrollScreen from '../layout/ScrollScreen';

export default function BusinessSelectorScreen({ navigation }) {
  const businesses = useStore((s) => s.businesses);
  const active = (businesses || []).filter((b) => b.isActive !== false);

  function handleSelect(biz) {
    navigation.navigate('BusinessDetail', { businessId: biz.id });
  }

  return (
    <ScrollScreen contentStyle={styles.content}>
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
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: theme.spacingLG },
  title: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary },
  subtitle: { color: theme.textSecondary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, marginBottom: 24 },
  emptyState: { padding: 24, borderWidth: 1, borderColor: theme.borderColor, borderRadius: theme.borderRadiusMD, alignItems: 'center' },
  emptyText: { color: theme.textSecondary, fontSize: theme.fontSizeMD, fontFamily: theme.fontPrimary, marginBottom: 8 },
  emptySubtext: { color: theme.textDim, fontSize: theme.fontSizeSM, fontFamily: theme.fontPrimary, textAlign: 'center' },
  card: { marginVertical: 8, paddingVertical: 32, paddingHorizontal: 20, borderRadius: 12, borderWidth: 2, borderColor: theme.accent, backgroundColor: theme.backgroundCard, alignItems: 'center' },
  cardLabel: { color: theme.accent, fontSize: theme.fontSizeXL, fontFamily: theme.fontPrimary, textAlign: 'center' },
});
