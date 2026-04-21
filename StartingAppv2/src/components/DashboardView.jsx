import { useState, useEffect, useRef } from 'react'

const BG  = i => i % 2 === 0 ? '#000' : '#fff'
const FG  = i => i % 2 === 0 ? '#fff' : '#000'
const RGB = i => i % 2 === 0 ? '255,255,255' : '0,0,0'

function fitFontSize(text, W, H, weight = '900') {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fs = Math.floor(H * 0.88)
  while (fs > 20) {
    ctx.font = `${weight} ${fs}px monospace`
    if (ctx.measureText(text).width <= W - 8) break
    fs -= 2
  }
  return fs
}

function CogChart({ history }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function draw() {
      const W = container.clientWidth, H = container.clientHeight
      if (!W || !H || history.length < 2) return
      canvas.width = W * 2; canvas.height = H * 2
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W * 2, H * 2); ctx.scale(2, 2)

      const values = history.map(h => h.cog)
      const minV = Math.min(...values) - 2
      const maxV = Math.max(...values) + 2
      const range = maxV - minV || 1
      const toY = v => H - ((v - minV) / range) * (H - 8) - 4

      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const meanY = toY(mean)
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, meanY); ctx.lineTo(W, meanY); ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '8px monospace'; ctx.textAlign = 'right'
      ctx.fillText(`${mean.toFixed(0)}°`, W - 2, meanY - 3)

      ctx.beginPath()
      history.forEach((pt, i) => {
        const x = (i / (history.length - 1)) * W
        const y = toY(pt.cog)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2
      ctx.lineJoin = 'round'; ctx.stroke()

      const last = history[history.length - 1]
      ctx.beginPath()
      ctx.arc(W, toY(last.cog), 4, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()

      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '8px monospace'
      ctx.textAlign = 'left';  ctx.fillText('oldest', 2, H - 2)
      ctx.textAlign = 'right'; ctx.fillText('now', W - 2, H - 2)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [history])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

function CogTile({ cog, history, gpsError }) {
  const containerRef = useRef(null)
  const [fontSize, setFontSize] = useState(80)
  const text = cog !== null ? `${Math.round(cog)}°` : '—°'

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setFontSize(fitFontSize(text, W, H * 0.52))
    }
    const ro = new ResizeObserver(compute)
    ro.observe(el); compute()
    return () => ro.disconnect()
  }, [text])

  let trend = null
  if (history.length >= 6) {
    const n = history.length
    const third = Math.floor(n / 3)
    const firstAvg = history.slice(0, third).reduce((a, b) => a + b.cog, 0) / third
    const lastAvg  = history.slice(-third).reduce((a, b) => a + b.cog, 0) / third
    trend = lastAvg - firstAvg
  }

  return (
    <div ref={containerRef} style={{ flex: 3, minHeight: 0, background: BG(1), position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(1)},0.4)`, zIndex: 1 }}>COG</span>
      {trend !== null && (
        <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 11, fontFamily: 'monospace', color: `rgba(${RGB(1)},0.5)`, zIndex: 1 }}>
          {trend > 0.5 ? `▲ +${trend.toFixed(1)}°` : trend < -0.5 ? `▼ ${trend.toFixed(1)}°` : '— STEADY'}
        </span>
      )}
      <div style={{ height: '52%', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
        <span style={{ fontSize, fontWeight: 900, fontFamily: 'monospace', color: FG(1), lineHeight: 1, letterSpacing: '-0.02em' }}>
          {text}
        </span>
      </div>
      <div style={{ height: '48%', borderTop: `1px solid rgba(${RGB(1)},0.12)`, background: BG(0), position: 'relative' }}>
        {history.length >= 2
          ? <CogChart history={history} />
          : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
              {gpsError || 'COLLECTING COG DATA…'}
            </span>
        }
      </div>
    </div>
  )
}

// Roll tile: shows leeward-corrected value when tack is known, otherwise raw roll.
// leewardRoll convention: negative = leeward (heel to leeward side), positive = windward
function RollTile({ roll, leewardRoll, onTap }) {
  const containerRef = useRef(null)
  const [fontSize, setFontSize] = useState(80)

  const hasTack   = leewardRoll !== null
  const displayVal = hasTack ? leewardRoll : roll
  const text = displayVal !== null
    ? `${displayVal >= 0 ? '+' : ''}${Number(displayVal).toFixed(1)}°`
    : '—°'

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setFontSize(fitFontSize(text, W, H))
    }
    const ro = new ResizeObserver(compute)
    ro.observe(el); compute()
    return () => ro.disconnect()
  }, [text])

  let side = null
  if (hasTack && displayVal !== null) {
    side = Math.abs(leewardRoll) <= 1 ? 'LEVEL' : leewardRoll < -1 ? 'LEEWARD' : 'WINDWARD'
  } else if (!hasTack && roll !== null) {
    side = roll > 1 ? 'PORT' : roll < -1 ? 'STBD' : 'LEVEL'
  }

  return (
    <div ref={containerRef} onClick={onTap} style={{ flex: 3, minHeight: 0, background: BG(2), position: 'relative', overflow: 'hidden', cursor: roll === null ? 'pointer' : 'default' }}>
      <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(2)},0.4)`, zIndex: 1 }}>ROLL</span>
      {roll === null && (
        <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.12em', color: `rgba(${RGB(2)},0.3)`, zIndex: 1 }}>TAP TO ACTIVATE</span>
      )}
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
        <span style={{ fontSize, fontWeight: 900, fontFamily: 'monospace', color: roll === null ? `rgba(${RGB(2)},0.2)` : FG(2), lineHeight: 1, letterSpacing: '-0.02em' }}>
          {text}
        </span>
      </div>
      {side && (
        <span style={{
          position: 'absolute', bottom: 8, right: 10,
          fontSize: 'clamp(14px,3vh,26px)', fontFamily: 'monospace', fontWeight: 700,
          color: side === 'LEVEL' ? `rgba(${RGB(2)},0.6)` : `rgba(${RGB(2)},0.45)`,
        }}>
          {side}
        </span>
      )}
    </div>
  )
}

