import { useState, useCallback, useEffect, useRef } from 'react'
import PreStartView from './components/PreStartView'
import RaceAreaView from './components/RaceAreaView'
import CourseAnalysisView from './components/CourseAnalysisView'
import StartSequenceView from './components/StartSequenceView'
import DashboardView from './components/DashboardView'
import SettingsView from './components/SettingsView'

const TABS = [
  { label: 'PRE-START',  short: 'PRE'    },
  { label: 'RACE AREA',  short: 'AREA'   },
  { label: 'COURSE',     short: 'COURSE' },
  { label: 'START',      short: 'START'  },
  { label: 'RACING',     short: 'RACING' },
  { label: '⚙',          short: '⚙',  gear: true },
]

const TOTAL      = 5 * 60
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)
  const [manualTwd, setManualTwd] = useState(loadTwd)
  const [manualSamples, setManualSamples] = useState(loadSamples)

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

  // ── Timer lives here so it keeps running across tab switches ──────────
  const [remaining, setRemaining] = useState(() => {
    const v = localStorage.getItem('sl_remaining')
    return v !== null ? Math.max(0, parseInt(v)) : TOTAL
  })
  const [timerRunning, setTimerRunning] = useState(false)
  const runningRef   = useRef(false)
  const remainingRef = useRef(remaining)

  // ── Audio (Web Audio API) ─────────────────────────────────────────────
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
        setTimeout(() => setTab(4), 800)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function handleTimerStartStop() {
    if (remainingRef.current <= 0) return
    const next = !runningRef.current
    if (next) {
      unlockAudio(() => beep(660, 0.12, 0.8))
    }
    runningRef.current = next
    setTimerRunning(next)
  }

  function handleTimerReset() {
    runningRef.current = false
    remainingRef.current = TOTAL
    setTimerRunning(false)
    setRemaining(TOTAL)
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

  // ── Fullscreen ────────────────────────────────────────────────────────
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

  return (
    <div style={{
      background: '#000',
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'monospace',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        {tab === 5 && <SettingsView />}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ display: 'flex', height: 44, flexShrink: 0 }}>
        {TABS.map(({ label, short, gear }, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{
              flex: gear ? 0.5 : 1, background: '#000', border: 'none',
              borderRight: i < TABS.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              color: tab === i ? '#fff' : 'rgba(255,255,255,0.28)',
              fontFamily: 'monospace', fontWeight: 700,
              fontSize: gear ? 16 : 8,
              letterSpacing: gear ? 0 : '0.08em',
              cursor: 'pointer', padding: 0,
            }}
          >{short}</button>
        ))}
        <button
          onClick={toggleFullscreen}
          style={{
            width: 36, background: '#000', border: 'none',
            borderLeft: '1px solid rgba(255,255,255,0.12)',
            color: isStandalone ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)',
            fontSize: isIOS ? 11 : 14,
            cursor: isStandalone ? 'default' : 'pointer', padding: 0, flexShrink: 0,
          }}
        >{isIOS ? (isStandalone ? '⊠' : '⛶') : (isFullscreen ? '⊠' : '⛶')}</button>
      </div>

      {showIosHint && (
        <div onClick={() => setShowIosHint(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 60px', zIndex: 999,
        }}>
          <div style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.15)',
            padding: '20px 22px', maxWidth: 340, width: '100%',
          }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>FULLSCREEN ON iOS</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#fff', lineHeight: 1.8 }}>
              1. Tap the <strong style={{ color: '#fff' }}>Share</strong> button (⬜↑) in Safari
            </div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#fff', lineHeight: 1.8 }}>
              2. Tap <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong>
            </div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#fff', lineHeight: 1.8 }}>
              3. Open the app from your home screen
            </div>
            <div style={{ marginTop: 14, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>Tap anywhere to dismiss</div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; background: #000; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default App
