import { useState, useEffect, useRef } from 'react'

function compassLabel(deg) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return pts[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function mpsToKnots(mps) { return mps * 1.94384 }

function fitFontSize(text, W, H, weight = '900') {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fs = Math.floor(H * 0.88)
  while (fs > 12) {
    ctx.font = `${weight} ${fs}px monospace`
    if (ctx.measureText(text).width <= W - 8) break
    fs -= 2
  }
  return fs
}

function DirChart({ hours }) {
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

      const dirs = [hours[0].dir]
      for (let i = 1; i < hours.length; i++) {
        let d = hours[i].dir - dirs[i - 1]
        while (d >  180) d -= 360
        while (d < -180) d += 360
        dirs.push(dirs[i - 1] + d)
      }

      const minV = Math.min(...dirs) - 5
      const maxV = Math.max(...dirs) + 5
      const range = maxV - minV || 1
      const toY = v => H - ((v - minV) / range) * (H - 16) - 8

      for (let base = -360; base <= 720; base += 90) {
        if (base < minV - 45 || base > maxV + 45) continue
        const y = toY(base)
        if (y < 0 || y > H) continue
        const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N', 450: 'E', 540: 'S', 630: 'W' }
        const lbl = cardinal[((base % 360) + 360) % 360] || ''
        ctx.setLineDash([2, 4])
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 20, y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'right'
        ctx.fillText(lbl, W - 2, y + 3)
      }

      ctx.beginPath()
      dirs.forEach((v, i) => {
        const x = (i / (dirs.length - 1)) * (W - 22)
        const y = toY(v)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2
      ctx.lineJoin = 'round'; ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '8px monospace'
      const step = Math.ceil(hours.length / 4)
      hours.forEach((h, i) => {
        if (i % step !== 0 && i !== hours.length - 1) return
        const x = (i / (dirs.length - 1)) * (W - 22)
        ctx.textAlign = i === 0 ? 'left' : i === hours.length - 1 ? 'right' : 'center'
        ctx.fillText(h.label, x, H - 1)
      })
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [hours])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

function BigNum({ value, label, sub }) {
  const containerRef = useRef(null)
  const [fs, setFs] = useState(60)
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setFs(fitFontSize(value, W - 12, H * 0.58))
    }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [value])
  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
      <div style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.18em', color: 'rgba(0,0,0,0.4)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: fs, fontWeight: 900, fontFamily: 'monospace', color: '#000', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function loadCached() {
  try {
    const raw = localStorage.getItem('v2_prestart_result')
    if (!raw) return null
    const data = JSON.parse(raw)
    // Keep results for up to 3 hours
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
  const [time, setTime]         = useState('')

  // Restore cached results on mount (survives tab switches)
  useEffect(() => {
    const cached = loadCached()
    if (!cached) return
    setLocation(cached.location)
    setCurrent(cached.hours[0] ?? null)
    setHours(cached.hours)
    setStatus('done')
  }, [])

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
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
        const idx  = startIdx + i
        const d    = new Date(t)
        const hh   = String(d.getHours()).padStart(2, '0')
        return { label: `${hh}:00`, dir: Math.round(dirs[idx]), spd: spds[idx], gust: gusts[idx] }
      }).filter(h => h.spd !== null && h.dir !== null)

      if (!slice.length) { setStatus('error'); setErrorMsg('No forecast data'); return }
      setCurrent(slice[0])
      setHours(slice)
      setStatus('done')
      // Persist results so they survive tab switches
      localStorage.setItem('v2_prestart_result', JSON.stringify({ location: loc, hours: slice, fetchedAt: Date.now() }))
    } catch {
      setStatus('error'); setErrorMsg('Network error')
    }
  }

  const dirText  = current ? `${String(current.dir).padStart(3,'0')}°` : '—°'
  const spdText  = current ? `${mpsToKnots(current.spd).toFixed(1)}` : '—'
  const gustText = current ? `${mpsToKnots(current.gust).toFixed(1)}` : '—'

  // Only show office hours (09:00–17:00); always include the current hour (NOW)
  const officeHours = hours.filter((h, i) => {
    if (i === 0) return true
    const hh = parseInt(h.label)
    return hh >= 9 && hh <= 17
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#000' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>PRE-START</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      {/* Search */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); localStorage.setItem('v2_prestart_city', e.target.value) }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="City or race area…"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontFamily: 'monospace', fontSize: 13, padding: '8px 10px', outline: 'none',
          }}
        />
        <button onClick={search} style={{
          padding: '8px 16px', background: status === 'loading' ? 'rgba(255,255,255,0.1)' : '#fff',
          border: 'none', color: '#000', fontFamily: 'monospace', fontWeight: 700,
          fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer', flexShrink: 0,
        }}>{status === 'loading' ? '…' : 'SEARCH'}</button>
      </div>

      {/* Location label */}
      {location && (
        <div style={{ flexShrink: 0, padding: '4px 14px' }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>{location.name}</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,100,100,0.8)' }}>{errorMsg}</span>
        </div>
      )}

      {/* Idle placeholder */}
      {status === 'idle' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textAlign: 'center', padding: '0 20px' }}>
            ENTER RACE AREA TO GET FORECAST
          </span>
        </div>
      )}

      {status === 'done' && current && (
        <>
          {/* Current conditions — white tile, capped so it doesn't dominate the screen */}
          <div style={{ flexShrink: 0, height: 'min(110px, 20%)', background: '#fff', display: 'flex', alignItems: 'stretch', borderBottom: '2px solid #000' }}>
            <BigNum value={dirText} label="DIRECTION" sub={current ? compassLabel(current.dir) : ''} />
            <div style={{ width: 1, background: 'rgba(0,0,0,0.12)' }} />
            <BigNum value={spdText} label="WIND KTS" />
            <div style={{ width: 1, background: 'rgba(0,0,0,0.12)' }} />
            <BigNum value={gustText} label="GUST KTS" />
          </div>

          {/* Direction trend chart — dark */}
          <div style={{ flexShrink: 0, height: 'min(85px, 14%)', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ padding: '3px 0 0 10px', fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)' }}>
              WIND DIRECTION — NEXT 12H
            </div>
            <div style={{ height: 'calc(100% - 16px)' }}>
              <DirChart hours={hours} />
            </div>
          </div>

          {/* Hourly list — 09:00–17:00 only */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {officeHours.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '9px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: i === 0 ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}>
                <span style={{ width: 44, fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {i === 0 ? 'NOW' : h.label}
                </span>
                <span style={{ width: 54, fontSize: 14, fontFamily: 'monospace', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>
                  {String(h.dir).padStart(3,'0')}°
                </span>
                <span style={{ width: 32, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>
                  {compassLabel(h.dir)}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: '#fff' }}>
                  {mpsToKnots(h.spd).toFixed(1)} kts
                </span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
                  G {mpsToKnots(h.gust).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
