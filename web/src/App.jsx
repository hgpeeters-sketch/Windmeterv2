import { useState } from 'react'
import { useWindData } from './useWindData'
import PreStartView from './components/PreStartView'
import RaceAreaView from './components/RaceAreaView'
import DashboardView from './components/DashboardView'
import SettingsView from './components/SettingsView'

const TABS = ['PRE-START', 'RACE AREA', 'RACING', '⚙']

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
        {tab === 2 && <DashboardView wind={wind} />}
        {tab === 3 && <SettingsView />}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ display: 'flex', height: 44, flexShrink: 0 }}>
        {TABS.map((label, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{
              flex: i === 3 ? 0.4 : 1, background: '#000', border: 'none',
              borderRight: i < TABS.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              color: tab === i ? '#fff' : 'rgba(255,255,255,0.28)',
              fontFamily: 'monospace', fontWeight: 700,
              fontSize: i === 3 ? 16 : 9,
              letterSpacing: i === 3 ? 0 : '0.15em',
              cursor: 'pointer',
            }}
          >{label}</button>
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
