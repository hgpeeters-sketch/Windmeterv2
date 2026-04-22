import { useState, useCallback, useEffect, useRef } from 'react'
import PreStartView from './components/PreStartView'
import RaceAreaView from './components/RaceAreaView'
import CourseAnalysisView from './components/CourseAnalysisView'
import StartSequenceView from './components/StartSequenceView'
import DashboardView from './components/DashboardView'
import TrackView from './components/TrackView'
import SettingsView from './components/SettingsView'
import { C, F } from './theme'

const TABS = [
  { label: 'PRE',    short: 'PRE'   },
  { label: 'AREA',   short: 'AREA'  },
  { label: '+',      short: '+', isPlus: true },
  { label: 'START',  short: 'START' },
  { label: 'RACE',   short: 'RACE'  },
  { label: 'TRACK',  short: 'TRACK' },
]

const getTotal = () => parseInt(localStorage.getItem('timerMinutes') || '5') * 60
const isIOS        = /iPhone|iPad|iPod/.test(navigator.userAgent)
const isStandalone = window.navigator.standalone === true

function loadSamples() {
  try {
    const raw = localStorage.getItem('v2_manualSamples')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const cutoff = Date.now() - 35 * 60_000
    return parsed.filter(s => s.time >= cutoff)
  } catch { return [] }
}

function loadTwd() {
  const v = localStorage.getItem('v2_manualTwd')
  return v !== null ? parseInt(v) : null
}

