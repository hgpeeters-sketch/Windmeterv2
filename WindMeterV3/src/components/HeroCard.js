import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';

export default function HeroCard({ label, value, unit, sub, size = 112, accent = false }) {
  return (
    <View style={s.card}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Text style={[s.value, { fontSize: size }, NUM_SHADOW, accent && { color: C.cyan }]}>
          {value}
        </Text>
        {unit != null && <Text style={s.unit}>{unit}</Text>}
      </View>
      {sub != null && <Text style={s.sub}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    padding: 14,
    paddingBottom: 16,
  },
  label: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textDim,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontFamily: FONTS.bcBlack,
    color: C.text,
    lineHeight: undefined,
    includeFontPadding: false,
  },
  unit: {
    fontFamily: FONTS.bcBold,
    fontSize: 22,
    color: C.cyan,
    marginBottom: 12,
    marginLeft: 4,
  },
  sub: {
    fontFamily: FONTS.bcMed,
    fontSize: 11,
    color: C.textSub,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
