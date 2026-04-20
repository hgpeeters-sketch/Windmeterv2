import { useRef, useEffect } from 'react'
import { circularMean } from '../useWindData'

export default function OscillationChart({ samples, foreground = '#fff' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function draw() {
      const W = container.clientWidth
      const H = container.clientHeight
      if (!W || !H) return
      canvas.width = W * 2
      canvas.height = H * 2
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W * 2, H * 2)
      ctx.scale(2, 2)

      const cutoff = Date.now() - 30 * 60_000
      const dirs = samples.filter(s => s.time >= cutoff).map(s => s.direction)
      const midY = H / 2

      const col = foreground === '#fff' ? '255,255,255' : '0,0,0'

      for (const ratio of [0.5, 1.0]) {
        const y = midY - ratio * midY * 0.85
        ctx.strokeStyle = `rgba(${col},0.08)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, H - y); ctx.lineTo(W, H - y); ctx.stroke()
      }
      ctx.strokeStyle = `rgba(${col},0.35)`
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
        ctx.fillStyle = `rgba(${col},${dev >= 0 ? 0.95 : 0.65})`
        ctx.fillRect(x, y, Math.max(1, barW), barH)
      })
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [samples, foreground])

  const col = foreground === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, fontFamily: 'monospace', color: col }}>+</span>
      <span style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 9, fontFamily: 'monospace', color: col }}>−</span>
    </div>
  )
}
