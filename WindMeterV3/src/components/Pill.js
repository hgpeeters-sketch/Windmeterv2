import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONTS } from '../constants/theme';

export default function Pill({ options, value, onChange }) {
  return (
    <View style={s.pill}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[s.seg, active && s.segActive, i < options.length - 1 && s.segBorder]}
            activeOpacity={0.8}
          >
            <Text style={[s.label, active && s.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.sep,
    borderRadius: 6,
    overflow: 'hidden',
  },
  seg: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: C.card,
  },
  segActive: {
    backgroundColor: C.cyanDim,
  },
  segBorder: {
    borderRightWidth: 1,
    borderRightColor: C.sep,
  },
  label: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    letterSpacing: 1,
    color: C.textSub,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: C.cyan,
  },
});
