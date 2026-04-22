import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONTS } from '../constants/theme';

export default function SL({ label, right }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      {right != null && <Text style={s.right}>{right}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  label: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.textDim,
    textTransform: 'uppercase',
  },
  right: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textDim,
    textTransform: 'uppercase',
  },
});
