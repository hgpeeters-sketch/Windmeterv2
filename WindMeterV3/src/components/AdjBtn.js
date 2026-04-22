import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONTS } from '../constants/theme';

export default function AdjBtn({ onMinus10, onMinus1, onPlus1, onPlus10 }) {
  return (
    <View style={s.row}>
      {[
        { label: '−10', onPress: onMinus10 },
        { label: '−1',  onPress: onMinus1  },
        { label: '+1',  onPress: onPlus1   },
        { label: '+10', onPress: onPlus10  },
      ].map(({ label, onPress }, i) => (
        <TouchableOpacity
          key={i}
          onPress={onPress}
          style={[s.btn, i < 3 && s.btnBorder]}
          activeOpacity={0.7}
        >
          <Text style={s.label}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.sep,
    borderRadius: 6,
    overflow: 'hidden',
  },
  btn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
  },
  btnBorder: {
    borderRightWidth: 1,
    borderRightColor: C.sep,
  },
  label: {
    fontFamily: FONTS.bcBold,
    fontSize: 15,
    color: C.text,
    letterSpacing: 0.5,
  },
});
