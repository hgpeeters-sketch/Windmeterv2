import { useState, useEffect, useRef } from 'react'

function haversineDistance(p1, p2) {
  const toRad = d => d * Math.PI / 180
  const R = 6371000
  const dLat = toRad(p2.lat - p1.lat)
  const dLon = toRad(p2.lon - p1.lon)
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2) ** 2
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

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

function bearingTo(from, to) {
  const toRad = d => d * Math.PI / 180
  const toDeg = r => r * 180 / Math.PI
  const dLon = toRad(to.lon - from.lon)
  const lat1 = toRad(from.lat), lat2 = toRad(to.lat)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360
}

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

export default function StartSequenceView({ wind, remaining, running, onStartStop, onReset, onSync }) {
  const [time, setTime]       = useState('')
  const [boatPos, setBoatPos] = useState(null)
  const [notifPerm, setNotifPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )

  // Read line ends from localStorage (set by RaceAreaView)
  const [committee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_committee')) } catch { return null }
  })
  const [pin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_pin')) } catch { return null }
  })

  const countdownRef    = useRef(null)
  const [countdownFs, setCountdownFs] = useState(100)
  const distRef         = useRef(null)
  const [distFs, setDistFs] = useState(60)
  const lastNotifDist   = useRef(null)
  const lastNotifTime   = useRef(0)
  const ocsNotifSent    = useRef(false)

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      pos => setBoatPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPerm(result)
  }

  const started       = remaining === 0
  const urgent        = remaining <= 60 && running
  const countdownText = started ? 'GO' : fmt(remaining)

  useEffect(() => {
    const el = countdownRef.current; if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setCountdownFs(fitFontSize(countdownText, W * 0.88, H * 0.48))
    }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [countdownText])

  const lineDist  = (boatPos && committee && pin) ? distToLine(boatPos, committee, pin) : null
  const lineLength = (committee && pin) ? haversineDistance(committee, pin) : null
  const distText  = lineDist === null ? '—' : `${lineDist > 0 ? '+' : ''}${lineDist} m`
  const isOCS     = lineDist !== null && lineDist > 0 && remaining <= 60 && running

  useEffect(() => {
    const el = distRef.current; if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setDistFs(fitFontSize(distText, W * 0.88, H * 0.52))
    }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [distText])

  // Push distance to watch via mirrored phone notification.
  // tag:'line-dist' replaces the previous notification in place (no stacking).
  // Fires when distance changes by ≥ 3 m AND at least 8 s have elapsed.
  useEffect(() => {
    if (lineDist === null || notifPerm !== 'granted') return
    const now = Date.now()
    const distChanged = lastNotifDist.current === null || Math.abs(lineDist - lastNotifDist.current) >= 3
    const timeOk      = now - lastNotifTime.current >= 8000
    if (!distChanged || !timeOk) return
    lastNotifDist.current = lineDist
    lastNotifTime.current = now
    try {
      new Notification('Start Line', {
        body: `${lineDist > 0 ? '+' : ''}${lineDist} m  ${lineDist > 0 ? '▲ OVER LINE' : '▼ BEHIND LINE'}`,
        tag: 'line-dist',
        renotify: true,
        silent: true,
      })
    } catch {}
  }, [lineDist, notifPerm])

  // OCS alert: fires once when entering OCS state, rearms when cleared
  useEffect(() => {
    if (!isOCS) { ocsNotifSent.current = false; return }
    if (ocsNotifSent.current || notifPerm !== 'granted') return
    ocsNotifSent.current = true
    try {
      new Notification('⚠ OCS', {
        body: `+${lineDist} m over the line — ${remaining}s to go`,
        tag: 'ocs-alert',
        renotify: true,
        silent: false,
      })
    } catch {}
  }, [isOCS, notifPerm])

  let lineBias = null, biasEnd = null
  if (pin && committee && wind) {
    const lb = bearingTo(pin, committee)
    const sq = (wind.direction + 90 + 360) % 360
    lineBias = angleDiff(lb, sq)
    biasEnd  = lineBias > 0 ? 'PIN' : 'COMM'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      <div style={{ flex: 1, minHeight: 0, background: BG(0), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>START SEQUENCE</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>

      <div ref={countdownRef} style={{ flex: 3, minHeight: 0, background: BG(1), display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(1)},0.35)` }}>COUNTDOWN</span>
        <span style={{
          fontSize: countdownFs, fontWeight: 900, fontFamily: 'monospace',
          color: started ? `rgba(${RGB(1)},0.3)` : FG(1),
          lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          letterSpacing: urgent ? '0.05em' : '-0.02em',
        }}>
          {countdownText}
        </span>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <Btn onClick={onStartStop} primary={!running && !started} fg={FG(1)} rgb={RGB(1)}>
            {running ? 'PAUSE' : started ? 'DONE' : 'START'}
          </Btn>
          <Btn onClick={onReset} fg={FG(1)} rgb={RGB(1)}>RESET</Btn>
          <Btn onClick={onSync}  fg={FG(1)} rgb={RGB(1)}>SYNC</Btn>
        </div>
      </div>

      {/* Distance to line */}
      <div ref={distRef} style={{
        flex: 3, minHeight: 0,
        background: isOCS ? '#1e0000' : BG(2),
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 6,
        transition: 'background 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: isOCS ? 'rgba(255,80,80,0.7)' : `rgba(${RGB(2)},0.4)` }}>
            DISTANCE TO START LINE{lineLength !== null ? `  ·  LINE ${lineLength} m` : ''}
          </span>
          {notifPerm === 'default' && !isOCS && (
            <button onClick={requestNotifPermission} style={{
              padding: '3px 8px', background: 'transparent',
              border: `1px solid rgba(${RGB(2)},0.25)`,
              color: `rgba(${RGB(2)},0.5)`,
              fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.08em', cursor: 'pointer',
            }}>WATCH ⌚</button>
          )}
          {notifPerm === 'granted' && !isOCS && (
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: `rgba(${RGB(2)},0.35)`, letterSpacing: '0.08em' }}>⌚ WATCH ON</span>
          )}
          {isOCS && (
            <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#ff4444', letterSpacing: '0.2em' }}>⚠ OCS</span>
          )}
        </div>
        <span style={{
          fontSize: distFs, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1,
          color: isOCS ? '#ff3333'
            : lineDist === null ? `rgba(${RGB(2)},0.2)`
            : lineDist > 0 ? FG(2) : `rgba(${RGB(2)},0.65)`,
          letterSpacing: '-0.02em',
        }}>
          {distText}
        </span>
        {lineDist !== null && (
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: isOCS ? 'rgba(255,80,80,0.7)' : `rgba(${RGB(2)},0.5)` }}>
            {lineDist > 0 ? 'OVER LINE' : 'BEHIND LINE'}
          </span>
        )}
        {lineDist === null && (
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: `rgba(${RGB(2)},0.25)`, letterSpacing: '0.08em' }}>
            PING BOTH ENDS IN AREA TAB
          </span>
        )}
      </div>

      <div style={{ flex: 2, minHeight: 0, background: BG(3), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: `rgba(${RGB(3)},0.4)` }}>LINE BIAS</span>
        {lineBias !== null ? (
          <>
            <span style={{ fontSize: 'clamp(36px, 8vh, 64px)', fontWeight: 900, fontFamily: 'monospace', color: FG(3), lineHeight: 1, letterSpacing: '-0.02em' }}>
              {biasEnd} {Math.abs(lineBias).toFixed(1)}°
            </span>
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
      letterSpacing: '0.1em', cursor: 'pointer', minWidth: 90,
    }}>{children}</button>
  )
}

function FG_from(rgb) { return rgb === '0,0,0' ? '#000' : '#fff' }
function BG_from(rgb) { return rgb === '0,0,0' ? '#fff' : '#000' }
