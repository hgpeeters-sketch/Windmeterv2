import { useState, useEffect, useRef } from 'react'
import { C, F, NUM_SHADOW } from '../theme'

function compassLabel(deg) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return pts[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function haversineDistance(p1, p2) {
  const toRad = d => d * Math.PI / 180
  const R = 6371000
  const dLat = toRad(p2.lat - p1.lat)
  const dLon = toRad(p2.lon - p1.lon)
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2) ** 2
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

const SL = ({ label, right }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 14px 3px', borderBottom: `1px solid ${C.sep}`,
    background: C.cardAlt,
    flexShrink: 0,
  }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, letterSpacing: '0.16em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
    {right && <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, color: C.cyan }}>{right}</span>}
  </div>
)

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
        ctx.fillStyle = C.textDim
        ctx.font = '800 11px "Barlow Condensed", monospace'
        ctx.textAlign = 'center'
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
        ctx.strokeStyle = C.sep; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - PAD_R, y); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = C.textDim; ctx.font = '700 9px "Barlow Condensed", monospace'; ctx.textAlign = 'right'
        ctx.fillText(lbl, W - 2, y + 3)
      }

      if (recent.length >= 2) {
        ctx.beginPath()
        dirs.forEach((v, i) => { const x = toX(i), y = toY(v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
        ctx.strokeStyle = 'rgba(0,221,192,0.6)'; ctx.lineWidth = 1.5
        ctx.lineJoin = 'round'; ctx.stroke()
      }

      dirs.forEach((v, i) => {
        const x = toX(i), y = toY(v)
        const isLast = i === dirs.length - 1
        ctx.beginPath()
        ctx.arc(x, y, isLast ? 4.5 : 2.5, 0, Math.PI * 2)
        ctx.fillStyle = isLast ? C.cyan : 'rgba(0,221,192,0.5)'
        ctx.fill()
        if (isLast) {
          ctx.font = '700 9px "Barlow Condensed", monospace'; ctx.textAlign = 'center'
          ctx.fillStyle = C.cyan
          ctx.fillText(`${recent[i].direction}°`, x, y - 8)
        }
      })
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container); draw()
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
  const [boatPos, setBoatPos]     = useState(null)
  const [gpsError, setGpsError]   = useState(null)
  const [committee, setCommittee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_committee')) } catch { return null }
  })
  const [pin, setPin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_pin')) } catch { return null }
  })

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return }
    const id = navigator.geolocation.watchPosition(
      pos => { setBoatPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGpsError(null) },
      err => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

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
  const lineLength = committee && pin ? haversineDistance(committee, pin) : null

  const draftText = `${draft}°`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: C.bg }}>

      {/* Hero TWD card */}
      <SL label="TRUE WIND DIRECTION" />
      <div style={{ background: C.card, padding: '14px 14px 18px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.22em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>
          TWD  ·  {compassLabel(draft)}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 175, fontFamily: F.bc, fontWeight: 800, color: C.text, lineHeight: 0.88, letterSpacing: '-0.02em', textShadow: NUM_SHADOW }}>
            {draft}
          </span>
          <span style={{ fontSize: 28, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginBottom: 14, marginLeft: 4 }}>°</span>
        </div>
        {lastLogged && (
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textSub }}>
            Last logged {Math.round((Date.now() - lastLogged.time) / 60000)}m ago · {lastLogged.direction}° · {samples.length} readings
          </div>
        )}
      </div>

      {/* Adjustment buttons */}
      <div style={{ padding: '10px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.sep}` }}>
          {[[-10,'−10'],[-1,'−1'],[1,'+1'],[10,'+10']].map(([delta, label], i) => (
            <button
              key={delta}
              onPointerDown={() => change(delta)}
              style={{
                flex: 1, height: 56, background: C.card,
                border: 'none', borderRight: i < 3 ? `1px solid ${C.sep}` : 'none',
                color: C.text, fontFamily: F.bc, fontWeight: 700, fontSize: 25,
                cursor: 'pointer', letterSpacing: '0.03em',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Log button */}
      <div style={{ padding: '0 12px 12px', flexShrink: 0 }}>
        <button
          onClick={() => logWindDir(draft)}
          style={{
            width: '100%', padding: '20px 0',
            background: C.cyanDim, border: `1px solid ${C.cyan}`, borderRadius: 6,
            color: C.cyan, fontFamily: F.bc, fontWeight: 700,
            fontSize: 30, letterSpacing: '0.18em', cursor: 'pointer',
          }}
        >LOG READING</button>
      </div>

      {/* Start line section */}
      <SL label="START LINE" right={lineLength ? `${lineLength}m` : undefined} />
      {['committee','pin'].map(end => (
        <div key={end} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: C.card,
          borderBottom: `1px solid ${C.sep}`, flexShrink: 0,
        }}>
          <span style={{ flex: 1, fontSize: 11, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.15em', color: C.textSub, textTransform: 'uppercase' }}>
            {end === 'committee' ? 'COMMITTEE' : 'PIN END'}
            {(end === 'committee' ? committee : pin) && (
              <span style={{ color: C.cyan, marginLeft: 8 }}>✓ SET</span>
            )}
          </span>
          <button
            onClick={() => ping(end)}
            disabled={!boatPos}
            style={{
              padding: '8px 16px', borderRadius: 4,
              background: (end === 'committee' ? committee : pin) ? C.cyanDim : 'transparent',
              border: `1px solid ${!boatPos ? C.sep : C.cyan}`,
              color: !boatPos ? C.textDim : C.cyan,
              fontFamily: F.bc, fontWeight: 700, fontSize: 11,
              letterSpacing: '0.12em', cursor: !boatPos ? 'default' : 'pointer',
            }}
          >PING</button>
          <button
            onClick={() => resetEnd(end)}
            disabled={!(end === 'committee' ? committee : pin)}
            style={{
              padding: '8px 14px', borderRadius: 4,
              background: 'transparent',
              border: `1px solid ${(end === 'committee' ? committee : pin) ? C.sep : 'transparent'}`,
              color: (end === 'committee' ? committee : pin) ? C.textSub : C.sep,
              fontFamily: F.bc, fontWeight: 700, fontSize: 11,
              letterSpacing: '0.1em', cursor: 'pointer',
            }}
          >RESET</button>
        </div>
      ))}

      {(gpsError || (!boatPos && !gpsError)) && (
        <div style={{ padding: '6px 14px', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontFamily: F.bc, fontWeight: 600, color: C.textDim }}>
            {gpsError ? `GPS: ${gpsError}` : 'Acquiring GPS…'}
          </span>
        </div>
      )}

      {/* Wind history chart */}
      <SL label="TWD HISTORY" right="LAST 35 MIN" />
      <div style={{ flex: 1, minHeight: 90, background: C.cardAlt }}>
        <WindHistoryChart samples={samples} />
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
