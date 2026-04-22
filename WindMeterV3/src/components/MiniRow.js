import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';

export default function MiniRow({ cells }) {
  return (
    <View style={s.row}>
      {cells.map((cell, i) => (
        <View key={i} style={[s.cell, i < cells.length - 1 && s.cellBorder]}>
          <Text style={s.label}>{cell.label}</Text>
          <View style={s.valRow}>
            <Text style={[s.value, NUM_SHADOW]}>{cell.value}</Text>
            {cell.unit != null && <Text style={s.unit}>{cell.unit}</Text>}
          </View>
          {cell.sub != null && <Text style={s.sub}>{cell.sub}</Text>}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: C.cardAlt,
  },
  cell: {
    flex: 1,
    padding: 10,
    paddingVertical: 12,
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: C.sep,
  },
  label: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textDim,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  valRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontFamily: FONTS.bcBlack,
    fontSize: 34,
    color: C.text,
    includeFontPadding: false,
  },
  unit: {
    fontFamily: FONTS.bcBold,
    fontSize: 13,
    color: C.cyan,
    marginBottom: 4,
    marginLeft: 2,
  },
  sub: {
    fontFamily: FONTS.bcMed,
    fontSize: 10,
    color: C.textSub,
    marginTop: 2,
  },
});
