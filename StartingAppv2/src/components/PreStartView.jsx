import { useState, useEffect, useRef } from 'react'
import { C, F, NUM_SHADOW } from '../theme'

function compassLabel(deg) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return pts[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function mpsToKnots(mps) { return mps * 1.94384 }

const SL = ({ label, right }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 14px', borderBottom: `1px solid ${C.sep}`,
  }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, letterSpacing: '0.28em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
    {right && <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, letterSpacing: '0.18em', color: C.textDim }}>{right}</span>}
  </div>
)

function ShiftChart({ hours }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || hours.length < 2) return

    function draw() {
      const W = container.clientWidth, H = container.clientHeight
      if (!W || !H) return
      canvas.width = W * 2; canvas.height = H * 2
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W * 2, H * 2); ctx.scale(2, 2)

      const dirs = hours.map(h => h.dir)
      const mean = dirs.reduce((a, b) => a + b, 0) / dirs.length
      const shifts = dirs.map(d => {
        let diff = d - mean
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        return diff
      })

      const maxAbs = Math.max(10, ...shifts.map(Math.abs))
      const midY = H / 2
      const barW = Math.max(3, (W - 2) / dirs.length)

      // Midline
      ctx.strokeStyle = '#18263a'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()

      shifts.forEach((v, i) => {
        const barH = Math.max(2, Math.abs(v) / maxAbs * (midY - 4))
        const x = i * barW
        const y = v >= 0 ? midY - barH : midY
        ctx.fillStyle = v >= 0 ? '#00ddc0' : '#f5a623'
        ctx.globalAlpha = 0.85
        ctx.fillRect(x, y, barW - 1, barH)
        ctx.globalAlpha = 1
      })
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container); draw()
    return () => ro.disconnect()
  }, [hours])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: C.cardAlt }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

function loadCached() {
  try {
    const raw = localStorage.getItem('v2_prestart_result')
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.fetchedAt > 3 * 60 * 60 * 1000) return null
    return data
  } catch { return null }
}

