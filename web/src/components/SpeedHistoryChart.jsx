import { useRef, useEffect } from 'react'

function convert(mps, unit) {
  if (unit === 'KTS') return mps * 1.94384
  if (unit === 'KM/H') return mps * 3.6
  return mps
}

export default function SpeedHistoryChart({ buckets, unit = 'KTS', foreground = '#fff' }) {
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
      const COUNT = 10
      const values = buckets.slice(-COUNT)
      const converted = values.map(v => convert(v, unit))
      const maxVal = Math.max(1, ...converted)
      const labelH = 14
      const chartH = H - labelH
      const gap = 4
      const barW = (W - gap * (COUNT - 1)) / COUNT
      const emptySlots = COUNT - values.length

      converted.forEach((disp, i) => {
        const slot = emptySlots + i
        const x = slot * (barW + gap)
        const barH = Math.max(2, (disp / maxVal) * (chartH - 16))
        const y = chartH - barH
        const alpha = i === converted.length - 1 ? 1.0 : 0.7
        ctx.fillStyle = `rgba(${col},${alpha})`
        ctx.fillRect(x, y, barW, barH)

        ctx.fillStyle = `rgba(${col},0.5)`
        ctx.font = `${9}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(disp.toFixed(0), x + barW / 2, y - 2)
      })

      // Time labels
      for (let i = 0; i < COUNT; i++) {
        const label = i === COUNT - 1 ? 'NOW' : `−${(COUNT - 1 - i) * 3}m`
        const slot = i
        const x = slot * (barW + gap) + barW / 2
        ctx.fillStyle = `rgba(${col},0.22)`
        ctx.font = `7px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(label, x, H - 1)
      }
    }

    const ro = new ResizeObserver(draw)
    ro.observe(container)
    draw()
    return () => ro.disconnect()
  }, [buckets, unit, foreground])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
