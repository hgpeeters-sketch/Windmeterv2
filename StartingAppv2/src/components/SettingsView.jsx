import { useState } from 'react'
import { getApiKey, setApiKey } from '../anthropic'
import { C, F } from '../theme'

const ROLL_RATES = [
  { label: 'FAST',      ms: 150  },
  { label: 'MEDIUM',    ms: 500  },
  { label: 'SLOW',      ms: 1200 },
  { label: 'VERY SLOW', ms: 2500 },
]

const BEEP_VOLS = [
  { label: 'QUIET',  db: -12 },
  { label: 'MEDIUM', db: -6  },
  { label: 'LOUD',   db: 0   },
  { label: 'MAX',    db: 6   },
]

const TIMER_OPTS = [
  { label: '3 MIN',  min: 3  },
  { label: '5 MIN',  min: 5  },
  { label: '10 MIN', min: 10 },
]

const SL = ({ label }) => (
  <div style={{ padding: '8px 14px 7px', borderBottom: `1px solid ${C.sep}` }}>
    <span style={{ fontFamily: F.bc, fontWeight: 700, fontSize: 9, letterSpacing: '0.28em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
  </div>
)

function PillGroup({ options, value, onChange, keyProp }) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.sep}` }}>
      {options.map((opt, i) => {
        const active = opt[keyProp] === value
        return (
          <button
            key={opt[keyProp]}
            onClick={() => onChange(opt[keyProp])}
            style={{
              flex: 1, padding: '10px 4px',
              background: active ? C.cyanDim : C.card,
              border: 'none',
              borderRight: i < options.length - 1 ? `1px solid ${C.sep}` : 'none',
              color: active ? C.cyan : C.textSub,
              fontFamily: F.bc, fontWeight: 700, fontSize: 10,
              letterSpacing: '0.08em', cursor: 'pointer',
            }}
          >{opt.label}</button>
        )
      })}
    </div>
  )
}

export default function SettingsView() {
  const [key, setKey] = useState(getApiKey)
  const [saved, setSaved] = useState(false)
  const [rollMs, setRollMs] = useState(
    () => parseInt(localStorage.getItem('rollRefreshMs') || '500')
  )
  const [beepDb, setBeepDb] = useState(
    () => parseFloat(localStorage.getItem('beepVolDb') ?? '0')
  )
  const [timerMin, setTimerMin] = useState(
    () => parseInt(localStorage.getItem('timerMinutes') || '5')
  )

  function save() {
    setApiKey(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function selectRollRate(ms) {
    setRollMs(ms)
    localStorage.setItem('rollRefreshMs', ms)
  }

  function selectBeepVol(db) {
    setBeepDb(db)
    localStorage.setItem('beepVolDb', db)
  }

  function selectTimer(min) {
    setTimerMin(min)
    localStorage.setItem('timerMinutes', min)
    localStorage.removeItem('sl_remaining')
  }

  const hasKey = key.trim().length > 0
  const masked = hasKey ? key.trim().slice(0, 10) + '••••••••••••••••' : ''

  const section = { background: C.card, padding: '14px', borderBottom: `1px solid ${C.sep}` }
  const hint    = { marginTop: 8, fontSize: 11, fontFamily: F.bc, fontWeight: 500, color: C.textDim, lineHeight: 1.6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflowY: 'auto' }}>

      <SL label="START TIMER DURATION" />
      <div style={section}>
        <PillGroup options={TIMER_OPTS} value={timerMin} onChange={selectTimer} keyProp="min" />
        <div style={hint}>Takes effect on next RESET. Default is 5 minutes.</div>
      </div>

      <SL label="BEEP VOLUME" />
      <div style={section}>
        <PillGroup options={BEEP_VOLS} value={beepDb} onChange={selectBeepVol} keyProp="db" />
        <div style={hint}>
          {beepDb === -12 ? '−12 dB' : beepDb === -6 ? '−6 dB' : beepDb === 0 ? '0 dB (default)' : '+6 dB'}
          {' · '}Controls timer signal volume.
        </div>
      </div>

      <SL label="ROLL REFRESH RATE" />
      <div style={section}>
        <PillGroup options={ROLL_RATES} value={rollMs} onChange={selectRollRate} keyProp="ms" />
        <div style={hint}>Controls how often the heel reading updates in RACE. Slower = smoother.</div>
      </div>

      <SL label="ANTHROPIC API KEY" />
      <div style={section}>
        <input
          value={key}
          onChange={e => { setKey(e.target.value); setSaved(false) }}
          placeholder="sk-ant-..."
          type="password"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.cardAlt, border: `1px solid ${C.sep}`,
            color: C.text, fontFamily: F.b, fontSize: 13,
            padding: '10px 12px', outline: 'none', borderRadius: 4,
          }}
        />
        {hasKey && (
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: F.bc, fontWeight: 600, color: C.textSub }}>
            Stored: {masked}
          </div>
        )}
        <button
          onClick={save}
          style={{
            marginTop: 12, width: '100%', padding: '14px 0',
            background: saved ? C.cyanDim : C.cyan,
            border: `1px solid ${C.cyan}`, borderRadius: 6,
            color: saved ? C.cyan : C.bg,
            fontFamily: F.bc, fontWeight: 700, fontSize: 13,
            letterSpacing: '0.15em', cursor: 'pointer',
          }}
        >{saved ? '✓  SAVED' : 'SAVE KEY'}</button>
        <div style={hint}>Get your key at console.anthropic.com — stored locally on this device only.</div>
      </div>

      <SL label="ABOUT" />
      <div style={{ ...section, borderBottom: 'none' }}>
        <div style={{ fontSize: 24, fontFamily: F.bc, fontWeight: 800, color: C.text, marginBottom: 4 }}>WindMeter v3.0</div>
        <div style={{ fontSize: 12, fontFamily: F.bc, fontWeight: 600, color: C.textSub, letterSpacing: '0.08em' }}>Manual TWD · Claude AI</div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
