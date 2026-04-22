import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

function playTone(freq, duration, volume = 0.8) {
  // expo-av doesn't natively support oscillators; beeps are approximated
  // via pre-generated audio or silent stubs. For a full implementation,
  // use expo-audio with an AudioWorklet polyfill or a native module.
}

function playSignal(r) {
  if (r === 0) {
    playTone(660, 180); playTone(880, 180); playTone(1100, 500);
  } else if (r <= 15) {
    playTone(880, 80, 0.75);
  } else if (r <= 60 && r % 10 === 0) {
    playTone(660, 120, 0.8); playTone(660, 120, 0.8);
  } else if (r % 60 === 0) {
    playTone(440, 500, 0.8);
  }
}

export function useTimer(totalMinutes) {
  const total = totalMinutes * 60;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);
  const remRef = useRef(total);

  // Restore saved remaining
  useEffect(() => {
    AsyncStorage.getItem('v3_sl_remaining').then(v => {
      if (v !== null) {
        const n = Math.max(0, parseInt(v));
        remRef.current = n;
        setRemaining(n);
      }
    });
  }, []);

  // Reset when totalMinutes changes and timer isn't running
  useEffect(() => {
    if (!runRef.current) {
      const t = totalMinutes * 60;
      remRef.current = t;
      setRemaining(t);
    }
  }, [totalMinutes]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!runRef.current) return;
      const r = remRef.current - 1;
      remRef.current = r;
      setRemaining(r);
      AsyncStorage.setItem('v3_sl_remaining', String(r));
      playSignal(r);
      if (r <= 0) {
        runRef.current = false;
        setRunning(false);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function startStop() {
    if (remRef.current <= 0) return;
    const next = !runRef.current;
    runRef.current = next;
    setRunning(next);
  }

  function reset() {
    const t = totalMinutes * 60;
    runRef.current = false;
    remRef.current = t;
    setRunning(false);
    setRemaining(t);
    AsyncStorage.removeItem('v3_sl_remaining');
  }

  function sync() {
    const r = remRef.current;
    const secs = r % 60;
    const next = Math.max(0, secs > 30 ? r + (60 - secs) : r - secs);
    remRef.current = next;
    setRemaining(next);
    AsyncStorage.setItem('v3_sl_remaining', String(next));
  }

  return { remaining, running, startStop, reset, sync, remRef };
}
