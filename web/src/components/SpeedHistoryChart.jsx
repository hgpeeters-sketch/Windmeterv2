import { useRef, useEffect } from 'react'

function convert(mps, unit) {
  if (unit === 'KTS') return mps * 1.94384
  if (unit === 'KM/H') return mps * 3.6
  return mps
}

function hexOpacity(color, alpha) {
  if (color === '#fff' || color === 'white' || color === '#ffffff') {
    return `rgba(255,255,255,${alpha})`
  }
  return `rgba(0,0,0,${alpha})`
}

export default function SpeedHistoryChart({ buckets, unit = 'KTS', foreground = '#fff', height = 110 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const COUNT = 10
    const values = buckets.slice(-COUNT)
    const converted = values.map(v => convert(v, unit))
    const maxVal = Math.max(1, ...converted)
    const gap = 4
    const barW = (W - gap * (COUNT - 1)) / COUNT
    const chartH = H - 20

    const emptySlots = COUNT - values.length
    converted.forEach((disp, i) => {
      const slot = emptySlots + i
      const x = slot * (barW + gap)
      const barH = Math.max(2, (disp / maxVal) * chartH)
      const y = chartH - barH
      const alpha = i === converted.length - 1 ? 1.0 : 0.7
      ctx.fillStyle = hexOpacity(foreground, alpha)
      ctx.fillRect(x, y, barW, barH)

      // Label
      ctx.fillStyle = hexOpacity(foreground, 0.5)
      ctx.font = `${9}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(disp.toFixed(0), x + barW / 2, y - 2)
    })
  }, [buckets, unit, foreground])

  const timeLabels = Array.from({ length: 10 }, (_, i) => (9 - i) === 0 ? 'NOW' : `−${(9 - i) * 3}m`)

  return (
    <div style={{ width: '100%' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={(height - 18) * 2}
        style={{ width: '100%', height: height - 18, display: 'block' }}
      />
      <div style={{ display: 'flex', paddingTop: 2 }}>
        {timeLabels.map((l, i) => (
          <span key={i} style={{
            flex: 1, textAlign: 'center',
            fontSize: 7, fontFamily: 'monospace',
            color: hexOpacity(foreground, 0.22),
          }}>{l}</span>
        ))}
      </div>
    </div>
  )
}
