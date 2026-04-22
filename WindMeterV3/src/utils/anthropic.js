import { get } from './storage';
import { circularMean } from './geo';

export async function getApiKey() {
  return (await get('anthropicKey')) ?? '';
}

export async function setApiKey(k) {
  const { set } = await import('./storage');
  await set('anthropicKey', k);
}

export async function analyzeRace(pts, windSamples, twd) {
  const key = await getApiKey();
  if (!key) throw new Error('No Anthropic API key set.');
  if (!pts.length) throw new Error('No track data recorded.');

  const dur = pts.length > 1
    ? ((pts[pts.length - 1].time - pts[0].time) / 60000).toFixed(0)
    : '0';

  const haversineNm = (a, b) => {
    const R = 3440.065;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const lat1 = a.latitude * Math.PI / 180;
    const lat2 = b.latitude * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(x));
  };

  let tacks = 0, distNm = 0;
  let prevCog = null;
  for (let i = 1; i < pts.length; i++) {
    distNm += haversineNm(pts[i - 1], pts[i]);
    if (pts[i].speed > 0.5 && prevCog !== null) {
      const diff = Math.abs(((pts[i].cog - prevCog) + 180) % 360 - 180);
      if (diff > 60) tacks++;
    }
    prevCog = pts[i].cog;
  }

  const speeds = pts.filter(p => p.speed > 0.2).map(p => p.speed * 1.94384);
  const avgSpd = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : '?';
  const maxSpd = speeds.length ? Math.max(...speeds).toFixed(1) : '?';

  let windLine = twd != null ? `TWD: ${twd}°` : 'TWD: unknown (not set)';
  if (windSamples.length) {
    const dirs = windSamples.map(s => s.direction);
    const avg = circularMean(dirs);
    windLine += ` | Wind samples: ${windSamples.length}, avg ${Math.round(avg)}°`;
  }

  const downsampled = pts.filter((_, i) => i % 3 === 0).slice(0, 100);
  const trackStr = downsampled.map(p =>
    `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)},${(p.speed * 1.94384).toFixed(1)}kts`
  ).join(' ');

  const prompt = `You are a tactical AI coach for a racing sailor. Analyze this race track.

DATA:
- Duration: ${dur} min
- Distance: ${distNm.toFixed(2)} nm
- Tacks: ${tacks}
- Avg speed: ${avgSpd} kts, Max: ${maxSpd} kts
- ${windLine}
- Track (lat,lon,speed every ~15s): ${trackStr}

Give a concise tactical debrief (max 180 words). Cover:
1. Overall boat speed assessment
2. Tack frequency and timing
3. Which side of the course appeared favoured (if TWD known)
4. One key improvement for next race
Use direct sailing language. No intro fluff.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  return data.content?.[0]?.text ?? 'No response received.';
}

export async function analyzeWind(samples) {
  const key = await getApiKey();
  if (!key) throw new Error('No Anthropic API key set.');
  if (!samples.length) throw new Error('No wind data collected yet.');

  const n = samples.length;
  const dirs = samples.map(s => s.direction);
  const avgTWD = circularMean(dirs);
  const minTWD = Math.min(...dirs);
  const maxTWD = Math.max(...dirs);

  const third = Math.max(1, Math.floor(n / 3));
  let trend = circularMean(dirs.slice(-third)) - circularMean(dirs.slice(0, third));
  if (trend > 180) trend -= 360;
  if (trend < -180) trend += 360;

  const osc = dirs.map(d => {
    let diff = d - avgTWD;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff);
  }).reduce((a, b) => a + b, 0) / n;

  const prompt = `You are a tactical AI assistant for a racing sailor.
DATA:
- Samples: ${n}
- TWD avg: ${Math.round(avgTWD)}°, range ${minTWD}°–${maxTWD}°
- TWD trend: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}°
- Oscillation: ±${osc.toFixed(1)}°
- Sequence: ${dirs.filter((_, i) => i % 3 === 0).map(d => `${d}°`).join(' ')}

Give a concise tactical wind brief (max 100 words). Cover: wind character, shift trend, start tack recommendation. No intro fluff.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  return data.content?.[0]?.text ?? 'No response received.';
}
