import { useState, useEffect, useRef } from 'react'

// Perpendicular distance (metres) from boat to start line.
// Positive = boat is over the line (OCS side), negative = behind.
function distToLine(boat, p1, p2) {
  const toRad = d => d * Math.PI / 180
  const R = 6371000
  const cosLat = Math.cos(toRad((p1.lat + p2.lat) / 2))
  const ax = (p2.lon - p1.lon) * toRad(1) * R * cosLat
  const ay = (p2.lat - p1.lat) * toRad(1) * R
  const bx = (boat.lon - p1.lon) * toRad(1) * R * cosLat
  const by = (boat.lat - p1.lat) * toRad(1) * R
  const len = Math.sqrt(ax * ax + ay * ay)
  if (len < 1) return 0
  return Math.round((bx * ay - by * ax) / len)
}

function fmt(s) {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const BG  = i => i % 2 === 0 ? '#000' : '#fff'
const FG  = i => i % 2 === 0 ? '#fff' : '#000'
const RGB = i => i % 2 === 0 ? '255,255,255' : '0,0,0'

export default function StartSequenceView() {
  const [remaining, setRemaining] = useState(5 * 60)
  const [running, setRunning]     = useState(false)
  const [time, setTime]           = useState('')

  // GPS
  const [boatPos, setBoatPos] = useState(null)
  const [sog, setSog]         = useState(null)
  const [committee, setCommittee] = useState(null)
  const [pin, setPin]             = useState(null)
  const [gpsError, setGpsError]   = useState(null)

  // Roll from device orientation
  const [roll, setRoll]       = useState(null)
  const [orientPerms, setOrientPerms] = useState('unknown')

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  // Countdown
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 0) { setRunning(false); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return }
    const id = navigator.geolocation.watchPosition(
      pos => {
        setBoatPos({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        if (pos.coords.speed !== null) setSog(pos.coords.speed * 1.94384)
        setGpsError(null)
      },
      err => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Device orientation (roll = gamma)
  function requestOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(state => {
        setOrientPerms(state)
        if (state === 'granted') listenOrientation()
      })
    } else {
      listenOrientation()
    }
  }

  function listenOrientation() {
    window.addEventListener('deviceorientation', e => {
      if (e.gamma !== null) setRoll(e.gamma)
    })
    setOrientPerms('granted')
  }

  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission !== 'function') {
      listenOrientation()
    }
  }, [])

  function sync() {
    setRemaining(r => {
      const secs = r % 60
      return secs > 30 ? r + (60 - secs) : r - secs
    })
  }

  function ping(end) {
    if (!boatPos) return
    if (end === 'committee') setCommittee({ ...boatPos })
    else setPin({ ...boatPos })
  }

  const lineDist = (boatPos && committee && pin)
    ? distToLine(boatPos, committee, pin)
    : null

  const urgent  = remaining <= 60 && running
  const started = remaining === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Header — dark, flex 1 */}
      <div style={{ flex: 1, minHeight: 0, background: BG(0), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>START SEQUENCE</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      {/* Row 1: Countdown — light, flex 3 */}
      <div style={{ flex: 3, minHeight: 0, background: BG(1), display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(1)},0.35)` }}>
          COUNTDOWN
        </span>
        {/* Timer display */}
        <span style={{
          fontSize: 'clamp(60px, 16vh, 130px)',
          fontWeight: 900, fontFamily: 'monospace',
          color: started ? `rgba(${RGB(1)},0.3)` : FG(1),
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: urgent ? '0.05em' : '-0.02em',
        }}>
          {started ? 'GO' : fmt(remaining)}
        </span>
        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn onClick={() => setRunning(r => !r)} primary={!running && !started} fg={FG(1)} rgb={RGB(1)}>
            {running ? 'PAUSE' : started ? 'DONE' : 'START'}
          </Btn>
          <Btn onClick={() => { setRunning(false); setRemaining(5 * 60) }} fg={FG(1)} rgb={RGB(1)}>RESET</Btn>
          <Btn onClick={sync} fg={FG(1)} rgb={RGB(1)}>SYNC</Btn>
        </div>
      </div>

      {/* Row 2: Line distance — dark, flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(2), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(2)},0.4)` }}>DISTANCE TO START LINE</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 'clamp(28px, 6vh, 52px)', fontWeight: 900, fontFamily: 'monospace', color: lineDist === null ? 'rgba(255,255,255,0.2)' : lineDist > 0 ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
            {lineDist === null ? '—  m' : `${lineDist > 0 ? '+' : ''}${lineDist} m`}
          </span>
          {lineDist !== null && (
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: lineDist > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)' }}>
              {lineDist > 0 ? '⚠ OVER LINE' : 'BEHIND LINE'}
            </span>
          )}
        </div>
        {/* Ping buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <PingBtn label="COMMITTEE" pinged={!!committee} onClick={() => ping('committee')} noGps={!boatPos} />
          <PingBtn label="PIN END"   pinged={!!pin}       onClick={() => ping('pin')}       noGps={!boatPos} />
        </div>
        {gpsError && <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>GPS: {gpsError}</span>}
      </div>

      {/* Row 3: SOG — light, flex 1.5 */}
      <div style={{ flex: 1.5, minHeight: 0, background: BG(3), position: 'relative', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
        <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(3)},0.4)` }}>SOG</span>
        <span style={{ fontSize: 'clamp(36px, 8vh, 72px)', fontWeight: 900, fontFamily: 'monospace', color: FG(3), lineHeight: 1 }}>
          {sog !== null ? sog.toFixed(1) : '—'}
        </span>
        <span style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 12, fontFamily: 'monospace', color: `rgba(${RGB(3)},0.4)` }}>KTS</span>
      </div>

      {/* Row 4: Roll — dark, flex 1.5 */}
      <div style={{ flex: 1.5, minHeight: 0, background: BG(4 % 2 === 0 ? 4 : 4), position: 'relative', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
        <span style={{ position: 'absolute', top: 6, left: 10, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(255,255,255,0.4)` }}>ROLL</span>
        {roll !== null ? (
          <span style={{ fontSize: 'clamp(36px, 8vh, 72px)', fontWeight: 900, fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>
            {roll >= 0 ? '+' : ''}{Number(roll).toFixed(1)}°
          </span>
        ) : (
          <button onClick={requestOrientation} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: 11, padding: '8px 14px', cursor: 'pointer', letterSpacing: '0.1em' }}>
            ENABLE MOTION
          </button>
        )}
        <span style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 12, fontFamily: 'monospace', color: `rgba(255,255,255,0.35)` }}>
          {roll !== null ? (roll > 1 ? 'PORT' : roll < -1 ? 'STBD' : 'LEVEL') : ''}
        </span>
      </div>

    </div>
  )
}

