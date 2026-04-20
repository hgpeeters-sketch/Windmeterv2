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

const BG  = i => i % 2 === 0 ? '#000' : '#fff'
const FG  = i => i % 2 === 0 ? '#fff' : '#000'
const RGB = i => i % 2 === 0 ? '255,255,255' : '0,0,0'

// Number fills the tile — label & sub-label are absolute overlays (Vakaros style)
function BigTile({ idx, label, value, sub, extra }) {
  return (
    <div style={{ flex: 2, minHeight: 0, background: BG(idx), position: 'relative', overflow: 'hidden' }}>
      {/* tiny label top-left */}
      <div style={{
        position: 'absolute', top: 6, left: 10,
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 1,
      }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(idx)},0.4)` }}>
          {label}
        </span>
        {extra}
      </div>
      {/* big number — fills tile height */}
      <div style={{
        height: '100%', display: 'flex',
        alignItems: 'center',
        paddingLeft: 6, paddingRight: 6,
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: 'clamp(60px, 17vh, 140px)',
          fontWeight: 900, fontFamily: 'monospace',
          color: FG(idx), lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>{value}</span>
      </div>
      {/* unit / compass label — bottom right */}
      <span style={{
        position: 'absolute', bottom: 8, right: 10,
        fontSize: 'clamp(14px, 3.5vh, 28px)',
        fontFamily: 'monospace', fontWeight: 700,
        color: `rgba(${RGB(idx)},0.45)`,
      }}>{sub}</span>
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

  const unitBtn = (
    <button onClick={cycleUnit} style={{
      padding: '2px 7px', background: 'transparent',
      border: `1px solid rgba(${RGB(3)},0.3)`,
      color: `rgba(${RGB(3)},0.7)`,
      fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
      cursor: 'pointer', borderRadius: 3,
    }}>{unit}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Header — flex 1 */}
      <div style={{
        flex: 1, minHeight: 0, background: BG(0),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(0)},0.5)`, whiteSpace: 'nowrap' }}>
          PRE-START
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: FG(0), fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </span>
      </div>

      {/* Row 1: TWD */}
      <BigTile idx={1} label="TWD" value={`${wind.direction}°`} sub={compassLabel(wind.direction)} />

      {/* Row 2: Oscillation chart */}
      <div style={{ flex: 2, minHeight: 0, background: BG(2), display: 'flex', flexDirection: 'column' }}>
        <span style={{ flexShrink: 0, padding: '5px 0 2px 10px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.15em', color: `rgba(${RGB(2)},0.4)` }}>
          WIND SHIFT  (° FROM MEAN)
        </span>
        <div style={{ flex: 1, minHeight: 0 }}>
          <OscillationChart samples={samples} foreground={FG(2)} />
        </div>
      </div>

      {/* Row 3: TWS */}
      <BigTile idx={3} label="TWS" value={spd} sub={unit} extra={unitBtn} />

      {/* Row 4: Speed history */}
      <div style={{ flex: 2, minHeight: 0, background: BG(4), display: 'flex', flexDirection: 'column' }}>
        <span style={{ flexShrink: 0, padding: '5px 0 2px 10px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.15em', color: `rgba(${RGB(4)},0.4)` }}>
          WIND SPEED  (30 MIN · 3 MIN BARS)
        </span>
        <div style={{ flex: 1, minHeight: 0 }}>
          <SpeedHistoryChart buckets={speedBuckets} unit={unit} foreground={FG(4)} />
        </div>
      </div>

    </div>
  )
}
