import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import SL from '../components/SL';
import AdjBtn from '../components/AdjBtn';
import MiniRow from '../components/MiniRow';
import BarChartSVG from '../components/BarChartSVG';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';
import { circularMean } from '../utils/geo';
import { analyzeWind } from '../utils/anthropic';

function fmt(deg) { return ((deg % 360) + 360) % 360; }

export default function CourseScreen({ twd, samples }) {
  const [markBearing, setMarkBearing] = useState(() => twd ?? 0);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const adj = (d) => setMarkBearing(prev => fmt(prev + d));

  const avgTwd = samples.length ? Math.round(circularMean(samples.map(s => s.direction))) : (twd ?? 0);
  const shiftDeg = samples.length > 1
    ? (() => {
        const dirs = samples.map(s => s.direction);
        const third = Math.max(1, Math.floor(dirs.length / 3));
        let t = circularMean(dirs.slice(-third)) - circularMean(dirs.slice(0, third));
        if (t > 180) t -= 360;
        if (t < -180) t += 360;
        return Math.round(t);
      })()
    : 0;
  const liftedTack = shiftDeg > 0 ? 'STBD ▶' : shiftDeg < 0 ? '◀ PORT' : 'NEUTRAL';
  const favour = shiftDeg > 2 ? 'RIGHT' : shiftDeg < -2 ? 'LEFT' : 'NEUTRAL';
  const favourColor = shiftDeg > 2 ? C.cyan : shiftDeg < -2 ? C.neg : C.textSub;

  const shiftHistory = samples.slice(-48).map(s => {
    let d = s.direction - avgTwd;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  });

  async function runAiAnalysis() {
    setAiLoading(true);
    setAiError('');
    setAiText('');
    try {
      const text = await analyzeWind(samples);
      setAiText(text);
    } catch (e) {
      setAiError(e.message);
    }
    setAiLoading(false);
  }

  return (
    <ScrollView style={s.root}>
      <SL label="MARK BEARING" />
      <View style={s.heroWrap}>
        <Text style={s.heroLabel}>MARK</Text>
        <View style={s.heroRow}>
          <Text style={[s.heroVal, NUM_SHADOW]}>{fmt(markBearing)}</Text>
          <Text style={s.heroUnit}>°</Text>
        </View>
      </View>
      <View style={s.adjPad}>
        <AdjBtn
          onMinus10={() => adj(-10)}
          onMinus1={() => adj(-1)}
          onPlus1={() => adj(1)}
          onPlus10={() => adj(10)}
        />
      </View>

      <MiniRow cells={[
        { label: 'AVG TWD', value: avgTwd, unit: '°' },
        { label: 'SHIFT', value: (shiftDeg > 0 ? '+' : '') + shiftDeg, unit: '°', sub: shiftDeg > 0 ? 'right' : shiftDeg < 0 ? 'left' : 'neutral' },
        { label: 'LIFTED', value: liftedTack },
      ]} />

      <SL label="SHIFT vs MARK" right="← PORT / STBD →" />
      <BarChartSVG data={shiftHistory} midline height={70} />

      <SL label="FAVOURED SIDE" />
      <View style={s.favourCard}>
        <Text style={[s.favourVal, { color: favourColor }]}>{favour}</Text>
        {shiftDeg !== 0 && (
          <Text style={s.favourSub}>
            Wind shifted {Math.abs(shiftDeg)}° {shiftDeg > 0 ? 'right' : 'left'}
          </Text>
        )}
      </View>

      <SL label="AI WIND ANALYSIS" />
      <View style={s.aiSection}>
        {!aiText && !aiLoading && (
          <TouchableOpacity style={s.aiBtn} onPress={runAiAnalysis} activeOpacity={0.8}>
            <Text style={s.aiBtnLabel}>ANALYSE WITH CLAUDE</Text>
          </TouchableOpacity>
        )}
        {aiLoading && <ActivityIndicator color={C.cyan} style={{ marginVertical: 16 }} />}
        {!!aiError && <Text style={s.aiError}>{aiError}</Text>}
        {!!aiText && (
          <>
            <Text style={s.aiText}>{aiText}</Text>
            <TouchableOpacity style={s.aiRefreshBtn} onPress={runAiAnalysis} activeOpacity={0.8}>
              <Text style={s.aiRefreshLabel}>REFRESH</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  heroWrap: { backgroundColor: C.card, padding: 14, paddingBottom: 18 },
  heroLabel: {
    fontFamily: FONTS.bcBold, fontSize: 9, letterSpacing: 2, color: C.textDim,
    textTransform: 'uppercase', marginBottom: 2,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroVal: {
    fontFamily: FONTS.bcBlack, fontSize: 112, color: C.text, includeFontPadding: false,
  },
  heroUnit: {
    fontFamily: FONTS.bcBold, fontSize: 28, color: C.cyan, marginBottom: 16, marginLeft: 4,
  },
  adjPad: { padding: 12, paddingTop: 8 },
  favourCard: {
    backgroundColor: C.card,
    padding: 20,
    alignItems: 'center',
  },
  favourVal: {
    fontFamily: FONTS.bcBlack,
    fontSize: 80,
    includeFontPadding: false,
    letterSpacing: -1,
  },
  favourSub: {
    fontFamily: FONTS.bcMed,
    fontSize: 12,
    color: C.textSub,
    marginTop: 6,
  },
  aiSection: { padding: 12 },
  aiBtn: {
    backgroundColor: C.cyanDim,
    borderWidth: 1,
    borderColor: C.cyan,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  aiBtnLabel: {
    fontFamily: FONTS.bcBold, fontSize: 12, letterSpacing: 2, color: C.cyan,
  },
  aiError: {
    fontFamily: FONTS.bReg, fontSize: 13, color: C.neg, marginVertical: 8,
  },
  aiText: {
    fontFamily: FONTS.bReg, fontSize: 13, color: C.text, lineHeight: 20,
    marginBottom: 12,
  },
  aiRefreshBtn: {
    borderWidth: 1, borderColor: C.sep, borderRadius: 4,
    paddingVertical: 10, alignItems: 'center',
  },
  aiRefreshLabel: {
    fontFamily: FONTS.bcBold, fontSize: 11, letterSpacing: 1.5, color: C.textSub,
  },
});
