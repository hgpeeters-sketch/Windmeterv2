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

// True bearing (degrees) from GPS point A to point B
function bearingTo(from, to) {
  const toRad = d => d * Math.PI / 180
  const toDeg = r => r * 180 / Math.PI
  const dLon = toRad(to.lon - from.lon)
  const lat1 = toRad(from.lat), lat2 = toRad(to.lat)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360
}

// Normalise angle difference to [-180, 180]
function angleDiff(a, b) {
  let d = a - b
  while (d >  180) d -= 360
  while (d < -180) d += 360
  return d
}

function fmt(s) {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const BG  = i => i % 2 === 0 ? '#000' : '#fff'
const FG  = i => i % 2 === 0 ? '#fff' : '#000'
const RGB = i => i % 2 === 0 ? '255,255,255' : '0,0,0'

function fitFontSize(text, W, H, weight = '900') {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let fs = Math.floor(H * 0.88)
  while (fs > 20) {
    ctx.font = `${weight} ${fs}px monospace`
    if (ctx.measureText(text).width <= W - 8) break
    fs -= 2
  }
  return fs
}

export default function StartSequenceView({ onTimerEnd, wind }) {
  const [remaining, setRemaining] = useState(5 * 60)
  const [running, setRunning]     = useState(false)
  const [time, setTime]           = useState('')

  // GPS
  const [boatPos, setBoatPos]     = useState(null)
  const [committee, setCommittee] = useState(null)
  const [pin, setPin]             = useState(null)
  const [gpsError, setGpsError]   = useState(null)

  // Auto-fit for countdown
  const countdownRef = useRef(null)
  const [countdownFs, setCountdownFs] = useState(100)

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
        if (r <= 1) {
          setRunning(false)
          setTimeout(() => onTimerEnd?.(), 800)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, onTimerEnd])

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return }
    const id = navigator.geolocation.watchPosition(
      pos => {
        setBoatPos({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGpsError(null)
      },
      err => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const started = remaining === 0
  const urgent  = remaining <= 60 && running
  const countdownText = started ? 'GO' : fmt(remaining)

  useEffect(() => {
    const el = countdownRef.current; if (!el) return
    const compute = () => { const {clientWidth:W,clientHeight:H}=el; if(W&&H) setCountdownFs(fitFontSize(countdownText,W*0.88,H*0.48)) }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [countdownText])

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

  // Line bias: bearing from pin to committee vs square-to-wind line (TWD + 90)
  let lineBias = null, biasEnd = null
  if (pin && committee && wind) {
    const lb  = bearingTo(pin, committee)
    const sq  = (wind.direction + 90 + 360) % 360
    lineBias  = angleDiff(lb, sq)
    biasEnd   = lineBias > 0 ? 'PIN' : 'COMM'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Header — dark, flex 1 */}
      <div style={{ flex: 1, minHeight: 0, background: BG(0), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>START SEQUENCE</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      {/* Row 1: Countdown — light, flex 3 */}
      <div ref={countdownRef} style={{ flex: 3, minHeight: 0, background: BG(1), display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(1)},0.35)` }}>
          COUNTDOWN
        </span>
        <span style={{
          fontSize: countdownFs,
          fontWeight: 900, fontFamily: 'monospace',
          color: started ? `rgba(${RGB(1)},0.3)` : FG(1),
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: urgent ? '0.05em' : '-0.02em',
        }}>
          {countdownText}
        </span>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <Btn onClick={() => setRunning(r => !r)} primary={!running && !started} fg={FG(1)} rgb={RGB(1)}>
            {running ? 'PAUSE' : started ? 'DONE' : 'START'}
          </Btn>
          <Btn onClick={() => { setRunning(false); setRemaining(5 * 60) }} fg={FG(1)} rgb={RGB(1)}>RESET</Btn>
          <Btn onClick={sync} fg={FG(1)} rgb={RGB(1)}>SYNC</Btn>
        </div>
      </div>

      {/* Row 2: Line distance — dark, flex 2.5 */}
      <div style={{ flex: 2.5, minHeight: 0, background: BG(2), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 10 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(2)},0.4)` }}>DISTANCE TO START LINE</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 'clamp(32px, 7vh, 58px)', fontWeight: 900, fontFamily: 'monospace', color: lineDist === null ? 'rgba(255,255,255,0.2)' : lineDist > 0 ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
            {lineDist === null ? '—  m' : `${lineDist > 0 ? '+' : ''}${lineDist} m`}
          </span>
          {lineDist !== null && (
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: lineDist > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)' }}>
              {lineDist > 0 ? '⚠ OVER LINE' : 'BEHIND LINE'}
            </span>
          )}
        </div>
        {/* Ping buttons — always tappable to re-ping */}
        <div style={{ display: 'flex', gap: 8 }}>
          <PingBtn label="COMMITTEE" pinged={!!committee} onClick={() => ping('committee')} noGps={!boatPos} />
          <PingBtn label="PIN END"   pinged={!!pin}       onClick={() => ping('pin')}       noGps={!boatPos} />
        </div>
        {gpsError && <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>GPS: {gpsError}</span>}
      </div>

      {/* Row 3: Line bias — light, flex 2 */}
      <div style={{ flex: 2, minHeight: 0, background: BG(3), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(3)},0.4)` }}>LINE BIAS</span>
        {lineBias !== null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 'clamp(36px, 8vh, 64px)', fontWeight: 900, fontFamily: 'monospace', color: FG(3), lineHeight: 1, letterSpacing: '-0.02em' }}>
                {biasEnd} {Math.abs(lineBias).toFixed(1)}°
              </span>
            </div>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: `rgba(${RGB(3)},0.5)` }}>
              {biasEnd === 'PIN' ? 'Port / pin end favoured' : 'Starboard / committee end favoured'}
              {Math.abs(lineBias) < 2 ? ' — nearly square' : Math.abs(lineBias) >= 10 ? ' — strongly' : ''}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: `rgba(${RGB(3)},0.25)`, letterSpacing: '0.08em' }}>
            PING BOTH ENDS TO CALCULATE
          </span>
        )}
      </div>

    </div>
  )
}

function Btn({ children, onClick, primary, fg, rgb }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 22px',
      background: primary ? FG_from(rgb) : 'transparent',
      border: `1px solid rgba(${rgb},0.35)`,
      color: primary ? BG_from(rgb) : `rgba(${rgb},0.8)`,
      fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
      letterSpacing: '0.1em', cursor: 'pointer',
      minWidth: 90,
    }}>{children}</button>
  )
}

function PingBtn({ label, pinged, onClick, noGps }) {
  return (
    <button onClick={onClick} disabled={noGps} style={{
      padding: '10px 12px', flex: 1,
      background: pinged ? 'rgba(255,255,255,0.15)' : 'transparent',
      border: `1px solid rgba(255,255,255,${pinged ? 0.5 : 0.2})`,
      color: `rgba(255,255,255,${noGps ? 0.2 : pinged ? 0.9 : 0.55})`,
      fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.1em', cursor: noGps ? 'default' : 'pointer',
    }}>
      {pinged ? '✓ ' : ''}{label}{pinged ? ' ↺' : ''}
    </button>
  )
}

function FG_from(rgb) { return rgb === '0,0,0' ? '#000' : '#fff' }
function BG_from(rgb) { return rgb === '0,0,0' ? '#fff' : '#000' }
