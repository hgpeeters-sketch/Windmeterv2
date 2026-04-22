import { useState, useEffect, useRef } from 'react'
import { C, F, NUM_SHADOW } from '../theme'

const SL = ({ label, right }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 14px', borderBottom: `1px solid ${C.sep}`, flexShrink: 0,
  }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, letterSpacing: '0.28em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
    {right && <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, color: C.textDim }}>{right}</span>}
  </div>
)

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
      ctx.strokeStyle = C.sep; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, meanY); ctx.lineTo(W, meanY); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = C.textDim; ctx.font = '700 8px "Barlow Condensed", monospace'; ctx.textAlign = 'right'
      ctx.fillText(`${mean.toFixed(0)}°`, W - 2, meanY - 3)

      ctx.beginPath()
      history.forEach((pt, i) => {
        const x = (i / (history.length - 1)) * W
        const y = toY(pt.cog)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = 'rgba(0,221,192,0.7)'; ctx.lineWidth = 2
      ctx.lineJoin = 'round'; ctx.stroke()

      const last = history[history.length - 1]
      ctx.beginPath()
      ctx.arc(W, toY(last.cog), 4, 0, Math.PI * 2)
      ctx.fillStyle = C.cyan; ctx.fill()

      ctx.fillStyle = C.textDim; ctx.font = '700 8px "Barlow Condensed", monospace'
      ctx.textAlign = 'left';  ctx.fillText('oldest', 2, H - 2)
      ctx.textAlign = 'right'; ctx.fillText('now', W - 2, H - 2)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container); draw()
    return () => ro.disconnect()
  }, [history])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
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
  const [gpsError, setGpsError]     = useState(null)
  const [rollActive, setRollActive] = useState(false)
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
    setRollActive(true)
    window.addEventListener('devicemotion', e => {
      const acc = e.accelerationIncludingGravity
      if (!acc || acc.x === null) return
      applyRoll(computeHeel(acc.x, acc.y, acc.z))
    })
  }

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
    }
  }, [])

  async function handleRollTap() {
    if (rollActive) return
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      try {
        const s = await DeviceMotionEvent.requestPermission()
        if (s === 'granted') listenMotion()
      } catch {}
    }
  }

  let leewardRoll = null
  const twd = wind?.direction ?? null
  if (roll !== null && twd !== null && cog !== null) {
    const twa = ((twd - cog) + 360) % 360
    leewardRoll = twa < 180 ? -roll : roll
    leewardRoll = parseFloat(leewardRoll.toFixed(1))
  }

  const hasTack   = leewardRoll !== null
  const displayRoll = hasTack ? leewardRoll : roll
  const rollText  = displayRoll !== null
    ? `${displayRoll >= 0 ? '+' : ''}${Number(displayRoll).toFixed(1)}`
    : '—'

  let rollSide = null
  if (hasTack && displayRoll !== null) {
    rollSide = Math.abs(leewardRoll) <= 1 ? 'LEVEL' : leewardRoll < -1 ? 'LEEWARD' : 'WINDWARD'
  } else if (!hasTack && roll !== null) {
    rollSide = Math.abs(roll) <= 1 ? 'LEVEL' : roll > 1 ? 'PORT' : 'STBD'
  }

  let trend = null
  if (cogHistory.length >= 6) {
    const n = cogHistory.length
    const third = Math.floor(n / 3)
    const firstAvg = cogHistory.slice(0, third).reduce((a, b) => a + b.cog, 0) / third
    const lastAvg  = cogHistory.slice(-third).reduce((a, b) => a + b.cog, 0) / third
    trend = lastAvg - firstAvg
  }

  const rollIsLevel = rollSide === 'LEVEL'
  const rollColor = roll === null ? C.textDim : rollIsLevel ? C.cyan : C.text

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: C.bg }}>

      {/* COG section */}
      <SL
        label="COURSE OVER GROUND"
        right={trend !== null ? (trend > 0.5 ? `▲ +${trend.toFixed(1)}°` : trend < -0.5 ? `▼ ${trend.toFixed(1)}°` : '— STEADY') : undefined}
      />
      <div style={{ background: C.card, padding: '14px 14px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 88, fontFamily: F.bc, fontWeight: 800, color: cog !== null ? C.text : C.textDim, lineHeight: 0.9, letterSpacing: '-0.02em', textShadow: NUM_SHADOW }}>
            {cog !== null ? Math.round(cog) : '—'}
          </span>
          {cog !== null && <span style={{ fontSize: 24, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginBottom: 8, marginLeft: 4 }}>°</span>}
        </div>
        {gpsError && (
          <div style={{ marginTop: 4, fontSize: 10, fontFamily: F.bc, fontWeight: 600, color: C.neg }}>{gpsError}</div>
        )}
      </div>
      <div style={{ height: 70, background: C.cardAlt, flexShrink: 0 }}>
        {cogHistory.length >= 2
          ? <CogChart history={cogHistory} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.1em' }}>
                {gpsError || 'COLLECTING COG DATA…'}
              </span>
            </div>
        }
      </div>

      {/* Roll section */}
      <SL label="HEEL / ROLL" right={rollSide ?? undefined} />
      <div
        onClick={handleRollTap}
        style={{
          background: C.card, padding: '14px 14px 18px', flexShrink: 0,
          cursor: rollActive ? 'default' : 'pointer',
        }}
      >
        {!rollActive && roll === null && (
          <div style={{ marginBottom: 8, fontSize: 10, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.12em' }}>
            TAP TO ACTIVATE
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 88, fontFamily: F.bc, fontWeight: 800, color: rollColor, lineHeight: 0.9, letterSpacing: '-0.02em', textShadow: NUM_SHADOW }}>
            {rollSide === 'LEVEL' ? '0.0' : rollText}
          </span>
          {displayRoll !== null && (
            <span style={{ fontSize: 24, fontFamily: F.bc, fontWeight: 700, color: rollIsLevel ? C.cyan : C.textSub, marginBottom: 8, marginLeft: 4 }}>°</span>
          )}
        </div>
        {rollSide && (
          <div style={{ marginTop: 6, fontSize: 14, fontFamily: F.bc, fontWeight: 700, color: rollIsLevel ? C.cyan : C.textSub, letterSpacing: '0.1em' }}>
            {rollSide}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
