import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SL from '../components/SL';
import Pill from '../components/Pill';
import { C, FONTS } from '../constants/theme';

const TIMER_OPTS = [
  { label: '3 MIN', value: 3 },
  { label: '5 MIN', value: 5 },
  { label: '10 MIN', value: 10 },
];

const BEEP_OPTS = [
  { label: 'QUIET', value: -12 },
  { label: 'MEDIUM', value: -6 },
  { label: 'LOUD', value: 0 },
  { label: 'MAX', value: 6 },
];

const ROLL_OPTS = [
  { label: 'FAST', value: 150 },
  { label: 'MED', value: 500 },
  { label: 'SLOW', value: 1200 },
];

export default function SettingsScreen({ timerMinutes, onTimerChange }) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [beepDb, setBeepDb] = useState(0);
  const [rollMs, setRollMs] = useState(500);

  useEffect(() => {
    (async () => {
      const [k, b, r] = await Promise.all([
        AsyncStorage.getItem('anthropicKey'),
        AsyncStorage.getItem('v3_beepDb'),
        AsyncStorage.getItem('v3_rollMs'),
      ]);
      if (k) setApiKey(k);
      if (b !== null) setBeepDb(parseFloat(b));
      if (r !== null) setRollMs(parseInt(r));
    })();
  }, []);

  async function saveKey() {
    await AsyncStorage.setItem('anthropicKey', apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changeBeep(v) {
    setBeepDb(v);
    await AsyncStorage.setItem('v3_beepDb', String(v));
  }

  async function changeRoll(v) {
    setRollMs(v);
    await AsyncStorage.setItem('v3_rollMs', String(v));
  }

  const masked = apiKey.trim().length > 0
    ? apiKey.trim().slice(0, 10) + '••••••••••••••••'
    : '';

  return (
    <ScrollView style={s.root}>
      <SL label="START TIMER DURATION" />
      <View style={s.section}>
        <Pill
          options={TIMER_OPTS}
          value={timerMinutes}
          onChange={onTimerChange}
        />
        <Text style={s.hint}>Takes effect on next RESET. Default is 5 minutes.</Text>
      </View>

      <SL label="BEEP VOLUME" />
      <View style={s.section}>
        <Pill
          options={BEEP_OPTS}
          value={beepDb}
          onChange={changeBeep}
        />
        <Text style={s.hint}>
          {beepDb === -12 ? '−12 dB' : beepDb === -6 ? '−6 dB' : beepDb === 0 ? '0 dB (default)' : '+6 dB'}
          {' '}· Controls timer signal volume.
        </Text>
      </View>

      <SL label="ROLL REFRESH RATE" />
      <View style={s.section}>
        <Pill
          options={ROLL_OPTS}
          value={rollMs}
          onChange={changeRoll}
        />
        <Text style={s.hint}>Controls heel sensor update rate. Slower = smoother.</Text>
      </View>

      <SL label="ANTHROPIC API KEY" />
      <View style={s.section}>
        <TextInput
          value={apiKey}
          onChangeText={v => { setApiKey(v); setSaved(false); }}
          placeholder="sk-ant-..."
          placeholderTextColor={C.textDim}
          secureTextEntry
          style={s.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {apiKey.trim().length > 0 && (
          <Text style={s.masked}>Stored: {masked}</Text>
        )}
        <TouchableOpacity
          style={[s.saveBtn, saved && s.saveBtnDone]}
          onPress={saveKey}
          activeOpacity={0.8}
        >
          <Text style={[s.saveBtnLabel, saved && s.saveBtnLabelDone]}>
            {saved ? '✓  SAVED' : 'SAVE KEY'}
          </Text>
        </TouchableOpacity>
        <Text style={s.hint}>
          Get your key at console.anthropic.com — stored locally on this device only.
        </Text>
      </View>

      <SL label="ABOUT" />
      <View style={s.section}>
        <Text style={s.aboutName}>WindMeter v3.0</Text>
        <Text style={s.aboutSub}>Manual TWD · Claude AI · Expo</Text>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  section: {
    backgroundColor: C.card,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
  },
  hint: {
    fontFamily: FONTS.bReg,
    fontSize: 11,
    color: C.textDim,
    marginTop: 8,
    lineHeight: 17,
  },
  input: {
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.sep,
    color: C.text,
    fontFamily: FONTS.bReg,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
  },
  masked: {
    fontFamily: FONTS.bReg,
    fontSize: 11,
    color: C.textSub,
    marginTop: 6,
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: C.cyan,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: C.cyanDim },
  saveBtnLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 13,
    letterSpacing: 2,
    color: C.bg,
  },
  saveBtnLabelDone: { color: C.cyan },
  aboutName: {
    fontFamily: FONTS.bcBlack,
    fontSize: 24,
    color: C.text,
    marginBottom: 4,
  },
  aboutSub: {
    fontFamily: FONTS.bcMed,
    fontSize: 12,
    color: C.textSub,
    letterSpacing: 0.5,
  },
});
