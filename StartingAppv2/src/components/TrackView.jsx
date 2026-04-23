import { useState, useEffect, useRef } from 'react'
import { getApiKey } from '../anthropic'
import { C, F, NUM_SHADOW } from '../theme'

function haversineM(p1, p2) {
  const toRad = d => d * Math.PI / 180
  const R = 6371000
  const dLat = toRad(p2.lat - p1.lat)
  const dLon = toRad(p2.lon - p1.lon)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2)**2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${String(m % 60).padStart(2,'0')}m`
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}

function computeStats(pts, twd) {
  if (pts.length < 2) return null
  const dur = pts[pts.length-1].time - pts[0].time
  let distM = 0
  for (let i = 1; i < pts.length; i++) distM += haversineM(pts[i-1], pts[i])

  let tacks = 0, prevTack = null
  let stbdMs = 0, portMs = 0
  const stbdSpd = [], portSpd = []

  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], dt = p.time - pts[i-1].time
    if (p.cog !== null && twd !== null) {
      const twa  = ((p.cog - twd) + 360) % 360
      const tack = twa < 180 ? 'stbd' : 'port'
      if (prevTack && tack !== prevTack) tacks++
      prevTack = tack
      if (tack === 'stbd') { stbdMs += dt; if (p.speed) stbdSpd.push(p.speed) }
      else                  { portMs  += dt; if (p.speed) portSpd.push(p.speed) }
    }
  }
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null
  return {
    dur, distNm: distM / 1852, tacks,
    stbdMin: stbdMs / 60000, portMin: portMs / 60000,
    stbdAvg: avg(stbdSpd),   portAvg: avg(portSpd),
    maxSpd:  pts.reduce((m,p) => (p.speed&&p.speed>m ? p.speed : m), 0),
  }
}

function buildGPX(pts) {
  const lines = pts.map(p =>
    `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">
      <time>${new Date(p.time).toISOString()}</time>
      <course>${p.cog ?? 0}</course>
      <speed>${((p.speed ?? 0) / 1.94384).toFixed(2)}</speed>
    </trkpt>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="WindMeter v3">
  <trk><name>Race ${new Date(pts[0].time).toISOString().slice(0,10)}</name><trkseg>
${lines}
  </trkseg></trk>
</gpx>`
}

function downloadGPX(pts) {
  if (!pts.length) return
  const blob = new Blob([buildGPX(pts)], { type: 'application/gpx+xml' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `race_${new Date(pts[0].time).toISOString().slice(0,16).replace(/[T:]/g,'_')}.gpx`,
  })
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

async function analyzeRace(pts, windSamples, twd) {
  const key = getApiKey()
  if (!key)          throw new Error('No API key — set it in Settings.')
  if (pts.length<10) throw new Error('Not enough track data (need ≥ 10 points).')

  const s    = computeStats(pts, twd)
  const step = Math.max(1, Math.floor(pts.length / 60))

  const trackLines = pts
    .filter((_,i) => i % step === 0)
    .map(p => {
      const min  = ((p.time - pts[0].time) / 60000).toFixed(1)
      const twa  = (twd !== null && p.cog !== null)
        ? Math.round(((p.cog - twd) + 360) % 360) : '?'
      const side = typeof twa === 'number' ? (twa < 180 ? 'SB' : 'PT') : '?'
      const spd  = p.speed ? p.speed.toFixed(1) : '?'
      return `+${min}m  COG:${p.cog??'?'}°  TWA:${twa}°(${side})  ${spd}kts`
    }).join('\n')

  const raceWind = windSamples
    .filter(s => s.time >= pts[0].time && s.time <= pts[pts.length-1].time)
    .map(s => `${s.direction}°`).join(' ')

  const prompt = `You are a sailing tactician. Give a concise post-race debrief based on the GPS track below.

RACE STATS:
- Duration: ${fmtDur(s?.dur??0)}
- Distance: ${s?.distNm?.toFixed(2)??'?'} nm, tacks/gybes: ${s?.tacks??'?'}
- Starboard: ${s?.stbdMin?.toFixed(0)??'?'} min, avg ${s?.stbdAvg?.toFixed(1)??'?'} kts
- Port:      ${s?.portMin?.toFixed(0)??'?'} min, avg ${s?.portAvg?.toFixed(1)??'?'} kts
- Max speed: ${s?.maxSpd?.toFixed(1)??'?'} kts
- TWD (avg logged): ${twd??'?'}°

WIND READINGS DURING RACE: ${raceWind || '(none logged)'}

TRACK LOG (time from gun, COG, TWA, tack, speed):
${trackLines}

Respond in max 220 words. Cover:
1. Which side of the course was more favourable and why (shifts / pressure)
2. Best vs worst upwind angles — what it cost in VMG
3. Speed patterns (any lifted/headed correlation, tacking angles)
4. One sharp takeaway for the next race

