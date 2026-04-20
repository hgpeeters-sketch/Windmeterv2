import { useRef, useEffect } from 'react'
import { circularMean } from '../useWindData'

export default function OscillationChart({ samples, foreground = '#fff', height = 130 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const cutoff = Date.now() - 30 * 60_000
    const dirs = samples.filter(s => s.time >= cutoff).map(s => s.direction)
    const midY = H / 2

    // Guide lines
    for (const ratio of [0.5, 1.0]) {
      const y = midY - ratio * midY * 0.85
      ctx.strokeStyle = hexOpacity(foreground, 0.08)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, H - y); ctx.lineTo(W, H - y); ctx.stroke()
    }

    // Zero line
    ctx.strokeStyle = hexOpacity(foreground, 0.35)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()

    if (dirs.length < 2) return

    const mean = circularMean(dirs)
    const devs = dirs.map(d => {
      let diff = d - mean
      if (diff >  180) diff -= 360
      if (diff < -180) diff += 360
      return diff
    })

    const maxD = Math.max(10, ...devs.map(Math.abs))
    const n = devs.length
    const gap = 1
    const barW = (W - gap * (n - 1)) / n

    devs.forEach((dev, i) => {
      const barH = Math.max(2, Math.abs(dev) / maxD * (midY - 4))
      const x = i * (barW + gap)
      const y = dev >= 0 ? midY - barH : midY
      ctx.fillStyle = hexOpacity(foreground, dev >= 0 ? 0.95 : 0.65)
      ctx.fillRect(x, y, Math.max(1, barW), barH)
    })
  }, [samples, foreground])

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height * 2}
        style={{ width: '100%', height: '100%' }}
      />
      <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, fontFamily: 'monospace', color: hexOpacity(foreground, 0.25) }}>+</span>
      <span style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 9, fontFamily: 'monospace', color: hexOpacity(foreground, 0.25) }}>−</span>
    </div>
  )
}

function hexOpacity(color, alpha) {
  if (color === '#fff' || color === 'white' || color === '#ffffff') {
    return `rgba(255,255,255,${alpha})`
  }
  return `rgba(0,0,0,${alpha})`
}
