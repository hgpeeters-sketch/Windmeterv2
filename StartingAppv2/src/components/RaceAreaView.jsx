import { useState, useEffect, useRef } from 'react'

function compassLabel(deg) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return pts[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function fitFontSize(text, W, H, weight = '900') {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fs = Math.floor(H * 0.88)
  while (fs > 16) {
    ctx.font = `${weight} ${fs}px monospace`
    if (ctx.measureText(text).width <= W - 8) break
    fs -= 2
  }
  return fs
}

function WindHistoryChart({ samples }) {
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    function draw() {
      const W = container.clientWidth, H = container.clientHeight
      if (!W || !H) return
      canvas.width  = W * 2; canvas.height = H * 2
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W * 2, H * 2); ctx.scale(2, 2)

      const cutoff = Date.now() - 35 * 60_000
      const recent = samples.filter(s => s.time >= cutoff)

      if (recent.length < 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.font = '11px monospace'; ctx.textAlign = 'center'
        ctx.fillText('LOG READINGS TO BUILD CHART', W / 2, H / 2)
        return
      }

      const dirs = [recent[0].direction]
      for (let i = 1; i < recent.length; i++) {
        let d = recent[i].direction - dirs[i - 1]
        while (d >  180) d -= 360
        while (d < -180) d += 360
        dirs.push(dirs[i - 1] + d)
      }

      const PAD_R = 22
      const minV  = Math.min(...dirs) - 8
      const maxV  = Math.max(...dirs) + 8
      const range = maxV - minV || 1
      const toY   = v => H - ((v - minV) / range) * (H - 16) - 8
      const toX   = i => recent.length === 1 ? W / 2 : (i / (recent.length - 1)) * (W - PAD_R)

      for (let base = -360; base <= 720; base += 90) {
        if (base < minV - 30 || base > maxV + 30) continue
        const y = toY(base)
        if (y < 4 || y > H - 4) continue
        const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N', 450: 'E', 540: 'S', 630: 'W' }
        const lbl = cardinal[((base % 360) + 360) % 360] || ''
        ctx.setLineDash([2, 4])
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - PAD_R, y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '9px monospace'; ctx.textAlign = 'right'
        ctx.fillText(lbl, W - 2, y + 3)
      }

      if (recent.length >= 2) {
        ctx.beginPath()
        dirs.forEach((v, i) => { const x = toX(i), y = toY(v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5
        ctx.lineJoin = 'round'; ctx.stroke()
      }

      dirs.forEach((v, i) => {
        const x = toX(i), y = toY(v)
        const isLast = i === dirs.length - 1
        ctx.beginPath()
        ctx.arc(x, y, isLast ? 4.5 : 3, 0, Math.PI * 2)
        ctx.fillStyle = isLast ? '#fff' : 'rgba(255,255,255,0.6)'
        ctx.fill()
        if (isLast) {
          ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.fillText(`${recent[i].direction}°`, x, y - 8)
        }
      })

      const t0 = recent[0].time, t1 = recent[recent.length - 1].time
      const fmt = ms => { const m = Math.round((ms - t0) / 60_000); return m === 0 ? 'now' : `${m}m` }
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px monospace'
      ctx.textAlign = 'left';  ctx.fillText(fmt(t0), 2, H - 2)
      if (recent.length > 1) { ctx.textAlign = 'right'; ctx.fillText(fmt(t1), W - PAD_R - 2, H - 2) }
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [samples])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

export default function RaceAreaView({ manualTwd, logWindDir, samples }) {
  const [draft, setDraft] = useState(() => manualTwd ?? 180)
  const containerRef = useRef(null)
  const [fs, setFs] = useState(80)
  const [time, setTime] = useState('')

  const [boatPos, setBoatPos]     = useState(null)
  const [gpsError, setGpsError]   = useState(null)
  const [committee, setCommittee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_committee')) } catch { return null }
  })
  const [pin, setPin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_pin')) } catch { return null }
  })

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return }
    const id = navigator.geolocation.watchPosition(
      pos => { setBoatPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGpsError(null) },
      err => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const draftText = `${String(draft).padStart(3, '0')}°`

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setFs(fitFontSize(draftText, W - 160, H * 0.75))
    }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [draftText])

  function change(delta) {
    setDraft(d => ((d + delta) % 360 + 360) % 360)
  }

  function ping(end) {
    if (!boatPos) return
    const pos = { ...boatPos }
    if (end === 'committee') {
      setCommittee(pos); localStorage.setItem('sl_committee', JSON.stringify(pos))
    } else {
      setPin(pos); localStorage.setItem('sl_pin', JSON.stringify(pos))
    }
  }

  function resetEnd(end) {
    if (end === 'committee') {
      setCommittee(null); localStorage.removeItem('sl_committee')
    } else {
      setPin(null); localStorage.removeItem('sl_pin')
    }
  }

  const lastLogged = samples.length ? samples[samples.length - 1] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      <div style={{ flexShrink: 0, height: 36, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>RACE AREA</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      <div ref={containerRef} style={{ flex: 2, minHeight: 0, background: '#fff', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.4)' }}>
          WIND DIRECTION (TWD)
        </span>
        <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 11, fontFamily: 'monospace', color: 'rgba(0,0,0,0.35)' }}>
          {compassLabel(draft)}
        </span>

        <button onPointerDown={() => change(-10)} style={adjBtn()}>−10</button>
        <button onPointerDown={() => change(-1)}  style={adjBtn()}>−1</button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span style={{ fontSize: fs, fontWeight: 900, fontFamily: 'monospace', color: '#000', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {draftText}
          </span>
        </div>

        <button onPointerDown={() => change(+1)}  style={adjBtn()}>+1</button>
        <button onPointerDown={() => change(+10)} style={adjBtn()}>+10</button>
      </div>

      <div style={{ flexShrink: 0, background: '#000', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={() => logWindDir(draft)}
          style={{
            flex: 1, padding: '14px 0',
            background: '#fff', border: 'none', color: '#000',
            fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
            letterSpacing: '0.18em', cursor: 'pointer',
          }}
        >LOG READING</button>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>LAST LOGGED</div>
          <div style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: lastLogged ? '#fff' : 'rgba(255,255,255,0.2)' }}>
            {lastLogged ? `${String(lastLogged.direction).padStart(3,'0')}°` : '—°'}
          </div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
            {samples.length > 0 ? `${samples.length} readings` : ''}
          </div>
        </div>
      </div>

      {/* Start line ping section */}
      <div style={{ flexShrink: 0, background: '#000', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <LineEndRow
          label="COMMITTEE"
          pinged={!!committee}
          noGps={!boatPos}
          onPing={() => ping('committee')}
          onReset={() => resetEnd('committee')}
        />
        <LineEndRow
          label="PIN END"
          pinged={!!pin}
          noGps={!boatPos}
          onPing={() => ping('pin')}
          onReset={() => resetEnd('pin')}
        />
        {(gpsError || (!boatPos && !gpsError)) && (
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>
            {gpsError ? `GPS: ${gpsError}` : 'Acquiring GPS…'}
          </span>
        )}
      </div>

      <div style={{ flex: 3, minHeight: 0, background: '#000', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, padding: '4px 0 0 10px', fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)' }}>
          TWD HISTORY  (last 35 min)
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WindHistoryChart samples={samples} />
        </div>
      </div>

    </div>
  )
}

function LineEndRow({ label, pinged, noGps, onPing, onReset }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', width: 68, flexShrink: 0 }}>
        {label}
        {pinged && <span style={{ color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>✓</span>}
      </span>
      <button
        onClick={onPing}
        disabled={noGps}
        style={{
          flex: 1, padding: '7px 0',
          background: pinged ? 'rgba(255,255,255,0.12)' : 'transparent',
          border: `1px solid rgba(255,255,255,${noGps ? 0.1 : pinged ? 0.45 : 0.22})`,
          color: `rgba(255,255,255,${noGps ? 0.18 : pinged ? 0.85 : 0.55})`,
          fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', cursor: noGps ? 'default' : 'pointer',
        }}
      >PING</button>
      <button
        onClick={onReset}
        disabled={!pinged}
        style={{
          padding: '7px 14px', flexShrink: 0,
          background: 'transparent',
          border: `1px solid rgba(255,255,255,${!pinged ? 0.08 : 0.22})`,
          color: `rgba(255,255,255,${!pinged ? 0.15 : 0.42})`,
          fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', cursor: !pinged ? 'default' : 'pointer',
        }}
      >RESET</button>
    </div>
  )
}

function adjBtn() {
  return {
    height: '100%', width: 38, flexShrink: 0,
    background: 'transparent', border: 'none',
    borderRight: '1px solid rgba(0,0,0,0.15)',
    borderLeft: '1px solid rgba(0,0,0,0.15)',
    fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
    color: 'rgba(0,0,0,0.55)', cursor: 'pointer',
  }
}
