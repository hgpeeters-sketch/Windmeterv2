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

// section index → bg/fg  (even = dark, odd = light)
const BG = i => i % 2 === 0 ? '#000' : '#fff'
const FG = i => i % 2 === 0 ? '#fff' : '#000'

function Label({ text, fg }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em',
      color: fg + '59',  // ~35% opacity
      paddingLeft: 16, paddingTop: 10, paddingBottom: 4,
    }}>{text}</div>
  )
}

export default function PreStartView({ wind, samples, speedBuckets }) {
  const [unit, setUnit] = useState('KTS')
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toTimeString().slice(0, 8))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const cycleUnit = () => setUnit(u => UNITS[(UNITS.indexOf(u) + 1) % UNITS.length])
  const spd = convertSpeed(wind.speedMps, unit).toFixed(1)

  const section = (idx, children) => (
    <div style={{ background: BG(idx), width: '100%' }}>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>

      {/* 0: Clock — dark */}
      {section(0,
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>PRE-START</span>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
        </div>
      )}

      {/* 1: TWD — light */}
      {section(1,
        <div>
          <Label text="TWD" fg={FG(1)} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingLeft: 16, paddingBottom: 14 }}>
            <span style={{ fontSize: 80, fontWeight: 700, fontFamily: 'monospace', color: FG(1), lineHeight: 1 }}>
              {wind.direction}°
            </span>
            <span style={{ fontSize: 32, fontFamily: 'monospace', color: FG(1) + '66' }}>
              {compassLabel(wind.direction)}
            </span>
          </div>
        </div>
      )}

      {/* 2: Oscillation — dark */}
      {section(2,
        <div>
          <Label text="WIND SHIFT  (° FROM MEAN)" fg={FG(2)} />
          <div style={{ paddingBottom: 10 }}>
            <OscillationChart samples={samples} foreground={FG(2)} height={130} />
          </div>
        </div>
      )}

      {/* 3: TWS — light */}
      {section(3,
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Label text="TWS" fg={FG(3)} />
            <div style={{ flex: 1 }} />
            <button onClick={cycleUnit} style={{
              marginRight: 16, padding: '4px 8px',
              background: 'transparent', border: `1px solid ${FG(3)}47`,
              color: FG(3) + 'b3', fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', borderRadius: 4,
            }}>{unit}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingLeft: 16, paddingBottom: 14 }}>
            <span style={{ fontSize: 80, fontWeight: 700, fontFamily: 'monospace', color: FG(3), lineHeight: 1 }}>
              {spd}
            </span>
            <span style={{ fontSize: 28, fontFamily: 'monospace', color: FG(3) + '59' }}>{unit}</span>
          </div>
        </div>
      )}

      {/* 4: Speed history — dark */}
      {section(4,
        <div style={{ paddingBottom: 10 }}>
          <Label text="WIND SPEED  (30 MIN, 3 MIN BARS)" fg={FG(4)} />
          <SpeedHistoryChart buckets={speedBuckets} unit={unit} foreground={FG(4)} height={110} />
        </div>
      )}

    </div>
  )
}