const ROLL_ALPHA = 0.18
const ROLL_CLAMP = 45

function computeHeel(x, y, z) {
  const g = Math.sqrt(x * x + y * y + z * z) || 9.81
  return Math.asin(Math.max(-1, Math.min(1, x / g))) * 180 / Math.PI
}

export default function DashboardView({ wind }) {
  const [cog, setCog]               = useState(null)
  const [cogHistory, setCogHistory] = useState([])
  const [roll, setRoll]             = useState(null)
  const [time, setTime]             = useState('')
  const [gpsError, setGpsError]     = useState(null)
  const lastSample                  = useRef(0)
  const rollSmoothed                = useRef(null)
  const rollLastUpdate              = useRef(0)
  const rollRefreshMs               = useRef(parseInt(localStorage.getItem('rollRefreshMs') || '500'))

  function applyRoll(rawHeel) {
    const now = Date.now()
    if (now - rollLastUpdate.current < rollRefreshMs.current) return
    rollLastUpdate.current = now
    const clamped  = Math.max(-ROLL_CLAMP, Math.min(ROLL_CLAMP, rawHeel))
    const smoothed = rollSmoothed.current === null
      ? clamped
      : rollSmoothed.current + ROLL_ALPHA * (clamped - rollSmoothed.current)
    rollSmoothed.current = smoothed
    setRoll(parseFloat(smoothed.toFixed(1)))
  }

  function listenMotion() {
    window.addEventListener('devicemotion', e => {
      const acc = e.accelerationIncludingGravity
      if (!acc || acc.x === null) return
      applyRoll(computeHeel(acc.x, acc.y, acc.z))
    })
  }

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return }
    const id = navigator.geolocation.watchPosition(pos => {
      const heading = pos.coords.heading
      if (heading !== null && !isNaN(heading)) {
        setCog(heading)
        const now = Date.now()
        if (now - lastSample.current >= 5000) {
          lastSample.current = now
          setCogHistory(h => [...h.slice(-120), { time: now, cog: heading }])
        }
      }
      setGpsError(null)
    }, err => setGpsError(err.message), { enableHighAccuracy: true })
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') return
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
      listenMotion()
    } else {
      DeviceMotionEvent.requestPermission()
        .then(s => { if (s === 'granted') listenMotion() })
        .catch(() => {})
    }
  }, [])

  async function handleRollTap() {
    if (roll !== null) return
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      try {
        const s = await DeviceMotionEvent.requestPermission()
        if (s === 'granted') listenMotion()
      } catch {}
    }
  }

  // Compute tack-aware leeward roll.
  // On starboard tack (twa < 180): heel to port is leeward → leewardRoll = -roll (so negative = leeward)
  // On port tack (twa >= 180): heel to starboard is leeward → leewardRoll = roll (negative = starboard = leeward)
  let leewardRoll = null
  const twd = wind?.direction ?? null
  if (roll !== null && twd !== null && cog !== null) {
    const twa = ((twd - cog) + 360) % 360
    leewardRoll = twa < 180 ? -roll : roll
    leewardRoll = parseFloat(leewardRoll.toFixed(1))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      <div style={{ flex: 1, minHeight: 0, background: BG(0), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>RACING</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      <CogTile cog={cog} history={cogHistory} gpsError={gpsError} />

      <RollTile roll={roll} leewardRoll={leewardRoll} onTap={handleRollTap} />

    </div>
  )
}
