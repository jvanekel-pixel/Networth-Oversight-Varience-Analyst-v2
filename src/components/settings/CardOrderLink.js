import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import theme from '../../config/theme.config';

export default function CardOrderLink({ onPress, style }) {
  return (
    <TouchableOpacity style={[styles.cardOrderRow, style]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.labelBlock}>
        <Text style={styles.cardOrderLabel}>Customize View</Text>
        <Text style={styles.cardOrderHint}>Control the whole UI view here.</Text>
      </View>
      <Text style={styles.cardOrderChevron}>{'>'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardOrderRow: {
    backgroundColor: theme.backgroundCard,
    borderWidth: 1,
    borderColor: theme.borderColorDim,
    borderRadius: theme.borderRadiusMD,
    padding: theme.spacingMD,
    marginTop: theme.spacingMD,
    marginBottom: theme.spacingMD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacingMD,
  },
  labelBlock: {
    flex: 1,
  },
  cardOrderLabel: {
    color: theme.accent,
    fontSize: theme.fontSizeSM,
    fontFamily: theme.fontPrimary,
    fontWeight: 'bold',
  },
  cardOrderHint: {
    color: theme.textDim,
    fontSize: theme.fontSizeXS,
    fontFamily: theme.fontPrimary,
    marginTop: 2,
  },
  cardOrderChevron: {
    color: theme.accent,
    fontSize: theme.fontSizeLG,
    fontFamily: theme.fontPrimary,
  },
});
