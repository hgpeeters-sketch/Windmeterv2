import { useState, useCallback } from 'react'
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

  const wind = { direction: manualTwd ?? 0 }

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
        {tab === 0 && <PreStartView />}
        {tab === 1 && <RaceAreaView manualTwd={manualTwd} logWindDir={logWindDir} samples={manualSamples} />}
        {tab === 2 && <CourseAnalysisView wind={wind} samples={manualSamples} />}
        {tab === 3 && <StartSequenceView wind={wind} onTimerEnd={() => setTab(4)} />}
        {tab === 4 && <DashboardView />}
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
