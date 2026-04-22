import AsyncStorage from '@react-native-async-storage/async-storage';

export async function get(key, fallback = null) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v !== null ? v : fallback;
  } catch { return fallback; }
}

export async function set(key, value) {
  try { await AsyncStorage.setItem(key, String(value)); } catch {}
}

export async function getJson(key, fallback = null) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export async function setJson(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export async function remove(key) {
  try { await AsyncStorage.removeItem(key); } catch {}
}