function App() {
  const [tab, setTab] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)
  const [manualTwd, setManualTwd] = useState(loadTwd)
  const [manualSamples, setManualSamples] = useState(loadSamples)
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      const s = String(d.getSeconds()).padStart(2, '0')
      setClock(`${h}:${m}:${s}`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  function logWindDir(dir) {
    const now = Date.now()
    const sample = { time: now, direction: dir }
    setManualTwd(dir)
    localStorage.setItem('v2_manualTwd', dir)
    setManualSamples(prev => {
      const updated = [...prev.filter(s => now - s.time < 35 * 60_000), sample]
      localStorage.setItem('v2_manualSamples', JSON.stringify(updated))
      return updated
    })
  }

  // ── Timer ──────────────────────────────────────────────────────────────
  const [remaining, setRemaining] = useState(() => {
    const v = localStorage.getItem('sl_remaining')
    return v !== null ? Math.max(0, parseInt(v)) : getTotal()
  })
  const [timerRunning, setTimerRunning] = useState(false)
  const runningRef   = useRef(false)
  const remainingRef = useRef(remaining)

  const audioCtxRef = useRef(null)

  function beep(freq, dur, vol = 0.8, delay = 0) {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state !== 'running') return
    try {
      const dbGain    = parseFloat(localStorage.getItem('beepVolDb') ?? '0')
      const amplitude = Math.min(1.5, vol * Math.pow(10, dbGain / 20))
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(amplitude, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t); osc.stop(t + dur + 0.05)
    } catch {}
  }

  function unlockAudio(then) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume().then(then).catch(() => {})
      } else {
        then()
      }
    } catch {}
  }

  function playSignal(r) {
    if (r === 0) {
      beep(660, 0.18, 0.9, 0); beep(880, 0.18, 0.9, 0.25); beep(1100, 0.5, 1.0, 0.5)
    } else if (r <= 15) {
      beep(880, 0.08, 0.75)
    } else if (r <= 60 && r % 10 === 0) {
      beep(660, 0.12, 0.8, 0); beep(660, 0.12, 0.8, 0.22)
    } else if (r % 60 === 0) {
      beep(440, 0.5, 0.8)
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (!runningRef.current) return
      const r = remainingRef.current - 1
      remainingRef.current = r
      setRemaining(r)
      localStorage.setItem('sl_remaining', r)
      playSignal(r)
      if (r <= 0) {
        runningRef.current = false
        setTimerRunning(false)
        setTimeout(() => { setShowSettings(false); setTab(5) }, 800)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function handleTimerStartStop() {
    if (remainingRef.current <= 0) return
    const next = !runningRef.current
    if (next) unlockAudio(() => beep(660, 0.12, 0.8))
    runningRef.current = next
    setTimerRunning(next)
  }

  function handleTimerReset() {
    const total = getTotal()
    runningRef.current = false
    remainingRef.current = total
    setTimerRunning(false)
    setRemaining(total)
    localStorage.removeItem('sl_remaining')
  }

  function handleTimerSync() {
    const r    = remainingRef.current
    const secs = r % 60
    const next = Math.max(0, secs > 30 ? r + (60 - secs) : r - secs)
    remainingRef.current = next
    setRemaining(next)
    localStorage.setItem('sl_remaining', next)
  }

  // ── Wake Lock ──────────────────────────────────────────────────────────
  const wakeLockRef = useRef(null)
  const [wakeLockOn, setWakeLockOn] = useState(false)

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeLockOn(true)
      wakeLockRef.current.addEventListener('release', () => setWakeLockOn(false))
    } catch {}
  }

  useEffect(() => {
    acquireWakeLock()
    const onVisible = () => { if (document.visibilityState === 'visible') acquireWakeLock() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── Fullscreen ─────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (isIOS) {
      if (!isStandalone) setShowIosHint(h => !h)
      return
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {})
    } else {
      document.exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {})
    }
  }, [])

  const wind = { direction: manualTwd ?? 0 }
  const tabLabel = showSettings ? 'SETTINGS' : (TABS[tab]?.label ?? '')

  return (
    <div style={{
      background: C.bg,
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: F.bc,
      maxWidth: 430,
      margin: '0 auto',
    }}>
      {/* Header bar */}
      <div style={{
        height: 34, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 14, paddingRight: 10,
        borderBottom: `1px solid ${C.sep}`,
        background: C.bg,
      }}>
        <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 11, letterSpacing: '0.25em', color: C.cyan, textTransform: 'uppercase' }}>
          {tabLabel}
        </span>
        <span style={{ fontFamily: F.bc, fontWeight: 600, fontSize: 12, color: C.textDim, letterSpacing: '0.08em' }}>
          {clock}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {showSettings ? (
          <SettingsView />
        ) : (
          <>
            {tab === 0 && <PreStartView />}
            {tab === 1 && <RaceAreaView manualTwd={manualTwd} logWindDir={logWindDir} samples={manualSamples} />}
            {tab === 2 && <CourseAnalysisView wind={wind} samples={manualSamples} />}
            {tab === 3 && (
              <StartSequenceView
                wind={wind}
                remaining={remaining}
                running={timerRunning}
                onStartStop={handleTimerStartStop}
                onReset={handleTimerReset}
                onSync={handleTimerSync}
              />
            )}
            {tab === 4 && <DashboardView wind={wind} />}
            {tab === 5 && <TrackView remaining={remaining} twd={manualTwd} samples={manualSamples} />}
          </>
        )}
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: C.sep, flexShrink: 0 }} />

      {/* Tab bar */}
      <div style={{ display: 'flex', height: 46, flexShrink: 0, background: C.bg }}>
        {TABS.map(({ short, isPlus }, i) => {
          const active = !showSettings && tab === i
          return (
            <button
              key={i}
              onClick={() => { setShowSettings(false); setTab(i) }}
              style={{
                flex: isPlus ? 0.65 : 1,
                background: C.bg,
                border: 'none',
                borderTop: `2px solid ${active ? C.cyan : 'transparent'}`,
                borderRight: i < TABS.length - 1 ? `1px solid ${C.sep}` : 'none',
                color: active ? C.cyan : C.textDim,
                fontFamily: F.bc,
                fontWeight: 700,
                fontSize: isPlus ? 20 : 9,
                letterSpacing: isPlus ? 0 : '0.12em',
                cursor: 'pointer',
                padding: 0,
                lineHeight: isPlus ? '46px' : undefined,
              }}
            >{short}</button>
          )
        })}

        {/* Wake lock dot + gear + fullscreen */}
        <div style={{
          display: 'flex', alignItems: 'center',
          borderLeft: `1px solid ${C.sep}`,
          borderTop: `2px solid ${showSettings ? C.cyan : 'transparent'}`,
          flexShrink: 0,
        }}>
          <span title={wakeLockOn ? 'Screen on' : 'Screen lock inactive'} style={{
            width: 16, textAlign: 'center', fontSize: 6,
            color: wakeLockOn ? C.cyan : C.sep,
          }}>●</span>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{
              width: 28, height: '100%',
              background: C.bg, border: 'none',
              color: showSettings ? C.cyan : C.textDim,
              fontSize: 15, cursor: 'pointer', padding: 0,
              fontFamily: 'monospace',
            }}
          >⚙</button>
          <button
            onClick={toggleFullscreen}
            style={{
              width: 26, height: '100%',
              background: C.bg, border: 'none',
              color: isStandalone ? C.sep : C.textDim,
              fontSize: isIOS ? 11 : 13,
              cursor: isStandalone ? 'default' : 'pointer',
              padding: 0, fontFamily: 'monospace',
            }}
          >{isIOS ? (isStandalone ? '⊠' : '⛶') : (isFullscreen ? '⊠' : '⛶')}</button>
        </div>
      </div>

      {showIosHint && (
        <div onClick={() => setShowIosHint(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 60px', zIndex: 999,
        }}>
          <div style={{
            background: C.card, border: `1px solid ${C.sep}`,
            padding: '20px 22px', maxWidth: 340, width: '100%',
          }}>
            <div style={{ fontSize: 11, fontFamily: F.bc, letterSpacing: '0.2em', color: C.textDim, marginBottom: 12 }}>FULLSCREEN ON iOS</div>
            <div style={{ fontSize: 13, fontFamily: F.b, color: C.text, lineHeight: 1.8 }}>
              1. Tap the <strong style={{ color: C.cyan }}>Share</strong> button (⬜↑) in Safari
            </div>
            <div style={{ fontSize: 13, fontFamily: F.b, color: C.text, lineHeight: 1.8 }}>
              2. Tap <strong style={{ color: C.cyan }}>"Add to Home Screen"</strong>
            </div>
            <div style={{ fontSize: 13, fontFamily: F.b, color: C.text, lineHeight: 1.8 }}>
              3. Open the app from your home screen
            </div>
            <div style={{ marginTop: 14, fontSize: 10, fontFamily: F.bc, color: C.textDim }}>Tap anywhere to dismiss</div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; background: ${C.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default App
