import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';
import { haversineNm } from '../utils/geo';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.abs(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function CompassRose({ twd, lineBias }) {
  const size = 120;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const twdRad = ((twd ?? 0) - 90) * Math.PI / 180;
  const arrowX = cx + r * 0.8 * Math.cos(twdRad);
  const arrowY = cy + r * 0.8 * Math.sin(twdRad);
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={C.sep} strokeWidth={1} />
      {['N','E','S','W'].map((d, i) => {
        const a = (i * 90 - 90) * Math.PI / 180;
        return (
          <SvgText
            key={d}
            x={cx + (r - 10) * Math.cos(a)}
            y={cy + (r - 10) * Math.sin(a) + 4}
            fill={C.textDim}
            fontSize={9}
            textAnchor="middle"
            fontWeight="bold"
          >{d}</SvgText>
        );
      })}
      <Line
        x1={cx} y1={cy}
        x2={arrowX} y2={arrowY}
        stroke={C.cyan} strokeWidth={2} strokeLinecap="round"
      />
      <Circle cx={cx} cy={cy} r={3} fill={C.cyan} />
    </Svg>
  );
}

export default function StartScreen({ timer, twd, lineLength, committee, pin, position }) {
  const { remaining, running, startStop, reset, sync } = timer;
  const total = remaining + (running ? 0 : 0);
  const isOCS = false; // computed below

  const distToLine = (() => {
    if (!position || !committee || !pin) return null;
    // simplified: distance to midpoint of line
    const mid = {
      latitude: (committee.latitude + pin.latitude) / 2,
      longitude: (committee.longitude + pin.longitude) / 2,
    };
    return haversineNm(position, mid);
  })();

  const distM = distToLine !== null ? Math.round(distToLine * 1852) : null;
  const ocs = distToLine !== null && distToLine < 0 && remaining <= 60 && running;

  const progress = remaining / (Math.ceil(remaining / 60) * 60 || 60);

  const lineBias = null;
  const biasLabel = twd !== null ? 'LOG TWD IN AREA' : '—';

  const mmss = fmtTime(remaining);

  return (
    <View style={s.root}>
      {/* Countdown */}
      <View style={s.timerCard}>
        <Text style={s.timerLabel}>START TIMER</Text>
        <Text style={[s.timerVal, NUM_SHADOW, remaining <= 15 && remaining > 0 && s.timerRed]}>
          {mmss}
        </Text>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { flex: remaining, backgroundColor: remaining <= 60 ? C.neg : C.cyan }]} />
          <View style={{ flex: Math.max(0, (timer.remRef?.current ?? remaining) - remaining) }} />
        </View>
      </View>

      {/* Timer controls */}
      <View style={s.ctrlRow}>
        <TouchableOpacity
          style={[s.ctrlBtn, running && s.ctrlBtnActive]}
          onPress={startStop} activeOpacity={0.8}
        >
          <Text style={[s.ctrlLabel, running && s.ctrlLabelActive]}>
            {running ? 'PAUSE' : 'START'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctrlBtn} onPress={reset} activeOpacity={0.8}>
          <Text style={s.ctrlLabel}>RESET</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctrlBtn} onPress={sync} activeOpacity={0.8}>
          <Text style={s.ctrlLabel}>SYNC</Text>
        </TouchableOpacity>
      </View>

      {/* Distance to line */}
      <View style={[s.distCard, ocs && s.distCardOCS]}>
        <Text style={s.distLabel}>
          {lineLength ? `LINE ${Math.round(lineLength * 1852)}m` : 'DISTANCE TO START LINE'}
        </Text>
        <View style={s.distRow}>
          <Text style={[s.distVal, ocs && s.distValOCS]}>
            {distM !== null ? distM : '—'}
          </Text>
          {distM !== null && <Text style={[s.distUnit, ocs && { color: '#ff3333' }]}>m</Text>}
          {ocs && <Text style={s.ocsTag}>⚠ OCS</Text>}
        </View>
        {distToLine !== null && (
          <Text style={s.distSub}>{distToLine.toFixed(3)} nm from line midpoint</Text>
        )}
      </View>

      {/* Line bias */}
      <View style={s.biasCard}>
        <Text style={s.biasLabel}>LINE BIAS</Text>
        <View style={s.biasContent}>
          <CompassRose twd={twd} />
          <View style={s.biasInfo}>
            <Text style={s.biasSub}>
              {twd !== null ? `TWD ${twd}°` : 'No TWD – log in AREA tab'}
            </Text>
            {lineLength && (
              <Text style={s.biasSub}>Line {Math.round(lineLength * 1852)}m</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  timerCard: {
    backgroundColor: C.card,
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  timerLabel: {
    fontFamily: FONTS.bcBold, fontSize: 9, letterSpacing: 2,
    color: C.textDim, textTransform: 'uppercase', marginBottom: 4,
  },
  timerVal: {
    fontFamily: FONTS.bcBlack,
    fontSize: 96,
    color: C.text,
    lineHeight: 100,
    includeFontPadding: false,
    letterSpacing: -2,
  },
  timerRed: { color: '#ff3333' },
  progressBar: {
    height: 3,
    flexDirection: 'row',
    backgroundColor: C.sep,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 2,
  },
  ctrlRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  ctrlBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: C.sep,
  },
  ctrlBtnActive: { backgroundColor: C.cyanDim },
  ctrlLabel: {
    fontFamily: FONTS.bcBold, fontSize: 13, letterSpacing: 2, color: C.textSub,
  },
  ctrlLabelActive: { color: C.cyan },
  distCard: {
    padding: 16,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  distCardOCS: { backgroundColor: '#1e0000' },
  distLabel: {
    fontFamily: FONTS.bcBold, fontSize: 9, letterSpacing: 2,
    color: C.textDim, textTransform: 'uppercase', marginBottom: 4,
  },
  distRow: { flexDirection: 'row', alignItems: 'flex-end' },
  distVal: {
    fontFamily: FONTS.bcBlack, fontSize: 72, color: C.text, includeFontPadding: false,
  },
  distValOCS: { color: '#ff3333' },
  distUnit: {
    fontFamily: FONTS.bcBold, fontSize: 22, color: C.cyan, marginBottom: 10, marginLeft: 6,
  },
  ocsTag: {
    fontFamily: FONTS.bcBold, fontSize: 16, color: '#ff3333', marginBottom: 12, marginLeft: 12,
  },
  distSub: {
    fontFamily: FONTS.bcMed, fontSize: 11, color: C.textSub, marginTop: 4,
  },
  biasCard: {
    padding: 16,
    backgroundColor: C.card,
  },
  biasLabel: {
    fontFamily: FONTS.bcBold, fontSize: 9, letterSpacing: 2,
    color: C.textDim, textTransform: 'uppercase', marginBottom: 10,
  },
  biasContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  biasInfo: { flex: 1 },
  biasSub: {
    fontFamily: FONTS.bcMed, fontSize: 12, color: C.textSub, marginBottom: 4,
  },
});
