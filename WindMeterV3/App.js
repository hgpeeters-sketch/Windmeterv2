import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  BarlowCondensed_300Light,
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_800ExtraBold_Italic,
} from '@expo-google-fonts/barlow-condensed';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';

import { C, FONTS } from './src/constants/theme';
import { useAppState } from './src/hooks/useAppState';
import { useTimer } from './src/hooks/useTimer';

import PreScreen from './src/screens/PreScreen';
import AreaScreen from './src/screens/AreaScreen';
import CourseScreen from './src/screens/CourseScreen';
import StartScreen from './src/screens/StartScreen';
import RaceScreen from './src/screens/RaceScreen';
import TrackScreen from './src/screens/TrackScreen';
import SettingsScreen from './src/screens/SettingsScreen';

SplashScreen.preventAutoHideAsync();

const TABS = [
  { id: 'pre',    label: 'PRE'   },
  { id: 'area',   label: 'AREA'  },
  { id: 'course', label: '+'     },
  { id: 'start',  label: 'START' },
  { id: 'race',   label: 'RACE'  },
  { id: 'track',  label: 'TRACK' },
];

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const s = now.getSeconds().toString().padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <Text style={clockS.text}>{time}</Text>;
}

const clockS = StyleSheet.create({
  text: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    color: C.textDim,
    letterSpacing: 1,
  },
});

function AppInner() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('pre');
  const [showSettings, setShowSettings] = useState(false);

  const appState = useAppState();
  const timer = useTimer(appState.timerMinutes);

  // Keep screen awake
  useKeepAwake();

  // Auto-switch to TRACK when timer hits 0
  const prevRemaining = useRef(timer.remaining);
  useEffect(() => {
    if (prevRemaining.current > 0 && timer.remaining === 0) {
      setTimeout(() => setTab('track'), 800);
    }
    prevRemaining.current = timer.remaining;
  }, [timer.remaining]);

  if (!appState.initialized) return null;

  const tabLabel = TABS.find(t => t.id === tab)?.label ?? '';

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerLabel}>
          {showSettings ? 'SETTINGS' : tabLabel}
        </Text>
        <Clock />
      </View>

      {/* Content */}
      <View style={s.content}>
        {showSettings ? (
          <SettingsScreen
            timerMinutes={appState.timerMinutes}
            onTimerChange={appState.changeTimerMinutes}
          />
        ) : (
          <>
            {tab === 'pre'    && <PreScreen />}
            {tab === 'area'   && (
              <AreaScreen
                twd={appState.manualTwd}
                logWindDir={appState.logWindDir}
                samples={appState.manualSamples}
              />
            )}
            {tab === 'course' && (
              <CourseScreen
                twd={appState.manualTwd}
                samples={appState.manualSamples}
              />
            )}
            {tab === 'start'  && (
              <StartScreen
                timer={timer}
                twd={appState.manualTwd}
              />
            )}
            {tab === 'race'   && (
              <RaceScreen twd={appState.manualTwd} />
            )}
            {tab === 'track'  && (
              <TrackScreen
                remaining={timer.remaining}
                twd={appState.manualTwd}
                samples={appState.manualSamples}
                autoStart={true}
              />
            )}
          </>
        )}
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(({ id, label }) => {
          const active = !showSettings && tab === id;
          const isPlus = id === 'course';
          return (
            <TouchableOpacity
              key={id}
              style={[s.tabItem, active && s.tabItemActive, isPlus && s.tabPlus]}
              onPress={() => { setShowSettings(false); setTab(id); }}
              activeOpacity={0.7}
            >
              <Text style={[s.tabLabel, active && s.tabLabelActive, isPlus && s.tabPlusLabel]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Gear */}
        <TouchableOpacity
          style={[s.tabGear, showSettings && s.tabItemActive]}
          onPress={() => setShowSettings(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[s.tabGearIcon, showSettings && s.tabLabelActive]}>⚙</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_300Light,
    BarlowCondensed_400Regular,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_800ExtraBold_Italic,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    maxWidth: 430,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.sep,
    backgroundColor: C.bg,
  },
  headerLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: C.cyan,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  tabBar: {
    height: 46,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.sep,
    backgroundColor: C.bg,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  tabItemActive: {
    borderTopColor: C.cyan,
  },
  tabPlus: {
    flex: 0.7,
  },
  tabLabel: {
    fontFamily: FONTS.bcBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.textDim,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: C.cyan,
  },
  tabPlusLabel: {
    fontSize: 18,
    lineHeight: 20,
  },
  tabGear: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
    borderLeftWidth: 1,
    borderLeftColor: C.sep,
  },
  tabGearIcon: {
    fontSize: 16,
    color: C.textDim,
  },
});
