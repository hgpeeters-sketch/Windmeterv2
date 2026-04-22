import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import SL from '../components/SL';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function RollGauge({ roll }) {
  const size = 160;
  const cx = size / 2, cy = size / 2, r = 60;
  const maxRoll = 40;
  const angle = clamp(roll, -maxRoll, maxRoll);
  const ballAngle = (angle / maxRoll) * 70;
  const ballRad = (ballAngle - 90) * Math.PI / 180;
  const bx = cx + r * Math.cos(ballRad);
  const by = cy + r * Math.sin(ballRad);

  return (
    <Svg width={size} height={size}>
      <Path
        d={`M ${cx + r * Math.cos(160 * Math.PI / 180)} ${cy + r * Math.sin(160 * Math.PI / 180)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(20 * Math.PI / 180)} ${cy + r * Math.sin(20 * Math.PI / 180)}`}
        fill="none" stroke={C.sep} strokeWidth={8} strokeLinecap="round"
      />
      <Circle cx={bx} cy={by} r={10} fill={Math.abs(angle) < 3 ? C.cyan : C.neg} />
      <SvgText x={cx} y={cy + 6} fill={C.text} fontSize={28} fontWeight="800" textAnchor="middle">
        {roll >= 0 ? '+' : ''}{roll.toFixed(1)}
      </SvgText>
      <SvgText x={cx} y={cy + 20} fill={C.textDim} fontSize={9} textAnchor="middle">°</SvgText>
    </Svg>
  );
}

function CogGauge({ cog }) {
  const size = 180;
  const cx = size / 2, cy = size;
  const r = 80;
  const needle = (cog ?? 0);
  const cogRad = ((needle - 90) * Math.PI / 180);
  const nx = cx + r * 0.85 * Math.cos(cogRad);
  const ny = cy + r * 0.85 * Math.sin(cogRad);

  return (
    <Svg width={size} height={size * 0.6}>
      <Path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={C.sep} strokeWidth={2}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const rad = (a - 90) * Math.PI / 180;
        return (
          <SvgText
            key={a}
            x={cx + (r + 12) * Math.cos(rad)}
            y={cy + (r + 12) * Math.sin(rad) + 4}
            fill={C.textDim} fontSize={8} textAnchor="middle"
          >
            {['N','NE','E','SE','S','SW','W','NW'][a / 45]}
          </SvgText>
        );
      })}
      <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.cyan} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={5} fill={C.cyan} />
    </Svg>
  );
}

export default function RaceScreen({ twd }) {
  const [roll, setRoll] = useState(0);
  const [cog, setCog] = useState(null);
  const [active, setActive] = useState(false);
  const subRef = useRef(null);

  const rollRate = 500;

  useEffect(() => {
    if (!active) {
      subRef.current?.remove();
      subRef.current = null;
      return;
    }
    Accelerometer.setUpdateInterval(rollRate);
    subRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const r = Math.atan2(x, Math.sqrt(y * y + z * z)) * 180 / Math.PI;
      setRoll(parseFloat(r.toFixed(1)));
    });
    return () => { subRef.current?.remove(); subRef.current = null; };
  }, [active, rollRate]);

  const rollAbs = Math.abs(roll);
  const rollLabel = rollAbs < 2 ? 'LEVEL' : roll > 0 ? 'STBD' : 'PORT';

  return (
    <View style={s.root}>
      <SL label="COURSE OVER GROUND" />
      <View style={s.cogCard}>
        <Text style={s.cogLabel}>COG</Text>
        <View style={s.cogRow}>
          <Text style={[s.cogVal, NUM_SHADOW]}>{cog !== null ? Math.round(cog) : '—'}</Text>
          {cog !== null && <Text style={s.cogUnit}>°</Text>}
        </View>
        <View style={s.gaugeWrap}>
          <CogGauge cog={cog} />
        </View>
      </View>

      <SL label="HEEL / ROLL" right={rollLabel} />
      <View style={s.rollCard}>
        <View style={s.rollRow}>
          <View style={s.rollGaugeWrap}>
            <RollGauge roll={roll} />
          </View>
          <View style={s.rollInfo}>
            <Text style={[s.rollVal, NUM_SHADOW, { color: rollAbs < 3 ? C.cyan : C.text }]}>
              {rollLabel === 'LEVEL' ? '0.0' : roll.toFixed(1)}
            </Text>
            <Text style={s.rollUnit}>° {rollLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[s.activateBtn, active && s.activateBtnOn]}
          onPress={() => setActive(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={[s.activateLabel, active && s.activateLabelOn]}>
            {active ? '■ DEACTIVATE' : '▶ ACTIVATE ROLL'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  cogCard: {
    backgroundColor: C.card,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  cogLabel: {
    fontFamily: FONTS.bcBold, fontSize: 9, letterSpacing: 2,
    color: C.textDim, textTransform: 'uppercase', marginBottom: 2,
  },
  cogRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cogVal: {
    fontFamily: FONTS.bcBlack, fontSize: 72, color: C.text, includeFontPadding: false,
  },
  cogUnit: {
    fontFamily: FONTS.bcBold, fontSize: 22, color: C.cyan, marginBottom: 10, marginLeft: 4,
  },
  gaugeWrap: { alignItems: 'center', marginTop: 4 },
  rollCard: {
    backgroundColor: C.card,
    padding: 14,
  },
  rollRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rollGaugeWrap: { marginRight: 16 },
  rollInfo: { flex: 1 },
  rollVal: {
    fontFamily: FONTS.bcBlack, fontSize: 56, color: C.text, includeFontPadding: false,
  },
  rollUnit: {
    fontFamily: FONTS.bcBold, fontSize: 14, color: C.textSub, marginTop: 4, letterSpacing: 1,
  },
  activateBtn: {
    borderWidth: 1,
    borderColor: C.sep,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activateBtnOn: {
    backgroundColor: C.cyanDim,
    borderColor: C.cyan,
  },
  activateLabel: {
    fontFamily: FONTS.bcBold, fontSize: 12, letterSpacing: 2, color: C.textSub,
  },
  activateLabelOn: { color: C.cyan },
});
