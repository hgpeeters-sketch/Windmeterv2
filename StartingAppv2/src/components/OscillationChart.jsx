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

      const col = foreground === '#fff' ? '255,255,255' : '0,0,0'
      const midY = H / 2

      // Bucket samples into 30s intervals
      const cutoff = Date.now() - 30 * 60_000
      const recent = samples.filter(s => s.time >= cutoff)
      const allDirs = recent.map(s => s.direction)
      const mean = allDirs.length > 1 ? circularMean(allDirs) : null

      let devs = []
      if (mean !== null) {
        const BUCKET = 30_000 // 30 seconds
        const buckets = {}
        recent.forEach(s => {
          const b = Math.floor((s.time - cutoff) / BUCKET)
          if (!buckets[b]) buckets[b] = []
          buckets[b].push(s.direction)
        })
        devs = Object.keys(buckets).sort((a, b) => +a - +b).map(k => {
          const avg = circularMean(buckets[k])
          let diff = avg - mean
          if (diff >  180) diff -= 360
          if (diff < -180) diff += 360
          return diff
        })
      }

      // Scale: show at least ±10°, or more if data exceeds it
      const maxD = Math.max(12, ...devs.map(Math.abs))
      const scale = (deg) => midY - (deg / maxD) * (midY - 6)

      // Guide lines at ±5° and ±10°
      for (const deg of [5, 10]) {
        const y = scale(deg)
        if (y > 0 && y < H) {
          ctx.setLineDash([3, 3])
          ctx.strokeStyle = `rgba(${col},${deg === 10 ? 0.22 : 0.12})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(0, H - y); ctx.lineTo(W, H - y); ctx.stroke()
          ctx.setLineDash([])
          // Degree labels on right
          ctx.fillStyle = `rgba(${col},0.4)`
          ctx.font = '9px monospace'
          ctx.textAlign = 'right'
          ctx.fillText(`+${deg}°`, W - 3, y - 2)
          ctx.fillText(`-${deg}°`, W - 3, H - y + 10)
        }
      }

      // Zero line
      ctx.strokeStyle = `rgba(${col},0.45)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()

      // Bars
      if (devs.length > 0) {
        const n = devs.length
        const gap = 2
        const barW = Math.max(4, (W - 40 - gap * (n - 1)) / n) // leave 40px for labels
        devs.forEach((dev, i) => {
          const barH = Math.max(2, Math.abs(dev) / maxD * (midY - 6))
          const x = i * (barW + gap)
          const y = dev >= 0 ? midY - barH : midY
          ctx.fillStyle = `rgba(${col},${dev >= 0 ? 0.9 : 0.6})`
          ctx.fillRect(x, y, barW, barH)
        })
      }

      // Time axis labels
      ctx.fillStyle = `rgba(${col},0.3)`
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('-30m', 2, H - 3)
      ctx.textAlign = 'center'
      ctx.fillText('-15m', (W - 40) / 2, H - 3)
      ctx.textAlign = 'left'
      ctx.fillText('now', (W - 40) - 3, H - 3)

      // Bar = 30s note
      ctx.fillStyle = `rgba(${col},0.2)`
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.fillText('1 bar=30s', W - 3, H - 3)
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [samples, foreground])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