export default function PreStartView() {
  const [query, setQuery]       = useState(() => localStorage.getItem('v2_prestart_city') || '')
  const [status, setStatus]     = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [location, setLocation] = useState(null)
  const [current, setCurrent]   = useState(null)
  const [hours, setHours]       = useState([])

  useEffect(() => {
    const cached = loadCached()
    if (!cached) return
    setLocation(cached.location)
    setCurrent(cached.hours[0] ?? null)
    setHours(cached.hours)
    setStatus('done')
  }, [])

  async function search() {
    const q = query.trim()
    if (!q) return
    localStorage.setItem('v2_prestart_city', q)
    setStatus('loading'); setErrorMsg('')
    try {
      const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`)
      const geoData = await geoRes.json()
      if (!geoData.results?.length) { setStatus('error'); setErrorMsg('Location not found'); return }

      const { name, latitude, longitude, country, admin1 } = geoData.results[0]
      const loc = { name: [name, admin1, country].filter(Boolean).join(', '), lat: latitude, lon: longitude }
      setLocation(loc)

      const fxRes  = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto&forecast_days=2`
      )
      const fxData = await fxRes.json()
      const { time: times, wind_speed_10m: spds, wind_direction_10m: dirs, wind_gusts_10m: gusts } = fxData.hourly

      const nowStr   = new Date().toISOString().slice(0, 13)
      const startIdx = times.findIndex(t => t.slice(0, 13) >= nowStr)
      const slice    = times.slice(startIdx, startIdx + 13).map((t, i) => {
        const idx = startIdx + i
        const d   = new Date(t)
        const hh  = String(d.getHours()).padStart(2, '0')
        return { label: `${hh}:00`, dir: Math.round(dirs[idx]), spd: spds[idx], gust: gusts[idx] }
      }).filter(h => h.spd !== null && h.dir !== null)

      if (!slice.length) { setStatus('error'); setErrorMsg('No forecast data'); return }
      setCurrent(slice[0])
      setHours(slice)
      setStatus('done')
      localStorage.setItem('v2_prestart_result', JSON.stringify({ location: loc, hours: slice, fetchedAt: Date.now() }))
    } catch {
      setStatus('error'); setErrorMsg('Network error')
    }
  }

  // Office hours 09-17 + always show NOW (index 0)
  const officeHours = hours.filter((h, i) => {
    if (i === 0) return true
    const hh = parseInt(h.label)
    return hh >= 9 && hh <= 17
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: C.bg }}>

      {/* Search row */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', flexShrink: 0 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); localStorage.setItem('v2_prestart_city', e.target.value) }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Race area city…"
          style={{
            flex: 1, background: C.card, border: `1px solid ${C.sep}`,
            color: C.text, fontFamily: F.bc, fontSize: 14, fontWeight: 500,
            padding: '10px 12px', outline: 'none', borderRadius: 4,
          }}
        />
        <button onClick={search} disabled={status === 'loading'} style={{
          padding: '10px 18px', background: status === 'loading' ? C.cyanDim : C.cyan,
          border: 'none', color: C.bg, fontFamily: F.bc, fontWeight: 700,
          fontSize: 12, letterSpacing: '0.15em', cursor: 'pointer', flexShrink: 0, borderRadius: 4,
        }}>{status === 'loading' ? '…' : 'SEARCH'}</button>
      </div>

      {/* Location label */}
      {location && (
        <div style={{ padding: '2px 14px 6px', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontFamily: F.bc, fontWeight: 600, color: C.textSub, letterSpacing: '0.08em' }}>{location.name}</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '8px 14px' }}>
          <span style={{ fontSize: 12, fontFamily: F.bc, color: C.neg }}>{errorMsg}</span>
        </div>
      )}

      {/* Idle placeholder */}
      {status === 'idle' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <span style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.15em', textAlign: 'center', padding: '0 20px' }}>
            ENTER RACE AREA TO GET FORECAST
          </span>
        </div>
      )}

      {status === 'done' && current && (
        <>
          <SL label="CURRENT CONDITIONS" />

          {/* 3-col big numbers */}
          <div style={{ display: 'flex', background: C.card, flexShrink: 0 }}>
            {[
              { label: 'DIR', val: `${current.dir}`, unit: '°', sub: compassLabel(current.dir) },
              { label: 'WIND', val: `${mpsToKnots(current.spd).toFixed(1)}`, unit: 'kts' },
              { label: 'GUST', val: `${mpsToKnots(current.gust).toFixed(1)}`, unit: 'kts' },
            ].map(({ label, val, unit, sub }, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '12px 10px',
                textAlign: 'center',
                borderLeft: i > 0 ? `1px solid ${C.sep}` : 'none',
              }}>
                <div style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.22em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <span style={{ fontSize: 54, fontFamily: F.bc, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.02em', textShadow: NUM_SHADOW }}>
                    {val}
                  </span>
                  <span style={{ fontSize: 14, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginBottom: 6, marginLeft: 3 }}>{unit}</span>
                </div>
                {sub && <div style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textSub, marginTop: 4 }}>{sub}</div>}
              </div>
            ))}
          </div>

          <SL label="SHIFT NEXT 12H" right="← LEFT / RIGHT →" />
          <div style={{ height: 72, flexShrink: 0 }}>
            <ShiftChart hours={hours.slice(0, 12)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 14px', flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 600, color: C.textDim }}>NOW</span>
            <span style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 600, color: C.textDim }}>+12h</span>
          </div>

          <SL label="HOURLY FORECAST (09–17)" />
          {officeHours.map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '9px 14px',
              background: i % 2 === 0 ? C.card : C.cardAlt,
              borderBottom: `1px solid ${C.sep}`,
            }}>
              <span style={{ width: 40, fontSize: 12, fontFamily: F.bc, fontWeight: 700, color: i === 0 ? C.cyan : C.textSub, letterSpacing: '0.05em' }}>
                {i === 0 ? 'NOW' : h.label}
              </span>
              <span style={{ width: 52, fontSize: 20, fontFamily: F.bc, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
                {h.dir}°
              </span>
              <span style={{ width: 34, fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textSub }}>
                {compassLabel(h.dir)}
              </span>
              <span style={{ flex: 1, fontSize: 18, fontFamily: F.bc, fontWeight: 800, color: C.text }}>
                {mpsToKnots(h.spd).toFixed(1)}
              </span>
              <span style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.cyan, marginRight: 10 }}>kts</span>
              <span style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.neg }}>
                G{mpsToKnots(h.gust).toFixed(1)}
              </span>
            </div>
          ))}
          <div style={{ height: 16 }} />
        </>
      )}
    </div>
  )
}
