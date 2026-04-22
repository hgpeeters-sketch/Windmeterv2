import { Audio } from 'expo-av';

let soundObjects = [];

export async function unlockAudio() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });
  } catch {}
}

export async function beep(freq, durationMs, volume = 0.8) {
  // expo-av doesn't support raw oscillators; we use a pre-generated PCM approach.
  // For simplicity we use a short silent sound as a placeholder.
  // Real implementation would use expo-audio or a native module.
  // The beep function is a best-effort tone via expo-av.
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  } catch {}
}

export function playSignal(remaining, beepVolume = 0) {
  // beepVolume in dB: -12, -6, 0, 6
  const amp = Math.min(1.5, 0.8 * Math.pow(10, beepVolume / 20));
  if (remaining === 0) {
    // Gun
  } else if (remaining <= 15) {
    // Tick
  } else if (remaining <= 60 && remaining % 10 === 0) {
    // Double beep
  } else if (remaining % 60 === 0) {
    // Minute beep
  }
}
