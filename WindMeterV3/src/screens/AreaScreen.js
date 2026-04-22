import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import * as Location from 'expo-location';
import SL from '../components/SL';
import HeroCard from '../components/HeroCard';
import AdjBtn from '../components/AdjBtn';
import BarChartSVG from '../components/BarChartSVG';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';
import { haversineNm } from '../utils/geo';

function fmt(deg) {
  return ((deg % 360) + 360) % 360;
}

export default function AreaScreen({ twd, logWindDir, samples }) {
  const [committee, setCommittee] = useState(null);
  const [pin, setPin] = useState(null);
  const pingLoading = useRef({ committee: false, pin: false });
  const [pinging, setPinging] = useState({ committee: false, pin: false });

  const dir = twd !== null && twd !== undefined ? fmt(twd) : 0;

  const adj = (delta) => logWindDir(fmt((twd ?? 180) + delta));

  async function pingMark(mark) {
    if (pingLoading.current[mark]) return;
    pingLoading.current[mark] = true;
    setPinging(p => ({ ...p, [mark]: true }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPinging(p => ({ ...p, [mark]: false })); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mark === 'committee') setCommittee(loc.coords);
      else setPin(loc.coords);
    } catch {}
    pingLoading.current[mark] = false;
    setPinging(p => ({ ...p, [mark]: false }));
  }

  function resetMark(mark) {
    if (mark === 'committee') setCommittee(null);
    else setPin(null);
  }

  const lineLength = committee && pin ? haversineNm(committee, pin) : null;
  const lineLengthM = lineLength ? Math.round(lineLength * 1852) : null;

  const lastLogged = samples.length ? samples[samples.length - 1] : null;
  const chartData = samples.slice(-60).map(s => s.direction);

  return (
    <ScrollView style={s.root}>
      <SL label="TRUE WIND DIRECTION" />

      <View style={s.heroWrap}>
        <Text style={s.heroLabel}>TWD</Text>
        <View style={s.heroRow}>
          <Text style={[s.heroVal, NUM_SHADOW]}>{twd !== null ? fmt(twd) : '—'}</Text>
          <Text style={s.heroUnit}>°</Text>
        </View>
        {lastLogged && (
          <Text style={s.heroSub}>
            Last logged {Math.round((Date.now() - lastLogged.time) / 60000)}m ago
          </Text>
        )}
      </View>

      <View style={s.adjPad}>
        <AdjBtn
          onMinus10={() => adj(-10)}
          onMinus1={() => adj(-1)}
          onPlus1={() => adj(1)}
          onPlus10={() => adj(10)}
        />
      </View>

      <TouchableOpacity style={s.logBtn} onPress={() => adj(0)} activeOpacity={0.8}>
        <Text style={s.logBtnLabel}>LOG READING</Text>
      </TouchableOpacity>

      <SL
        label="START LINE"
        right={lineLength ? `${lineLengthM}m / ${lineLength.toFixed(3)}nm` : undefined}
      />

      {['committee', 'pin'].map(mark => (
        <View key={mark} style={s.pingRow}>
          <Text style={s.pingName}>{mark === 'committee' ? 'COMMITTEE' : 'PIN'}</Text>
          <View style={s.pingStatus}>
            {mark === 'committee'
              ? committee ? <Text style={s.pingSet}>SET ✓</Text> : <Text style={s.pingUnset}>NOT SET</Text>
              : pin ? <Text style={s.pingSet}>SET ✓</Text> : <Text style={s.pingUnset}>NOT SET</Text>
            }
          </View>
          <TouchableOpacity
            style={[s.pingBtn, pinging[mark] && s.pingBtnActive]}
            onPress={() => pingMark(mark)}
            activeOpacity={0.8}
          >
            <Text style={s.pingBtnLabel}>{pinging[mark] ? '...' : 'PING'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.resetBtn} onPress={() => resetMark(mark)} activeOpacity={0.8}>
            <Text style={s.resetBtnLabel}>RESET</Text>
          </TouchableOpacity>
        </View>
      ))}

      {samples.length > 1 && (
        <>
          <SL label="TWD HISTORY" right={`${samples.length} samples`} />
          <BarChartSVG data={chartData} height={60} />
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  heroWrap: {
    backgroundColor: C.card,
    padding: 14,
    paddingBottom: 18,
  },
  heroLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textDim,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroVal: {
    fontFamily: FONTS.bcBlack,
    fontSize: 112,
    color: C.text,
    includeFontPadding: false,
  },
  heroUnit: {
    fontFamily: FONTS.bcBold,
    fontSize: 28,
    color: C.cyan,
    marginBottom: 16,
    marginLeft: 4,
  },
  heroSub: {
    fontFamily: FONTS.bcMed,
    fontSize: 11,
    color: C.textSub,
    marginTop: 4,
  },
  adjPad: { padding: 12, paddingTop: 8 },
  logBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: C.cyanDim,
    borderWidth: 1,
    borderColor: C.cyan,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logBtnLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 13,
    letterSpacing: 2,
    color: C.cyan,
    textTransform: 'uppercase',
  },
  pingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  pingName: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textSub,
    flex: 1,
  },
  pingStatus: { marginRight: 12 },
  pingSet: { fontFamily: FONTS.bcBold, fontSize: 10, color: C.cyan },
  pingUnset: { fontFamily: FONTS.bcBold, fontSize: 10, color: C.textDim },
  pingBtn: {
    backgroundColor: C.sep,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  pingBtnActive: { backgroundColor: C.cyanDim },
  pingBtnLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.cyan,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: C.sep,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetBtnLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textSub,
  },
});
