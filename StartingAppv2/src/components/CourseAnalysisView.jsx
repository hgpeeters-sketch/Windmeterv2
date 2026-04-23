import { useState, useEffect, useRef } from 'react'
import { C, F, NUM_SHADOW } from '../theme'
import { circularMean } from '../useWindData'

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

  let side, line1, line2
  if (Math.abs(trend) > 3) {
    if (trend > 0) {
      side = 'RIGHT'
      line1 = `Wind trending right (+${trend.toFixed(1)}°)`
      line2 = 'Starboard tack lifted. Favour right side of course.'
    } else {
      side = 'LEFT'
      line1 = `Wind trending left (${trend.toFixed(1)}°)`
      line2 = 'Port tack lifted. Favour left side of course.'
    }
  } else if (amplitude > 4) {
    if (current > 1) {
      side = 'LEFT'
      line1 = `Currently right of mean (+${current.toFixed(1)}°) — SB lifted`
      line2 = 'Oscillating. On a right shift now → left side next lift.'
    } else if (current < -1) {
      side = 'RIGHT'
      line1 = `Currently left of mean (${current.toFixed(1)}°) — port lifted`
      line2 = 'Oscillating. On a left shift now → right side next lift.'
    } else {
      side = 'NEUTRAL'
      line1 = `Wind near mean (${current.toFixed(1)}°) — oscillating ±${amplitude.toFixed(0)}°`
      line2 = 'Near median shift. Watch for next oscillation before committing.'
    }
  } else {
    side = 'NEUTRAL'
    line1 = 'Wind steady, no clear oscillation'
    line2 = 'No side advantage from shifts. Focus on pressure and line bias.'
  }

  return { shifts, current, trend, amplitude, side, line1, line2 }
}

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

      for (const deg of [5, 10]) {
        const y = midY - (deg / maxD) * (midY - 6)
        if (y > 0 && y < H) {
          ctx.setLineDash([3, 3])
          ctx.strokeStyle = C.sep; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 36, y); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(0, H - y); ctx.lineTo(W - 36, H - y); ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = C.textDim
          ctx.font = '700 9px "Barlow Condensed", monospace'; ctx.textAlign = 'right'
          ctx.fillText(`SB +${deg}°`, W - 2, y + 3)
          ctx.fillText(`PT -${deg}°`, W - 2, H - y + 3)
        }
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W - 36, midY); ctx.stroke()
      ctx.fillStyle = C.textDim; ctx.font = '700 8px "Barlow Condensed", monospace'; ctx.textAlign = 'right'
      ctx.fillText('MARK', W - 2, midY + 3)

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
          ctx.fillStyle = dev >= 0 ? C.cyan : C.neg
          ctx.globalAlpha = 0.85
          ctx.fillRect(x, y, barW, barH)
          ctx.globalAlpha = 1
        })
      }

      ctx.fillStyle = C.textDim; ctx.font = '700 8px "Barlow Condensed", monospace'
      ctx.textAlign = 'left';   ctx.fillText('-30m', 2, H - 3)
      ctx.textAlign = 'center'; ctx.fillText('-15m', (W - 40) / 2, H - 3)
      ctx.textAlign = 'left';   ctx.fillText('now', W - 40 - 22, H - 3)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container); draw()
    return () => ro.disconnect()
  }, [samples, mark])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

const SL = ({ label, right }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 14px 3px', borderBottom: `1px solid ${C.sep}`,
    background: C.cardAlt, flexShrink: 0,
  }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, letterSpacing: '0.16em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
    {right && <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, color: C.cyan }}>{right}</span>}
  </div>
)

export default function CourseAnalysisView({ wind, samples }) {
  const twd = localStorage.getItem('v2_manualTwd')
  const [mark, setMark] = useState(twd !== null ? parseInt(twd) : Math.round(wind.direction))
  const markDefaulted = useRef(twd !== null)

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

  function changeMark(delta) {
    markDefaulted.current = true
    setMark(m => ((m + delta) % 360 + 360) % 360)
  }

  const result = analyze(samples, mark)
  const current = shiftFromMark(wind.direction, mark)
  const liftedTack = current > 0 ? 'STBD ▶' : current < 0 ? '◀ PORT' : '—'

  const avgTwd = samples.length >= 3
    ? Math.round(circularMean(samples.map(s => s.direction)))
    : Math.round(wind.direction)

  const favour = result ? result.side : 'NEUTRAL'
  const favourColor = favour === 'RIGHT' ? C.cyan : favour === 'LEFT' ? C.neg : C.textSub

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: C.bg }}>

      <SL label="MARK BEARING" />

      {/* Mark hero + adj */}
      <div style={{ background: C.card, padding: '14px 14px 18px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.22em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>
          MARK
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 175, fontFamily: F.bc, fontWeight: 800, color: C.text, lineHeight: 0.88, letterSpacing: '-0.02em', textShadow: NUM_SHADOW }}>
            {mark}
          </span>
          <span style={{ fontSize: 28, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginLeft: 4 }}>°</span>
        </div>
      </div>
      <div style={{ padding: '10px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.sep}` }}>
          {[[-10,'−10'],[-1,'−1'],[1,'+1'],[10,'+10']].map(([delta, label], i) => (
            <button
              key={delta}
              onPointerDown={() => changeMark(delta)}
              style={{
                flex: 1, height: 56, background: C.card,
                border: 'none', borderRight: i < 3 ? `1px solid ${C.sep}` : 'none',
                color: C.text, fontFamily: F.bc, fontWeight: 700, fontSize: 25,
                cursor: 'pointer',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Mini stats row */}
      <div style={{ display: 'flex', background: C.cardAlt, borderBottom: `1px solid ${C.sep}`, flexShrink: 0 }}>
        {[
          { label: 'AVG TWD', val: `${avgTwd}`, unit: '°' },
          { label: 'SHIFT', val: `${current >= 0 ? '+' : ''}${current.toFixed(1)}`, unit: '°' },
          { label: 'LIFTED', val: liftedTack },
        ].map(({ label, val, unit }, i) => (
          <div key={i} style={{
            flex: 1, padding: '10px', textAlign: 'center',
            borderLeft: i > 0 ? `1px solid ${C.sep}` : 'none',
          }}>
            <div style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.2em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, fontFamily: F.bc, fontWeight: 800, color: C.text, lineHeight: 1 }}>{val}</span>
              {unit && <span style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginBottom: 3, marginLeft: 2 }}>{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <SL label="SHIFT VS MARK" right="← PORT / STBD →" />
      <div style={{ height: 90, background: C.cardAlt, flexShrink: 0 }}>
        <CourseOscChart samples={samples} mark={mark} />
      </div>

      <SL label="FAVOURED SIDE" />
      <div style={{ background: C.card, padding: '16px 14px 20px', flexShrink: 0 }}>
        <span style={{ fontSize: 64, fontFamily: F.bc, fontWeight: 800, color: favourColor, lineHeight: 0.9, letterSpacing: '-0.02em' }}>
          {favour}
        </span>
        {result && (
          <>
            <div style={{ marginTop: 10, fontSize: 12, fontFamily: F.b, color: C.textSub, lineHeight: 1.6 }}>{result.line1}</div>
            <div style={{ marginTop: 4, fontSize: 13, fontFamily: F.b, color: C.text, lineHeight: 1.6 }}>{result.line2}</div>
          </>
        )}
        {!result && (
          <div style={{ marginTop: 8, fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.1em' }}>
            LOG MORE READINGS TO ANALYSE
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