Direct sailing language. No intro fluff.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 650,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
  return data.content?.[0]?.text ?? 'No response received.'
}

const SL = ({ label, right }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 14px 3px', borderBottom: `1px solid ${C.sep}`,
    background: C.cardAlt, flexShrink: 0,
  }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, letterSpacing: '0.16em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
    {right && <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, color: right.startsWith('●') ? C.neg : C.cyan }}>{right}</span>}
  </div>
)

export default function TrackView({ remaining, twd, samples }) {
  const [recording, setRecording]   = useState(false)
  const [pts, setPts]               = useState(() => {
    try { return JSON.parse(localStorage.getItem('v2_trackPts') ?? '[]') } catch { return [] }
  })
  const [elapsed, setElapsed]       = useState(0)
  const [liveSpd, setLiveSpd]       = useState(null)
  const [analysis, setAnalysis]     = useState(() => localStorage.getItem('v2_trackAnalysis') ?? '')
  const [analysing, setAnalysing]   = useState(false)
  const [aiError, setAiError]       = useState('')

  const recordingRef = useRef(false)
  const startRef     = useRef(null)
  const lastPtRef    = useRef(null)
  const twdRef       = useRef(twd)

  useEffect(() => { twdRef.current = twd }, [twd])

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [recording])

  useEffect(() => {
    if (remaining === 0 && !recording && pts.length === 0) startRecording()
  }, [remaining])

  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(pos => {
      const spd = pos.coords.speed !== null ? pos.coords.speed * 1.94384 : null
      setLiveSpd(spd)
      if (!recordingRef.current) return
      const now  = Date.now()
      const last = lastPtRef.current
      if (last && now - last.time < 4500) return
      const pt = {
        time: now,
        lat:  pos.coords.latitude,
        lon:  pos.coords.longitude,
        cog:  pos.coords.heading !== null && !isNaN(pos.coords.heading)
                ? Math.round(pos.coords.heading) : null,
        speed: spd,
        twd:  twdRef.current ?? null,
      }
      lastPtRef.current = pt
      setPts(prev => {
        const next = [...prev, pt]
        localStorage.setItem('v2_trackPts', JSON.stringify(next))
        return next
      })
    }, () => {}, { enableHighAccuracy: true, maximumAge: 1000 })
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  function startRecording() {
    setPts([]); localStorage.removeItem('v2_trackPts')
    setAnalysis(''); localStorage.removeItem('v2_trackAnalysis')
    setAiError(''); lastPtRef.current = null
    startRef.current = Date.now()
    recordingRef.current = true
    setRecording(true); setElapsed(0)
  }

  function stopRecording() {
    recordingRef.current = false; setRecording(false)
  }

  async function runAnalysis() {
    setAnalysing(true); setAiError('')
    try {
      const result = await analyzeRace(pts, samples, twd)
      setAnalysis(result)
      localStorage.setItem('v2_trackAnalysis', result)
    } catch (e) { setAiError(e.message) }
    finally     { setAnalysing(false) }
  }

  const stats    = computeStats(pts, twd)
  const hasTrack = pts.length >= 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: C.bg }}>

      <SL label="TRACK RECORDER" right={recording ? `● ${fmtDur(elapsed)}` : hasTrack ? fmtDur(stats?.dur ?? 0) : undefined} />

      {/* Record control */}
      <div style={{ background: C.card, padding: '14px', borderBottom: `1px solid ${C.sep}`, flexShrink: 0 }}>
        {!recording ? (
          <>
            {!hasTrack && (
              <div style={{ marginBottom: 10, fontSize: 12, fontFamily: F.bc, fontWeight: 600, color: C.textSub, lineHeight: 1.6 }}>
                {remaining === 0
                  ? 'Timer complete — recording started automatically.'
                  : 'Recording starts automatically at gun, or tap below.'}
              </div>
            )}
            <button onClick={startRecording} style={{
              width: '100%', padding: '15px 0',
              background: C.cyanDim, border: `1px solid ${C.cyan}`, borderRadius: 6,
              color: C.cyan, fontFamily: F.bc, fontWeight: 700,
              fontSize: 14, letterSpacing: '0.18em', cursor: 'pointer',
            }}>▶ START RECORDING</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.neg }} />
              <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 13, color: C.neg, letterSpacing: '0.1em' }}>
                RECORDING · {pts.length} pts · {liveSpd?.toFixed(1) ?? '—'} kts
              </span>
            </div>
            <button onClick={stopRecording} style={{
              width: '100%', padding: '15px 0',
              background: 'rgba(245,166,35,0.15)', border: `1px solid ${C.neg}`, borderRadius: 6,
              color: C.neg, fontFamily: F.bc, fontWeight: 700,
              fontSize: 14, letterSpacing: '0.18em', cursor: 'pointer',
            }}>■ STOP RECORDING</button>
          </>
        )}
      </div>

      {/* Stats strip */}
      {(recording || hasTrack) && (
        <div style={{ display: 'flex', background: C.cardAlt, borderBottom: `1px solid ${C.sep}`, flexShrink: 0 }}>
          {recording ? (
            <>
              <StatCell label="SPEED"  v={liveSpd !== null ? liveSpd.toFixed(1) : '—'} unit="kts" />
              <StatCell label="TACKS"  v={`${stats?.tacks ?? 0}`} />
              <StatCell label="TWD"    v={twd != null ? `${twd}` : '—'} unit={twd != null ? '°' : undefined} />
            </>
          ) : (
            <>
              <StatCell label="DIST"   v={stats?.distNm?.toFixed(2) ?? '—'} unit="nm" />
              <StatCell label="TACKS"  v={`${stats?.tacks ?? '—'}`} />
              <StatCell label="MAX"    v={stats?.maxSpd?.toFixed(1) ?? '—'} unit="kts" />
            </>
          )}
        </div>
      )}

      {/* Tack breakdown */}
      {!recording && hasTrack && stats && (
        <div style={{ display: 'flex', background: C.card, borderBottom: `1px solid ${C.sep}`, flexShrink: 0 }}>
          <StatCell label="STBD" v={stats.stbdMin.toFixed(0)} unit="min"
            sub={stats.stbdAvg ? `${stats.stbdAvg.toFixed(1)} kts avg` : undefined} />
          <StatCell label="PORT" v={stats.portMin.toFixed(0)} unit="min"
            sub={stats.portAvg ? `${stats.portAvg.toFixed(1)} kts avg` : undefined} />
        </div>
      )}

      {/* Action buttons */}
      {!recording && hasTrack && (
        <div style={{ display: 'flex', gap: 10, padding: '12px', flexShrink: 0 }}>
          <button onClick={() => downloadGPX(pts)} style={{
            flex: 1, padding: '13px 0',
            background: 'transparent', border: `1px solid ${C.sep}`, borderRadius: 6,
            color: C.textSub, fontFamily: F.bc, fontWeight: 700,
            fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
          }}>EXPORT GPX</button>
          <button onClick={runAnalysis} disabled={analysing} style={{
            flex: 2, padding: '13px 0',
            background: analysing ? C.cyanDim : C.cyanDim,
            border: `1px solid ${analysing ? C.sep : C.cyan}`, borderRadius: 6,
            color: analysing ? C.textDim : C.cyan,
            fontFamily: F.bc, fontWeight: 700,
            fontSize: 11, letterSpacing: '0.12em', cursor: analysing ? 'default' : 'pointer',
          }}>{analysing ? 'ANALYSING…' : '✦ AI RACE DEBRIEF'}</button>
        </div>
      )}

      {/* Empty state */}
      {!recording && !hasTrack && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <span style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.1em', textAlign: 'center', lineHeight: 2.2 }}>
            RECORDING STARTS AT GUN{'\n'}OR TAP START ABOVE
          </span>
        </div>
      )}

      {/* AI error */}
      {aiError && (
        <div style={{ padding: '12px 14px' }}>
          <span style={{ fontSize: 12, fontFamily: F.bc, fontWeight: 600, color: C.neg }}>{aiError}</span>
        </div>
      )}

      {/* AI analysis */}
      {analysis && (
        <div style={{ background: C.card, margin: 0, flexShrink: 0 }}>
          <div style={{ padding: '5px 14px 3px', borderBottom: `1px solid ${C.sep}`,
    background: C.cardAlt, borderTop: `1px solid ${C.sep}` }}>
            <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, letterSpacing: '0.28em', color: C.textDim }}>AI RACE DEBRIEF</span>
          </div>
          <div style={{ padding: '14px', fontSize: 13, fontFamily: F.b, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {analysis}
          </div>
          <div style={{ padding: '0 14px 14px' }}>
            <button onClick={runAnalysis} disabled={analysing} style={{
              width: '100%', padding: '11px 0',
              background: 'transparent', border: `1px solid ${C.sep}`, borderRadius: 6,
              color: C.textSub, fontFamily: F.bc, fontWeight: 700,
              fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
            }}>{analysing ? 'ANALYSING…' : '↺ RE-ANALYSE'}</button>
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}

function StatCell({ label, v, unit, sub }) {
  return (
    <div style={{ flex: 1, padding: '10px', textAlign: 'center', borderRight: `1px solid ${C.sep}` }}>
      <div style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.2em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <span style={{ fontSize: 28, fontFamily: F.bc, fontWeight: 800, color: C.text, lineHeight: 1 }}>{v}</span>
        {unit && <span style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginBottom: 3, marginLeft: 2 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, fontFamily: F.bc, fontWeight: 600, color: C.textSub, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}
