import { useState, useCallback, useEffect, useRef } from 'react'
import { useWindData } from './useWindData'
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

const TOTAL = 5 * 60

function App() {
  const { wind, samples, speedBuckets } = useWindData()
  const [tab, setTab] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  function beep(freq, dur, vol = 0.35, delay = 0) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(vol, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t); osc.stop(t + dur + 0.05)
    } catch {}
  }

  function playSignal(r) {
    if (r === 0) {
      // GO — three ascending tones
      beep(660, 0.18, 0.4, 0); beep(880, 0.18, 0.4, 0.25); beep(1100, 0.5, 0.5, 0.5)
    } else if (r <= 15) {
      // Final 15 s — quick tick every second
      beep(880, 0.07, 0.3)
    } else if (r <= 60 && r % 10 === 0) {
      // Last minute — double beep every 10 s
      beep(660, 0.1, 0.35, 0); beep(660, 0.1, 0.35, 0.22)
    } else if (r % 60 === 0) {
      // Each full minute — single longer beep
      beep(440, 0.45, 0.4)
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

  return (
    <div style={{
      background: '#000',
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'monospace',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 0 && <PreStartView wind={wind} samples={samples} speedBuckets={speedBuckets} />}
        {tab === 1 && <RaceAreaView wind={wind} samples={samples} speedBuckets={speedBuckets} />}
        {tab === 2 && <CourseAnalysisView wind={wind} samples={samples} />}
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
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          style={{
            width: 36, background: '#000', border: 'none',
            borderLeft: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.35)', fontSize: 14,
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        >{isFullscreen ? '⊠' : '⛶'}</button>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default App