function Btn({ children, onClick, primary, fg, rgb }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 18px',
      background: primary ? FG_from(rgb) : 'transparent',
      border: `1px solid rgba(${rgb},0.35)`,
      color: primary ? BG_from(rgb) : `rgba(${rgb},0.8)`,
      fontFamily: 'monospace', fontWeight: 700, fontSize: 11,
      letterSpacing: '0.1em', cursor: 'pointer',
      minWidth: 72,
    }}>{children}</button>
  )
}

function PingBtn({ label, pinged, onClick, noGps }) {
  return (
    <button onClick={onClick} disabled={noGps} style={{
      padding: '6px 12px', flex: 1,
      background: pinged ? 'rgba(255,255,255,0.15)' : 'transparent',
      border: `1px solid rgba(255,255,255,${pinged ? 0.5 : 0.2})`,
      color: `rgba(255,255,255,${noGps ? 0.2 : pinged ? 0.9 : 0.55})`,
      fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.1em', cursor: noGps ? 'default' : 'pointer',
    }}>
      {pinged ? '✓ ' : ''}{label}
    </button>
  )
}

function FG_from(rgb) { return rgb === '0,0,0' ? '#000' : '#fff' }
function BG_from(rgb) { return rgb === '0,0,0' ? '#fff' : '#000' }
