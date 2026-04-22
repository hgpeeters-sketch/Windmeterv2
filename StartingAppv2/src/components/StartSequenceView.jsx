import { useState, useEffect, useRef } from 'react'
import { C, F, NUM_SHADOW } from '../theme'

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

const SL = ({ label, right }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 14px', borderBottom: `1px solid ${C.sep}`, flexShrink: 0,
  }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, letterSpacing: '0.28em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
    {right && <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, color: C.textDim }}>{right}</span>}
  </div>
)

export default function StartSequenceView({ wind, remaining, running, onStartStop, onReset, onSync }) {
  const [boatPos, setBoatPos] = useState(null)
  const [notifPerm, setNotifPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )

  const [committee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_committee')) } catch { return null }
  })
  const [pin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_pin')) } catch { return null }
  })

  const lastNotifDist   = useRef(null)
  const lastNotifTime   = useRef(0)
  const ocsNotifSent    = useRef(false)

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

  // Progress: proportion of the current minute elapsed
  const totalSecs = remaining % 60 || 60
  const progress  = running ? (1 - (remaining % 60) / 60) : 0

  const lineDist   = (boatPos && committee && pin) ? distToLine(boatPos, committee, pin) : null
  const lineLength = (committee && pin) ? haversineDistance(committee, pin) : null
  const isOCS      = lineDist !== null && lineDist > 0 && remaining <= 60 && running

  // Watch notification for line distance
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
        tag: 'line-dist', renotify: true, silent: true,
      })
    } catch {}
  }, [lineDist, notifPerm])

  useEffect(() => {
    if (!isOCS) { ocsNotifSent.current = false; return }
    if (ocsNotifSent.current || notifPerm !== 'granted') return
    ocsNotifSent.current = true
    try {
      new Notification('⚠ OCS', {
        body: `+${lineDist} m over the line — ${remaining}s to go`,
        tag: 'ocs-alert', renotify: true, silent: false,
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

  const timerColor = started ? C.textDim : urgent ? '#ff4444' : C.text

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: C.bg }}>

      {/* Countdown timer */}
      <div style={{ background: C.card, padding: '14px 14px 8px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontFamily: F.bc, fontWeight: 700, letterSpacing: '0.22em', color: C.textDim, textTransform: 'uppercase', marginBottom: 4 }}>
          START TIMER
        </div>
        <div style={{ fontSize: 96, fontFamily: F.bc, fontWeight: 800, color: timerColor, lineHeight: 0.9, letterSpacing: '-0.02em', textShadow: NUM_SHADOW, fontVariantNumeric: 'tabular-nums' }}>
          {countdownText}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 10, height: 3, background: C.sep, borderRadius: 2, overflow: 'hidden' }}>
          {running && (
            <div style={{
              width: `${Math.min(100, ((60 - (remaining % 60 || 60)) / 60) * 100)}%`,
              height: '100%',
              background: urgent ? '#ff4444' : C.cyan,
              borderRadius: 2,
              transition: 'width 1s linear',
            }} />
          )}
        </div>
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.sep}`, flexShrink: 0 }}>
        {[
          { label: running ? 'PAUSE' : started ? 'DONE' : 'START', primary: !running && !started, action: onStartStop },
          { label: 'RESET', action: onReset },
          { label: 'SYNC', action: onSync },
        ].map(({ label, primary, action }, i) => (
          <button key={i} onClick={action} style={{
            flex: 1, padding: '15px 0',
            background: primary ? C.cyanDim : 'transparent',
            border: 'none',
            borderRight: i < 2 ? `1px solid ${C.sep}` : 'none',
            color: primary ? C.cyan : C.textSub,
            fontFamily: F.bc, fontWeight: 700, fontSize: 13,
            letterSpacing: '0.15em', cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* Distance to line */}
      <SL
        label={lineLength ? `DISTANCE · LINE ${lineLength}m` : 'DISTANCE TO START LINE'}
        right={isOCS ? '⚠ OCS' : notifPerm === 'granted' ? '⌚ WATCH ON' : undefined}
      />
      <div style={{
        background: isOCS ? '#120000' : C.card,
        padding: '14px 14px 18px',
        flexShrink: 0,
        transition: 'background 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{
            fontSize: 72, fontFamily: F.bc, fontWeight: 800, lineHeight: 0.9, letterSpacing: '-0.02em',
            color: isOCS ? '#ff3333' : lineDist === null ? C.textDim : lineDist > 0 ? C.text : C.textSub,
            textShadow: NUM_SHADOW,
          }}>
            {lineDist === null ? '—' : `${lineDist > 0 ? '+' : ''}${lineDist}`}
          </span>
          {lineDist !== null && (
            <span style={{ fontSize: 22, fontFamily: F.bc, fontWeight: 700, color: isOCS ? '#ff3333' : C.cyan, marginBottom: 8, marginLeft: 6 }}>m</span>
          )}
        </div>
        {lineDist !== null && (
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: isOCS ? 'rgba(255,80,80,0.7)' : C.textSub }}>
            {lineDist > 0 ? 'OVER LINE' : 'BEHIND LINE'}
          </div>
        )}
        {lineDist === null && (
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.08em' }}>
            PING BOTH ENDS IN AREA TAB
          </div>
        )}
        {notifPerm === 'default' && (
          <button onClick={requestNotifPermission} style={{
            marginTop: 10, padding: '7px 14px',
            background: 'transparent', border: `1px solid ${C.sep}`, borderRadius: 4,
            color: C.textSub, fontFamily: F.bc, fontWeight: 700, fontSize: 10,
            letterSpacing: '0.1em', cursor: 'pointer',
          }}>ENABLE WATCH NOTIFICATIONS ⌚</button>
        )}
      </div>

      {/* Line bias */}
      <SL label="LINE BIAS" />
      <div style={{ background: C.card, padding: '14px 14px 18px', flexShrink: 0 }}>
        {lineBias !== null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 56, fontFamily: F.bc, fontWeight: 800, color: C.text, lineHeight: 0.9, textShadow: NUM_SHADOW }}>
                {biasEnd}
              </span>
              <span style={{ fontSize: 22, fontFamily: F.bc, fontWeight: 700, color: C.cyan, marginBottom: 6, marginLeft: 10 }}>
                {Math.abs(lineBias).toFixed(1)}°
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, fontFamily: F.bc, fontWeight: 600, color: C.textSub }}>
              {biasEnd === 'PIN' ? 'Port / pin end favoured' : 'Starboard / committee end favoured'}
              {Math.abs(lineBias) < 2 ? ' — nearly square' : Math.abs(lineBias) >= 10 ? ' — strongly' : ''}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textDim, letterSpacing: '0.08em' }}>
            PING BOTH ENDS TO CALCULATE
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
