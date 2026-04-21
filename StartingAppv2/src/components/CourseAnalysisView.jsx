import { useState, useEffect, useRef } from 'react'
import { circularMean } from '../useWindData'

// Angular difference: how far TWD is from mark bearing
// Positive = wind right of mark (lifted on starboard)
// Negative = wind left of mark (lifted on port)
function shiftFromMark(twd, mark) {
  let d = twd - mark
  while (d >  180) d -= 360
  while (d < -180) d += 360
  return d
}

function analyze(samples, mark) {
  if (samples.length < 3) return null
  const shifts = samples.map(s => shiftFromMark(s.direction, mark))
  const n = shifts.length
  const third = Math.max(1, Math.floor(n / 3))
  const firstAvg = shifts.slice(0, third).reduce((a, b) => a + b, 0) / third
  const lastAvg  = shifts.slice(-third).reduce((a, b) => a + b, 0) / third
  const trend    = lastAvg - firstAvg
  const mean     = shifts.reduce((a, b) => a + b, 0) / n
  const amplitude = shifts.map(s => Math.abs(s - mean)).reduce((a, b) => a + b, 0) / n
  const current  = shifts[n - 1]

  let side, color, line1, line2
  if (Math.abs(trend) > 3) {
    if (trend > 0) {
      side = 'RIGHT'; color = '#fff'
      line1 = `Wind trending right (+${trend.toFixed(1)}°)`
      line2 = 'Starboard tack lifted. Favour right side of course.'
    } else {
      side = 'LEFT'; color = '#fff'
      line1 = `Wind trending left (${trend.toFixed(1)}°)`
      line2 = 'Port tack lifted. Favour left side of course.'
    }
  } else if (amplitude > 4) {
    if (current > 1) {
      side = 'LEFT'; color = '#fff'
      line1 = `Currently right of mean (+${current.toFixed(1)}°) — SB lifted`
      line2 = 'Oscillating. On a right shift now → left side next lift. Wait for header before starting on port.'
    } else if (current < -1) {
      side = 'RIGHT'; color = '#fff'
      line1 = `Currently left of mean (${current.toFixed(1)}°) — port lifted`
      line2 = 'Oscillating. On a left shift now → right side next lift. Start on starboard, tack on header.'
    } else {
      side = 'NEUTRAL'; color = '#fff'
      line1 = `Wind near mean (${current.toFixed(1)}°) — oscillating ±${amplitude.toFixed(0)}°`
      line2 = 'Near median shift. Watch for next oscillation before committing to a side.'
    }
  } else {
    side = 'NEUTRAL'; color = '#fff'
    line1 = 'Wind steady, no clear oscillation'
    line2 = 'No side advantage from shifts. Focus on pressure and line bias.'
  }

  return { shifts, current, trend, amplitude, side, line1, line2 }
}

