import { useState } from 'react'
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

function App() {
  const { wind, samples, speedBuckets } = useWindData()
  const [tab, setTab] = useState(0)

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
        {tab === 3 && <StartSequenceView wind={wind} onTimerEnd={() => setTab(4)} />}
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
