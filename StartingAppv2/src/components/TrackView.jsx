import { useState, useEffect, useRef } from 'react'
import { getApiKey } from '../anthropic'

// ── Geo helpers ──────────────────────────────────────────────────────────────

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

// ── Track stats ───────────────────────────────────────────────────────────────

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
    stbdAvg: avg(stbdSpd),  portAvg: avg(portSpd),
    maxSpd:  pts.reduce((m,p) => (p.speed&&p.speed>m ? p.speed : m), 0),
  }
}

// ── GPX export ────────────────────────────────────────────────────────────────

function buildGPX(pts) {
  const lines = pts.map(p =>
    `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">
      <time>${new Date(p.time).toISOString()}</time>
      <course>${p.cog ?? 0}</course>
      <speed>${((p.speed ?? 0) / 1.94384).toFixed(2)}</speed>
    </trkpt>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="WindMeter v2" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Race ${new Date(pts[0].time).toISOString().slice(0,10)}</name>
    <trkseg>
${lines}
    </trkseg>
  </trk>
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

// ── AI analysis ───────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

// twd is passed as the raw manualTwd value (null when not set) so we can
// distinguish "no TWD logged" from "TWD = 0°" (a valid north wind reading)
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
  const [time, setTime]             = useState('')

  const recordingRef = useRef(false)
  const startRef     = useRef(null)
  const lastPtRef    = useRef(null)
  const twdRef       = useRef(twd)

  useEffect(() => { twdRef.current = twd }, [twd])

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0,8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  // Elapsed while recording
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [recording])

  // Auto-start at gun (remaining === 0 and no existing track)
  useEffect(() => {
    if (remaining === 0 && !recording && pts.length === 0) startRecording()
  }, [remaining])

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(pos => {
      const spd = pos.coords.speed !== null ? pos.coords.speed * 1.94384 : null
      setLiveSpd(spd)
      if (!recordingRef.current) return
      const now  = Date.now()
      const last = lastPtRef.current
      if (last && now - last.time < 4500) return   // ~5 s interval
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
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#000' }}>

      {/* Header */}
      <div style={{ flexShrink:0, height:36, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontSize:11, fontWeight:700, fontFamily:'monospace', letterSpacing:'0.25em', color: recording ? '#ff4444' : 'rgba(255,255,255,0.4)' }}>
          {recording ? '● REC' : 'TRACK'}
        </span>
        <span style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#fff' }}>{time}</span>
      </div>

      {/* Control row */}
      <div style={{ flexShrink:0, background:'#fff', padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
        {!recording
          ? <button onClick={startRecording} style={ctrlBtn('#000','#fff')}>● START RECORDING</button>
          : <button onClick={stopRecording}  style={ctrlBtn('#cc2222','#fff')}>■ STOP</button>
        }
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:24, fontFamily:'monospace', fontWeight:900, color:'#000', lineHeight:1 }}>
            {recording ? fmtDur(elapsed) : hasTrack ? fmtDur(stats?.dur??0) : '00:00'}
          </div>
          <div style={{ fontSize:9, fontFamily:'monospace', color:'rgba(0,0,0,0.4)', marginTop:2 }}>
            {recording
              ? `${pts.length} pts · ${liveSpd?.toFixed(1)??'—'} kts`
              : hasTrack ? `${pts.length} pts · ${stats?.distNm?.toFixed(2)??'—'} nm` : 'no recording'
            }
          </div>
        </div>
      </div>

      {/* Stats strip */}
      {(recording || hasTrack) && (
        <div style={{ flexShrink:0, display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'#000' }}>
          {recording ? <>
            <Stat label="SPEED"  v={liveSpd!==null ? `${liveSpd.toFixed(1)} kts` : '— kts'} />
            <Stat label="TACKS"  v={`${stats?.tacks??0}`} />
            <Stat label="TWD"    v={twd!=null ? `${twd}°` : 'LOG IN AREA'} />
          </> : <>
            <Stat label="DIST"   v={`${stats?.distNm?.toFixed(2)??'—'} nm`} />
            <Stat label="TACKS"  v={`${stats?.tacks??'—'}`} />
            <Stat label="MAX"    v={`${stats?.maxSpd?.toFixed(1)??'—'} kts`} />
          </>}
        </div>
      )}

      {/* Tack breakdown — only after recording */}
      {!recording && hasTrack && stats && (
        <div style={{ flexShrink:0, display:'flex', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'#000' }}>
          <Stat label="STBD"
            v={`${stats.stbdMin.toFixed(0)} min`}
            sub={stats.stbdAvg ? `${stats.stbdAvg.toFixed(1)} kts avg` : null} />
          <Stat label="PORT"
            v={`${stats.portMin.toFixed(0)} min`}
            sub={stats.portAvg ? `${stats.portAvg.toFixed(1)} kts avg` : null} />
        </div>
      )}

      {/* Action buttons */}
      {!recording && hasTrack && (
        <div style={{ flexShrink:0, display:'flex', gap:8, padding:'10px 14px', background:'#000', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => downloadGPX(pts)} style={actionBtn(false, false)}>EXPORT GPX</button>
          <button onClick={runAnalysis} disabled={analysing} style={actionBtn(true, analysing)}>
            {analysing ? 'ANALYSING…' : '✦ ANALYSE RACE'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!recording && !hasTrack && !analysis && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 28px' }}>
          <span style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,255,255,0.2)', letterSpacing:'0.08em', textAlign:'center', lineHeight:2 }}>
            RECORDING STARTS AUTOMATICALLY AT GUN{'\n'}OR TAP START TO RECORD MANUALLY
          </span>
        </div>
      )}

      {/* AI analysis */}
      {(analysis || aiError) && (
        <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'14px' }}>
          {aiError && (
            <div style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,100,100,0.85)', marginBottom:12 }}>
              {aiError}
            </div>
          )}
          {analysis && (
            <>
              <div style={{ fontSize:9, fontFamily:'monospace', letterSpacing:'0.2em', color:'rgba(255,255,255,0.3)', marginBottom:12 }}>
                AI RACE DEBRIEF
              </div>
              <div style={{ fontSize:13, fontFamily:'monospace', color:'rgba(255,255,255,0.88)', lineHeight:1.8, whiteSpace:'pre-wrap' }}>
                {analysis}
              </div>
              <div style={{ marginTop:16 }}>
                <button onClick={runAnalysis} disabled={analysing} style={actionBtn(true, analysing)}>
                  {analysing ? 'ANALYSING…' : '↺ RE-ANALYSE'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}

function Stat({ label, v, sub }) {
  return (
    <div style={{ flex:1, padding:'8px 0', textAlign:'center' }}>
      <div style={{ fontSize:8, fontFamily:'monospace', letterSpacing:'0.15em', color:'rgba(255,255,255,0.3)', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{v}</div>
      {sub && <div style={{ fontSize:9, fontFamily:'monospace', color:'rgba(255,255,255,0.35)', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function ctrlBtn(bg, color) {
  return {
    flex:1, padding:'14px 0',
    background: bg, border:'none', color,
    fontFamily:'monospace', fontWeight:700, fontSize:12,
    letterSpacing:'0.15em', cursor:'pointer',
  }
}

function actionBtn(primary, disabled) {
  return {
    flex: primary ? 2 : 1, padding:'12px 0',
    background: disabled ? 'rgba(255,255,255,0.08)' : primary ? '#fff' : 'transparent',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.3)',
    color: disabled ? 'rgba(255,255,255,0.4)' : primary ? '#000' : 'rgba(255,255,255,0.8)',
    fontFamily:'monospace', fontWeight:700, fontSize:11,
    letterSpacing:'0.1em', cursor: disabled ? 'default' : 'pointer',
  }
}
