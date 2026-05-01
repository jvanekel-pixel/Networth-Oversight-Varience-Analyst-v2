import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../config/theme.config';

export default function BusinessSelectorScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>BUSINESS</Text>
      <Text style={styles.subtitle}>Select a zone</Text>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Massage')}>
        <Text style={styles.cardLabel}>MASSAGE</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Cleaning')}>
        <Text style={styles.cardLabel}>CLEANING LLC</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingBottom: 32,
  },
  title: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
    marginTop: 24,
    marginHorizontal: 16,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: theme.fontSizeMD,
    fontFamily: theme.fontPrimary,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.accent,
    backgroundColor: theme.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    color: theme.accent,
    fontSize: theme.fontSizeXL,
    fontFamily: theme.fontPrimary,
  },
});
