import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import SL from '../components/SL';
import MiniRow from '../components/MiniRow';
import { C, FONTS, NUM_SHADOW } from '../constants/theme';
import { haversineNm, circularMean } from '../utils/geo';
import { analyzeRace } from '../utils/anthropic';

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildGPX(pts) {
  const trkpts = pts.map(p =>
    `    <trkpt lat="${p.latitude.toFixed(6)}" lon="${p.longitude.toFixed(6)}">
      <time>${new Date(p.time).toISOString()}</time>
      <extensions><speed>${p.speed.toFixed(3)}</speed><course>${p.cog?.toFixed(1) ?? 0}</course></extensions>
    </trkpt>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="WindMeter v3">
  <trk><name>Race Track</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`;
}

function computeStats(pts, twd) {
  if (pts.length < 2) return null;
  const dur = pts[pts.length - 1].time - pts[0].time;
  let distNm = 0, tacks = 0;
  let prevCog = null;
  const speeds = [];
  for (let i = 1; i < pts.length; i++) {
    distNm += haversineNm(pts[i - 1], pts[i]);
    const spd = pts[i].speed * 1.94384;
    if (spd > 0.2) speeds.push(spd);
    if (prevCog !== null && spd > 0.5) {
      const diff = Math.abs(((pts[i].cog - prevCog) + 180) % 360 - 180);
      if (diff > 70) tacks++;
    }
    prevCog = pts[i].cog;
  }
  const avgSpd = speeds.length ? speeds.reduce((a, b) => a + b) / speeds.length : 0;
  const maxSpd = speeds.length ? Math.max(...speeds) : 0;
  return { dur, distNm, tacks, avgSpd, maxSpd };
}

export default function TrackScreen({ remaining, twd, samples, autoStart }) {
  const [recording, setRecording] = useState(false);
  const [pts, setPts] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const watchRef = useRef(null);
  const startedRef = useRef(false);
  const elapsedRef = useRef(0);
  const timerRef = useRef(null);

  // Auto-start at gun
  useEffect(() => {
    if (remaining === 0 && !startedRef.current && autoStart) {
      startedRef.current = true;
      startRecording();
    }
  }, [remaining]);

  async function startRecording() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    setPts([]);
    setAiText('');
    setAiError('');
    setElapsed(0);
    elapsedRef.current = 0;
    setRecording(true);

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5000, distanceInterval: 5 },
      (loc) => {
        const pt = {
          time: loc.timestamp,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed ?? 0,
          cog: loc.coords.heading ?? 0,
        };
        setPts(prev => [...prev, pt]);
      }
    );
  }

  function stopRecording() {
    watchRef.current?.remove();
    watchRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  }

  async function exportGPX() {
    if (!pts.length) return;
    const gpx = buildGPX(pts);
    const path = FileSystem.cacheDirectory + 'track.gpx';
    await FileSystem.writeAsStringAsync(path, gpx, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX' });
  }

  async function runAi() {
    if (!pts.length) return;
    setAiLoading(true);
    setAiError('');
    setAiText('');
    try {
      const text = await analyzeRace(pts, samples, twd);
      setAiText(text);
    } catch (e) {
      setAiError(e.message);
    }
    setAiLoading(false);
  }

  const stats = computeStats(pts, twd);

  return (
    <ScrollView style={s.root}>
      <SL label="TRACK RECORDER" right={recording ? `${fmtDuration(elapsed * 1000)}` : ''} />

      <View style={s.recCard}>
        {recording ? (
          <>
            <View style={s.recIndicator}>
              <View style={s.recDot} />
              <Text style={s.recLabel}>RECORDING  {pts.length} pts</Text>
            </View>
            <TouchableOpacity style={s.stopBtn} onPress={stopRecording} activeOpacity={0.8}>
              <Text style={s.stopBtnLabel}>■ STOP RECORDING</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {pts.length === 0 && (
              <Text style={s.hint}>
                {remaining === 0
                  ? 'Timer complete — tap to record your race track.'
                  : 'Recording starts automatically at gun, or tap below.'}
              </Text>
            )}
            <TouchableOpacity style={s.startBtn} onPress={startRecording} activeOpacity={0.8}>
              <Text style={s.startBtnLabel}>▶ START RECORDING</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {stats && (
        <>
          <MiniRow cells={[
            { label: 'DIST', value: stats.distNm.toFixed(2), unit: 'nm' },
            { label: 'TACKS', value: stats.tacks.toString() },
            { label: 'AVG SPD', value: stats.avgSpd.toFixed(1), unit: 'kts' },
            { label: 'MAX SPD', value: stats.maxSpd.toFixed(1), unit: 'kts' },
          ]} />

          <View style={s.actions}>
            <TouchableOpacity style={s.actionBtn} onPress={exportGPX} activeOpacity={0.8}>
              <Text style={s.actionBtnLabel}>EXPORT GPX</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.actionBtnCyan]} onPress={runAi} activeOpacity={0.8}>
              <Text style={[s.actionBtnLabel, { color: C.cyan }]}>AI DEBRIEF</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {aiLoading && (
        <View style={s.aiCenter}>
          <ActivityIndicator color={C.cyan} />
          <Text style={s.aiWait}>Analysing with Claude...</Text>
        </View>
      )}
      {!!aiError && <Text style={s.aiError}>{aiError}</Text>}
      {!!aiText && (
        <View style={s.aiCard}>
          <SL label="AI TACTICAL DEBRIEF" />
          <Text style={s.aiText}>{aiText}</Text>
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  recCard: {
    backgroundColor: C.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ff3333',
    marginRight: 8,
  },
  recLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#ff3333',
  },
  hint: {
    fontFamily: FONTS.bReg,
    fontSize: 13,
    color: C.textSub,
    marginBottom: 12,
    lineHeight: 20,
  },
  startBtn: {
    backgroundColor: C.cyanDim,
    borderWidth: 1,
    borderColor: C.cyan,
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnLabel: {
    fontFamily: FONTS.bcBold, fontSize: 13, letterSpacing: 2, color: C.cyan,
  },
  stopBtn: {
    backgroundColor: 'rgba(255,51,51,0.15)',
    borderWidth: 1,
    borderColor: '#ff3333',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopBtnLabel: {
    fontFamily: FONTS.bcBold, fontSize: 13, letterSpacing: 2, color: '#ff3333',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.sep,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnCyan: {
    borderColor: C.cyan,
    backgroundColor: C.cyanDim,
  },
  actionBtnLabel: {
    fontFamily: FONTS.bcBold, fontSize: 12, letterSpacing: 1.5, color: C.textSub,
  },
  aiCenter: { padding: 20, alignItems: 'center', gap: 10 },
  aiWait: { fontFamily: FONTS.bReg, fontSize: 12, color: C.textSub },
  aiError: { color: C.neg, fontFamily: FONTS.bReg, fontSize: 13, padding: 12 },
  aiCard: { backgroundColor: C.card, marginTop: 4 },
  aiText: {
    fontFamily: FONTS.bReg, fontSize: 13, color: C.text,
    padding: 14, lineHeight: 21,
  },
});
