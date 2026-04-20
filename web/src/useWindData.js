import { useState, useEffect, useRef } from 'react'

// Simulates realistic oscillating wind data
function nextWind(prev) {
  const dirDrift = (Math.random() - 0.5) * 6     // slow trend
  const osc = Math.sin(Date.now() / 18000) * 12  // ~30s oscillation
  let dir = Math.round(prev.direction + dirDrift + osc * 0.3)
  dir = ((dir % 360) + 360) % 360

  const spdDrift = (Math.random() - 0.5) * 0.15
  const spd = Math.max(1, Math.min(25, prev.speedMps + spdDrift))

  return { direction: dir, speedMps: spd }
}

export function useWindData() {
  const [wind, setWind] = useState({ direction: 220, speedMps: 6.2 })
  const [samples, setSamples] = useState([])        // { time, direction, speed }
  const [speedBuckets, setSpeedBuckets] = useState([]) // 3-min averaged knots

  const bucketAccum = useRef([])
  const bucketStart = useRef(Date.now())
  const lastSample  = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      setWind(prev => {
        const next = nextWind(prev)

        // Sample every 10 s
        if (now - lastSample.current >= 10_000) {
          lastSample.current = now
          const sample = { time: now, direction: next.direction, speed: next.speedMps }
          setSamples(s => [...s.filter(x => now - x.time < 35 * 60_000), sample])
          bucketAccum.current.push(next.speedMps * 1.94384)
        }

        // Bucket every 3 min
        if (now - bucketStart.current >= 3 * 60_000 && bucketAccum.current.length) {
          const avg = bucketAccum.current.reduce((a, b) => a + b, 0) / bucketAccum.current.length
          setSpeedBuckets(b => [...b.slice(-9), avg])
          bucketAccum.current = []
          bucketStart.current = now
        }

        return next
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return { wind, samples, speedBuckets }
}

export function compassLabel(deg) {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
               'S','SSW','SW','WSW','W','WNW','NW','NNW']
  return pts[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

export function circularMean(degrees) {
  if (!degrees.length) return 0
  const s = degrees.reduce((a, d) => a + Math.sin(d * Math.PI / 180), 0)
  const c = degrees.reduce((a, d) => a + Math.cos(d * Math.PI / 180), 0)
  const m = Math.atan2(s, c) * 180 / Math.PI
  return m < 0 ? m + 360 : m
}
