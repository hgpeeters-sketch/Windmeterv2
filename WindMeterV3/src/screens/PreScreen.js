import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import SL from '../components/SL';
import BarChartSVG from '../components/BarChartSVG';
import { C, FONTS } from '../constants/theme';

const WIND_CODES = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

function degToCard(d) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(d / 22.5) % 16];
}

function fmtTime(isoStr) {
  const d = new Date(isoStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function PreScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState('');
  const [current, setCurrent] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [shiftChart, setShiftChart] = useState([]);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      // Geocode via Open-Meteo's geocoding API
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json();
      const place = geoData.results?.[0];
      if (!place) { setError('Location not found'); setLoading(false); return; }

      setLocation(`${place.name}, ${place.country_code?.toUpperCase()}`);

      const { latitude, longitude } = place;
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&hourly=wind_direction_10m,wind_speed_10m,wind_gusts_10m` +
        `&current=wind_direction_10m,wind_speed_10m,wind_gusts_10m` +
        `&wind_speed_unit=kn&timezone=auto&forecast_days=1`
      );
      const wx = await wxRes.json();

      const cur = wx.current;
      setCurrent({
        dir: Math.round(cur.wind_direction_10m),
        spd: Math.round(cur.wind_speed_10m),
        gust: Math.round(cur.wind_gusts_10m),
      });

      // Office hours only: 09:00–17:00
      const times = wx.hourly.time;
      const dirs  = wx.hourly.wind_direction_10m;
      const spds  = wx.hourly.wind_speed_10m;
      const gusts = wx.hourly.wind_gusts_10m;

      const filtered = times.map((t, i) => {
        const h = new Date(t).getHours();
        return h >= 9 && h <= 17 ? { time: t, dir: dirs[i], spd: spds[i], gust: gusts[i] } : null;
      }).filter(Boolean);

      setHourly(filtered);

      // Shift chart: deviation from mean over 12 hours
      const allDirs = dirs.slice(0, 12);
      const mean = allDirs.reduce((a, b) => a + b, 0) / allDirs.length;
      const shifts = allDirs.map(d => {
        let diff = d - mean;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
      });
      setShiftChart(shifts);
    } catch (e) {
      setError(e.message || 'Failed to fetch weather');
    }
    setLoading(false);
  }, [query]);

  return (
    <ScrollView style={s.root} keyboardShouldPersistTaps="handled">
      <View style={s.searchRow}>
        <TextInput
          style={s.input}
          placeholder="Race area city..."
          placeholderTextColor={C.textDim}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.searchBtn} onPress={search} activeOpacity={0.8}>
          <Text style={s.searchBtnLabel}>SEARCH</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={C.cyan} />
        </View>
      )}
      {!!error && <Text style={s.error}>{error}</Text>}

      {location !== '' && <Text style={s.locationLabel}>{location}</Text>}

      {current && (
        <>
          <SL label="CURRENT CONDITIONS" />
          <View style={s.condRow}>
            <View style={s.condCell}>
              <Text style={s.condLabel}>DIR</Text>
              <Text style={s.condVal}>{current.dir}</Text>
              <Text style={s.condUnit}>°</Text>
              <Text style={s.condSub}>{degToCard(current.dir)}</Text>
            </View>
            <View style={[s.condCell, s.condBorder]}>
              <Text style={s.condLabel}>WIND</Text>
              <Text style={s.condVal}>{current.spd}</Text>
              <Text style={s.condUnit}>kts</Text>
            </View>
            <View style={s.condCell}>
              <Text style={s.condLabel}>GUST</Text>
              <Text style={s.condVal}>{current.gust}</Text>
              <Text style={s.condUnit}>kts</Text>
            </View>
          </View>

          <SL label="SHIFT NEXT 12H" right="← LEFT / RIGHT →" />
          <BarChartSVG data={shiftChart} midline height={70} />
          <View style={s.chartLabels}>
            <Text style={s.chartLabel}>NOW</Text>
            <Text style={s.chartLabel}>+12h</Text>
          </View>
        </>
      )}

      {hourly.length > 0 && (
        <>
          <SL label="HOURLY FORECAST (09–17)" />
          {hourly.map((h, i) => (
            <View key={i} style={[s.hourRow, i % 2 === 1 && s.hourRowAlt]}>
              <Text style={s.hourTime}>{i === 0 ? 'NOW' : fmtTime(h.time)}</Text>
              <Text style={s.hourDir}>{Math.round(h.dir)}°</Text>
              <Text style={s.hourCard}>{degToCard(h.dir)}</Text>
              <Text style={s.hourSpd}>{Math.round(h.spd)}</Text>
              <Text style={s.hourUnit}>kts</Text>
              <Text style={s.hourGust}>G{Math.round(h.gust)}</Text>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.sep,
    color: C.text,
    fontFamily: FONTS.bReg,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
  },
  searchBtn: {
    backgroundColor: C.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    justifyContent: 'center',
  },
  searchBtnLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: C.bg,
  },
  center: { alignItems: 'center', padding: 20 },
  error: { color: C.neg, fontFamily: FONTS.bReg, fontSize: 13, padding: 12 },
  locationLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSub,
    paddingHorizontal: 14,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  condRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  condCell: {
    flex: 1,
    padding: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  condBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.sep,
  },
  condLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textDim,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  condVal: {
    fontFamily: FONTS.bcBlack,
    fontSize: 54,
    color: C.text,
    lineHeight: 56,
    includeFontPadding: false,
  },
  condUnit: {
    fontFamily: FONTS.bcBold,
    fontSize: 13,
    color: C.cyan,
    marginTop: 2,
  },
  condSub: {
    fontFamily: FONTS.bcMed,
    fontSize: 11,
    color: C.textSub,
    marginTop: 2,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  chartLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    color: C.textDim,
    letterSpacing: 1,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  hourRowAlt: { backgroundColor: C.cardAlt },
  hourTime: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    color: C.cyan,
    width: 38,
    letterSpacing: 0.5,
  },
  hourDir: {
    fontFamily: FONTS.bcBlack,
    fontSize: 20,
    color: C.text,
    width: 46,
    textAlign: 'right',
  },
  hourCard: {
    fontFamily: FONTS.bcMed,
    fontSize: 11,
    color: C.textSub,
    width: 36,
    marginLeft: 4,
  },
  hourSpd: {
    fontFamily: FONTS.bcBlack,
    fontSize: 20,
    color: C.text,
    flex: 1,
    textAlign: 'right',
  },
  hourUnit: {
    fontFamily: FONTS.bcMed,
    fontSize: 11,
    color: C.cyan,
    marginLeft: 3,
    marginRight: 10,
  },
  hourGust: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    color: C.neg,
    width: 40,
    textAlign: 'right',
  },
});
