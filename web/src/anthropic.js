// Calls Anthropic API directly from the browser.
// API key is stored in localStorage (same pattern as iOS UserDefaults).

export function getApiKey() { return localStorage.getItem('anthropicKey') ?? '' }
export function setApiKey(k) { localStorage.setItem('anthropicKey', k) }

function circularMean(degrees) {
  const s = degrees.reduce((a, d) => a + Math.sin(d * Math.PI / 180), 0)
  const c = degrees.reduce((a, d) => a + Math.cos(d * Math.PI / 180), 0)
  const m = Math.atan2(s, c) * 180 / Math.PI
  return m < 0 ? m + 360 : m
}

export function computeStats(samples) {
  if (!samples.length) return null
  const n   = samples.length
  const t0  = samples[0].time, t1 = samples[n - 1].time
  const dur = (t1 - t0) / 60_000

  const dirs  = samples.map(s => s.direction)
  const spdsK = samples.map(s => s.speed * 1.94384)

  const avgTWD = circularMean(dirs)
  const osc = dirs.map(d => {
    let diff = d - avgTWD
    if (diff >  180) diff -= 360
    if (diff < -180) diff += 360
    return Math.abs(diff)
  }).reduce((a, b) => a + b, 0) / n

  const third = Math.max(1, Math.floor(n / 3))
  let trendDir = circularMean(dirs.slice(-third)) - circularMean(dirs.slice(0, third))
  if (trendDir >  180) trendDir -= 360
  if (trendDir < -180) trendDir += 360

  const firstSpd = spdsK.slice(0, third).reduce((a, b) => a + b, 0) / third
  const lastSpd  = spdsK.slice(-third).reduce((a, b) => a + b, 0) / third

  return {
    sampleCount: n,
    durationMin: dur,
    avgTWD: Math.round(avgTWD),
    minTWD: Math.min(...dirs),
    maxTWD: Math.max(...dirs),
    trendTWD: trendDir,
    oscAmplitude: osc,
    avgTWS: spdsK.reduce((a, b) => a + b, 0) / n,
    maxTWS: Math.max(...spdsK),
    minTWS: Math.min(...spdsK),
    trendTWS: lastSpd - firstSpd,
  }
}

export async function analyzeWind(samples) {
  const key = getApiKey()
  if (!key) throw new Error('No Anthropic API key set.')
  if (!samples.length) throw new Error('No wind data collected yet.')

  const s = computeStats(samples)
  const dirs = samples.filter((_, i) => i % 3 === 0).map(s => `${s.direction}°`).join(' ')

  const prompt = `You are a tactical AI assistant for a racing sailor. \
Analyze 15 min of wind data collected at the race area.

DATA:
- Samples: ${s.sampleCount} over ${s.durationMin.toFixed(0)} min
- TWD avg: ${s.avgTWD}°, range ${s.minTWD}°–${s.maxTWD}°
- TWD trend: ${s.trendTWD > 0 ? '+' : ''}${s.trendTWD.toFixed(1)}° (+ = shifted right)
- Oscillation amplitude: ±${s.oscAmplitude.toFixed(1)}°
- TWD sequence (30s): ${dirs}
- TWS avg: ${s.avgTWS.toFixed(1)} KTS, range ${s.minTWS.toFixed(1)}–${s.maxTWS.toFixed(1)} KTS
- TWS trend: ${s.trendTWS > 0 ? '+' : ''}${s.trendTWS.toFixed(1)} KTS (+ = building)

Give a concise tactical wind brief (max 130 words) for an upwind start. Cover:
1. Wind character (steady / oscillating / puffy — period and amplitude)
2. Shift trend (right / left / neutral) and what that means for tack choice
3. Speed trend (building / dropping / steady)
4. Concrete start recommendation (favoured tack, oscillation timing)
Use direct sailing language. No intro fluff.`

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
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
  return data.content?.[0]?.text ?? 'No response received.'
}
