import { useState, useEffect } from 'react'
import { compassLabel } from '../useWindData'
import OscillationChart from './OscillationChart'
import SpeedHistoryChart from './SpeedHistoryChart'

const UNITS = ['KTS', 'M/S', 'KM/H']
function convertSpeed(mps, unit) {
  if (unit === 'KTS') return mps * 1.94384
  if (unit === 'KM/H') return mps * 3.6
  return mps
}

const BG   = i => i % 2 === 0 ? '#000' : '#fff'
const FG   = i => i % 2 === 0 ? '#fff' : '#000'
const RGB  = i => i % 2 === 0 ? '255,255,255' : '0,0,0'

export default function PreStartView({ wind, samples, speedBuckets }) {
  const [unit, setUnit] = useState('KTS')
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const cycleUnit = () => setUnit(u => UNITS[(UNITS.indexOf(u) + 1) % UNITS.length])
  const spd = convertSpeed(wind.speedMps, unit).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Header — flex 1 (half of content rows) */}
      <div style={{
        flex: 1, minHeight: 0, background: BG(0),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <span style={{
          fontSize: 18, fontWeight: 700,
          fontFamily: 'monospace', letterSpacing: '0.2em',
          color: `rgba(${RGB(0)},0.5)`, whiteSpace: 'nowrap',
        }}>PRE-START</span>
        <span style={{
          fontSize: 22, fontWeight: 700,
          fontFamily: 'monospace', color: FG(0),
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>{time}</span>
      </div>

      {/* Row 1: TWD — flex 2, number fills the box */}
      <div style={{ flex: 2, minHeight: 0, background: BG(1), position: 'relative', overflow: 'hidden' }}>
        {/* Label overlay top-left */}
        <span style={{
          position: 'absolute', top: 8, left: 16,
          fontSize: 'min(2vh, 14px)', fontFamily: 'monospace', letterSpacing: '0.2em',
          color: `rgba(${RGB(1)},0.35)`, zIndex: 1,
        }}>TWD</span>
        {/* Big number centred */}
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 12 }}>
          <span style={{
            fontSize: 'min(12vh, 22vw)', fontWeight: 700,
            fontFamily: 'monospace', color: FG(1), lineHeight: 1,
          }}>{wind.direction}°</span>
        </div>
        {/* Compass label bottom-right */}
        <span style={{
          position: 'absolute', bottom: 10, right: 16,
          fontSize: 'min(3.5vh, 7vw)', fontFamily: 'monospace',
          color: `rgba(${RGB(1)},0.4)`,
        }}>{compassLabel(wind.direction)}</span>
      </div>

      {/* Row 2: Oscillation chart — flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(2), display: 'flex', flexDirection: 'column' }}>
        <span style={{
          flexShrink: 0, padding: '7px 0 3px 16px',
          fontSize: 'min(1.8vh, 13px)', fontFamily: 'monospace', letterSpacing: '0.15em',
          color: `rgba(${RGB(2)},0.35)`,
        }}>WIND SHIFT  (° FROM MEAN)</span>
        <div style={{ flex: 1, minHeight: 0 }}>
          <OscillationChart samples={samples} foreground={FG(2)} />
        </div>
      </div>

      {/* Row 3: TWS — flex 2, number fills the box */}
      <div style={{ flex: 2, minHeight: 0, background: BG(3), position: 'relative', overflow: 'hidden' }}>
        {/* Label + unit toggle overlay top */}
        <div style={{
          position: 'absolute', top: 8, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', zIndex: 1,
        }}>
          <span style={{
            fontSize: 'min(2vh, 14px)', fontFamily: 'monospace', letterSpacing: '0.2em',
            color: `rgba(${RGB(3)},0.35)`,
          }}>TWS</span>
          <button onClick={cycleUnit} style={{
            padding: '3px 8px', background: 'transparent',
            border: `1px solid rgba(${RGB(3)},0.28)`,
            color: `rgba(${RGB(3)},0.7)`,
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', borderRadius: 4,
          }}>{unit}</button>
        </div>
        {/* Big number */}
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
          <span style={{
            fontSize: 'min(12vh, 22vw)', fontWeight: 700,
            fontFamily: 'monospace', color: FG(3), lineHeight: 1,
          }}>{spd}</span>
        </div>
        {/* Unit bottom-right */}
        <span style={{
          position: 'absolute', bottom: 10, right: 16,
          fontSize: 'min(3.5vh, 7vw)', fontFamily: 'monospace',
          color: `rgba(${RGB(3)},0.4)`,
        }}>{unit}</span>
      </div>

      {/* Row 4: Speed history — flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(4), display: 'flex', flexDirection: 'column' }}>
        <span style={{
          flexShrink: 0, padding: '7px 0 3px 16px',
          fontSize: 'min(1.8vh, 13px)', fontFamily: 'monospace', letterSpacing: '0.15em',
          color: `rgba(${RGB(4)},0.35)`,
        }}>WIND SPEED  (30 MIN · 3 MIN BARS)</span>
        <div style={{ flex: 1, minHeight: 0 }}>
          <SpeedHistoryChart buckets={speedBuckets} unit={unit} foreground={FG(4)} />
        </div>
      </div>

    </div>
  )
}
