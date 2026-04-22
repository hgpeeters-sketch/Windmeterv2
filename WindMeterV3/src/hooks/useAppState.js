import { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CUTOFF_MS = 35 * 60_000;

function loadSamples(raw) {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - CUTOFF_MS;
    return parsed.filter(s => s.time >= cutoff);
  } catch { return []; }
}

export function useAppState() {
  const [manualTwd, setManualTwd] = useState(null);
  const [manualSamples, setManualSamples] = useState([]);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [initialized, setInitialized] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [twdVal, samplesRaw, timerVal] = await Promise.all([
          AsyncStorage.getItem('v3_manualTwd'),
          AsyncStorage.getItem('v3_manualSamples'),
          AsyncStorage.getItem('v3_timerMinutes'),
        ]);
        if (twdVal !== null) setManualTwd(parseInt(twdVal));
        if (samplesRaw) setManualSamples(loadSamples(samplesRaw));
        if (timerVal) setTimerMinutes(parseInt(timerVal));
      } catch {}
      setInitialized(true);
    })();
  }, []);

  const logWindDir = useCallback((dir) => {
    const sample = { time: Date.now(), direction: dir };
    setManualTwd(dir);
    AsyncStorage.setItem('v3_manualTwd', String(dir));
    setManualSamples(prev => {
      const cutoff = Date.now() - CUTOFF_MS;
      const updated = [...prev.filter(s => s.time >= cutoff), sample];
      AsyncStorage.setItem('v3_manualSamples', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const changeTimerMinutes = useCallback((min) => {
    setTimerMinutes(min);
    AsyncStorage.setItem('v3_timerMinutes', String(min));
  }, []);

  return {
    initialized,
    manualTwd,
    manualSamples,
    timerMinutes,
    logWindDir,
    changeTimerMinutes,
  };
}
