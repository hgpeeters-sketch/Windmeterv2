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

// even index = dark, odd = light
const BG = i => i % 2 === 0 ? '#000' : '#fff'
const FG = i => i % 2 === 0 ? '#fff' : '#000'
const FGRGB = i => i % 2 === 0 ? '255,255,255' : '0,0,0'

function RowLabel({ text, idx, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <span style={{
        fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em',
        color: `rgba(${FGRGB(idx)},0.35)`,
        padding: '6px 0 3px 16px', display: 'block',
      }}>{text}</span>
      {extra}
    </div>
  )
}

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

      {/* Row 0: Header — flex 1 (half height of content rows) */}
      <div style={{
        flex: 1, minHeight: 0, background: BG(0),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.25em', color: `rgba(${FGRGB(0)},0.4)` }}>
          PRE-START
        </span>
        <span style={{ fontSize: '3.5vh', fontWeight: 700, fontFamily: 'monospace', color: FG(0), fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </span>
      </div>

      {/* Row 1: TWD — flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(1), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 16px' }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: `rgba(${FGRGB(1)},0.35)`, marginBottom: 4 }}>
          TWD
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: '10vh', fontWeight: 700, fontFamily: 'monospace', color: FG(1), lineHeight: 1 }}>
            {wind.direction}°
          </span>
          <span style={{ fontSize: '4vh', fontFamily: 'monospace', color: `rgba(${FGRGB(1)},0.4)` }}>
            {compassLabel(wind.direction)}
          </span>
        </div>
      </div>

      {/* Row 2: Oscillation chart — flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(2), display: 'flex', flexDirection: 'column' }}>
        <RowLabel text="WIND SHIFT  (° FROM MEAN)" idx={2} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <OscillationChart samples={samples} foreground={FG(2)} />
        </div>
      </div>

      {/* Row 3: TWS — flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(3), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: `rgba(${FGRGB(3)},0.35)` }}>
            TWS
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={cycleUnit} style={{
            marginRight: 16, padding: '3px 7px',
            background: 'transparent', border: `1px solid rgba(${FGRGB(3)},0.28)`,
            color: `rgba(${FGRGB(3)},0.7)`, fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', borderRadius: 4,
          }}>{unit}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: '10vh', fontWeight: 700, fontFamily: 'monospace', color: FG(3), lineHeight: 1 }}>
            {spd}
          </span>
          <span style={{ fontSize: '3.5vh', fontFamily: 'monospace', color: `rgba(${FGRGB(3)},0.35)` }}>
            {unit}
          </span>
        </div>
      </div>

      {/* Row 4: Speed history — flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(4), display: 'flex', flexDirection: 'column' }}>
        <RowLabel text="WIND SPEED  (30 MIN, 3 MIN BARS)" idx={4} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <SpeedHistoryChart buckets={speedBuckets} unit={unit} foreground={FG(4)} />
        </div>
      </div>

    </div>
  )
}