// Canvas chart: deviations relative to mark bearing
function CourseOscChart({ samples, mark }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function draw() {
      const W = container.clientWidth, H = container.clientHeight
      if (!W || !H) return
      canvas.width = W * 2; canvas.height = H * 2
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W * 2, H * 2); ctx.scale(2, 2)

      const cutoff = Date.now() - 30 * 60_000
      const recent = samples.filter(s => s.time >= cutoff)
      const shifts = recent.map(s => shiftFromMark(s.direction, mark))

      const midY = H / 2
      const maxD = Math.max(12, ...shifts.map(Math.abs))

      // Guide lines ±5° and ±10°
      for (const deg of [5, 10]) {
        const y = midY - (deg / maxD) * (midY - 6)
        if (y > 0 && y < H) {
          ctx.setLineDash([3, 3])
          ctx.strokeStyle = `rgba(255,255,255,${deg === 10 ? 0.22 : 0.12})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 36, y); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(0, H - y); ctx.lineTo(W - 36, H - y); ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.font = '9px monospace'; ctx.textAlign = 'right'
          ctx.fillText(`SB +${deg}°`, W - 2, y + 3)
          ctx.fillText(`PT -${deg}°`, W - 2, H - y + 3)
        }
      }

      // Zero line (= mark bearing direction)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W - 36, midY); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '8px monospace'; ctx.textAlign = 'right'
      ctx.fillText('MARK', W - 2, midY + 3)

      // Bars (30s buckets)
      if (recent.length > 1) {
        const BUCKET = 30_000
        const t0 = recent[0].time
        const buckets = {}
        recent.forEach(s => {
          const b = Math.floor((s.time - t0) / BUCKET)
          if (!buckets[b]) buckets[b] = []
          buckets[b].push(shiftFromMark(s.direction, mark))
        })
        const devs = Object.keys(buckets).sort((a, b) => +a - +b).map(k => {
          const arr = buckets[k]
          return arr.reduce((a, b) => a + b, 0) / arr.length
        })
        const n = devs.length
        const gap = 2
        const barW = Math.max(4, (W - 40 - gap * (n - 1)) / n)
        devs.forEach((dev, i) => {
          const barH = Math.max(2, Math.abs(dev) / maxD * (midY - 6))
          const x = i * (barW + gap)
          const y = dev >= 0 ? midY - barH : midY
          // SB lift (positive) = green tint; PT lift (negative) = dimmer
          ctx.fillStyle = dev >= 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'
          ctx.fillRect(x, y, barW, barH)
        })
      }

      // Time axis
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '8px monospace'
      ctx.textAlign = 'left';  ctx.fillText('-30m', 2, H - 3)
      ctx.textAlign = 'center'; ctx.fillText('-15m', (W - 40) / 2, H - 3)
      ctx.textAlign = 'left';  ctx.fillText('now', W - 40 - 22, H - 3)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [samples, mark])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

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

export default function CourseAnalysisView({ wind, samples }) {
  const stored = localStorage.getItem('markBearing')
  const [mark, setMark] = useState(stored !== null ? parseInt(stored) : Math.round(wind.direction))
  const markDefaulted = useRef(stored !== null)
  const [time, setTime] = useState('')
  const markContainerRef = useRef(null)
  const [markFs, setMarkFs] = useState(80)

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  // Keep mark tracking TWD average until user manually adjusts it
  useEffect(() => {
    if (markDefaulted.current) return
    if (samples.length >= 3) {
      const m = Math.round(circularMean(samples.map(s => s.direction)))
      setMark(m)
      markDefaulted.current = true
    } else {
      setMark(Math.round(wind.direction))
    }
  }, [samples, wind.direction])

  const markText = `${String(mark).padStart(3, '0')}°`
  useEffect(() => {
    const el = markContainerRef.current; if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setMarkFs(fitFontSize(markText, W - 8, H * 0.8))
    }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [markText])

  function changeMark(delta) {
    markDefaulted.current = true
    setMark(m => {
      const v = ((m + delta) % 360 + 360) % 360
      localStorage.setItem('markBearing', v)
      return v
    })
  }

  const result = analyze(samples, mark)
  const current = shiftFromMark(wind.direction, mark)
  const liftedTack = current > 0 ? 'STBD' : current < 0 ? 'PORT' : '—'
  const liftedColor = current > 0 ? '#fff' : current < 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Header — dark, flex 1 */}
      <div style={{ flex: 1, minHeight: 0, background: BG(0), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>COURSE ANALYSIS</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      {/* Row 1: Mark bearing input — light, flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(1), position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(1)},0.4)` }}>
          MARK BEARING
        </span>
        {/* – button */}
        <button onPointerDown={() => changeMark(-1)} style={{ height: '100%', width: 56, background: 'transparent', border: 'none', borderRight: `1px solid rgba(${RGB(1)},0.15)`, fontSize: 32, fontWeight: 300, color: `rgba(${RGB(1)},0.5)`, cursor: 'pointer', flexShrink: 0 }}>−</button>
        {/* Value */}
        <div ref={markContainerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span style={{ fontSize: markFs, fontWeight: 900, fontFamily: 'monospace', color: FG(1), lineHeight: 1, letterSpacing: '-0.02em' }}>
            {markText}
          </span>
        </div>
        {/* + button */}
        <button onPointerDown={() => changeMark(+1)} style={{ height: '100%', width: 56, background: 'transparent', border: 'none', borderLeft: `1px solid rgba(${RGB(1)},0.15)`, fontSize: 32, fontWeight: 300, color: `rgba(${RGB(1)},0.5)`, cursor: 'pointer', flexShrink: 0 }}>+</button>
      </div>

      {/* Row 2: Live wind vs mark — dark, flex 2.5 */}
      <div style={{ flex: 2.5, minHeight: 0, background: BG(2), display: 'flex', alignItems: 'center', padding: '0 14px', gap: 0 }}>
        <Cell label="TWD" value={`${wind.direction}°`} light />
        <Divider />
        <Cell label="SHIFT" value={`${current >= 0 ? '+' : ''}${current.toFixed(1)}°`} light />
        <Divider />
        <Cell label="LIFTED" value={liftedTack} color={liftedColor} light />
      </div>

      {/* Row 3: Oscillation chart — dark, flex 2.5 */}
      <div style={{ flex: 2.5, minHeight: 0, background: BG(2), display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ flexShrink: 0, padding: '4px 0 2px 10px', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)' }}>
          SHIFT RELATIVE TO MARK  (+ = SB LIFTED)
        </span>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CourseOscChart samples={samples} mark={mark} />
        </div>
      </div>

      {/* Row 4: Recommendation — light, flex 1.5 */}
      <div style={{ flex: 1.5, minHeight: 0, background: BG(3), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 14px' }}>
        {result ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(3)},0.4)` }}>FAVOUR</span>
              <span style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', color: FG(3) }}>{result.side}</span>
            </div>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: `rgba(${RGB(3)},0.5)`, lineHeight: 1.6 }}>{result.line1}</span>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: FG(3), lineHeight: 1.6, marginTop: 4 }}>{result.line2}</span>
          </>
        ) : (
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: `rgba(${RGB(3)},0.3)`, letterSpacing: '0.1em' }}>
            COLLECTING DATA…
          </span>
        )}
      </div>

    </div>
  )
}

function Cell({ label, value, color, light }) {
  const rgb = light ? '255,255,255' : '0,0,0'
  const containerRef = useRef(null)
  const [fs, setFs] = useState(24)
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const compute = () => { const {clientWidth:W,clientHeight:H}=el; if(W&&H) setFs(fitFontSize(value,W*0.85,H*0.6)) }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [value])
  return (
    <div ref={containerRef} style={{ flex: 1, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em', color: `rgba(${rgb},0.35)`, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: fs, fontWeight: 900, fontFamily: 'monospace', color: color || `rgba(${rgb},0.9)`, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: '60%', background: 'rgba(255,255,255,0.15)' }} />
}
