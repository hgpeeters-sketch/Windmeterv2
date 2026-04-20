import { useState } from 'react'
import { getApiKey, setApiKey } from '../anthropic'

function Row({ label, children }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px' }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export default function SettingsView() {
  const [key, setKey] = useState(getApiKey)
  const [saved, setSaved] = useState(false)

  function save() {
    setApiKey(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasKey = key.trim().length > 0
  const masked = hasKey ? key.trim().slice(0, 10) + '••••••••••••••••' : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>
          SETTINGS
        </span>
      </div>

      {/* API Key */}
      <Row label="ANTHROPIC API KEY">
        <input
          value={key}
          onChange={e => { setKey(e.target.value); setSaved(false) }}
          placeholder="sk-ant-..."
          type="password"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontFamily: 'monospace', fontSize: 13,
            padding: '10px 12px', outline: 'none',
          }}
        />
        {hasKey && (
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>
            Stored: {masked}
          </div>
        )}
        <button
          onClick={save}
          style={{
            marginTop: 12, width: '100%', padding: '14px 0',
            background: saved ? 'rgba(255,255,255,0.15)' : '#fff',
            border: 'none', color: saved ? '#fff' : '#000',
            fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
            letterSpacing: '0.15em', cursor: 'pointer',
          }}
        >
          {saved ? '✓  SAVED' : 'SAVE KEY'}
        </button>
        <div style={{ marginTop: 10, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', lineHeight: 1.7 }}>
          Get your key at console.anthropic.com — it's stored locally on this device only and used solely for the Race Area wind analysis.
        </div>
      </Row>

      {/* About */}
      <Row label="ABOUT">
        <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
          <div>WindMeter v2</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Calypso UP10 · Claude AI</div>
        </div>
      </Row>

    </div>
  )
}
