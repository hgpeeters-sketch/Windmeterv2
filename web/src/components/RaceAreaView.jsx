import { useState, useEffect, useRef } from 'react'
import { compassLabel } from '../useWindData'
import { analyzeWind, computeStats, getApiKey } from '../anthropic'
import OscillationChart from './OscillationChart'
import SpeedHistoryChart from './SpeedHistoryChart'

const TARGET_SECS = 15 * 60

function timeFormatted(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

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

// ── Stat box ───────────────────────────────────────────────────────
function StatBox({ top, value, bottom, half }) {
  const containerRef = useRef(null)
  const [fontSize, setFontSize] = useState(44)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const { clientWidth: W, clientHeight: H } = el
      if (W && H) setFontSize(fitFontSize(value, W * (half ? 0.85 : 0.75), H * 0.55))
    }
    const ro = new ResizeObserver(compute)
    ro.observe(el); compute()
    return () => ro.disconnect()
  }, [value, half])

  return (
    <div ref={containerRef} style={{ flex: half ? 1 : undefined, padding: '12px 0', textAlign: 'center', borderRight: half ? '1px solid rgba(255,255,255,0.12)' : undefined }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{top}</div>
      <div style={{ fontSize, fontWeight: 900, fontFamily: 'monospace', color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{bottom}</div>
    </div>
  )
}

function LiveWindRow({ wind }) {
  const twdRef = useRef(null)
  const twsRef = useRef(null)
  const [twdFs, setTwdFs] = useState(52)
  const [twsFs, setTwsFs] = useState(52)
  const twdText = `${wind.direction}°`
  const twsText = (wind.speedMps * 1.94384).toFixed(1)

  useEffect(() => {
    const el = twdRef.current; if (!el) return
    const compute = () => { const {clientWidth:W,clientHeight:H}=el; if(W&&H) setTwdFs(fitFontSize(twdText,W*0.75,H*0.72)) }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [twdText])

  useEffect(() => {
    const el = twsRef.current; if (!el) return
    const compute = () => { const {clientWidth:W,clientHeight:H}=el; if(W&&H) setTwsFs(fitFontSize(twsText,W*0.85,H*0.72)) }
    const ro = new ResizeObserver(compute); ro.observe(el); compute()
    return () => ro.disconnect()
  }, [twsText])

  return (
    <div style={{ display: 'flex', background: '#000' }}>
      <div ref={twdRef} style={{ flex: 1, padding: '10px 0 8px 16px' }}>
        <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>TWD</div>
        <span style={{ fontSize: twdFs, fontWeight: 900, fontFamily: 'monospace', color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{twdText}</span>
        <span style={{ fontSize: Math.max(14, twdFs * 0.38), fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{compassLabel(wind.direction)}</span>
      </div>
      <div style={{ width: 1, background: 'rgba(255,255,255,0.12)' }} />
      <div ref={twsRef} style={{ flex: 1, padding: '10px 0 8px 16px' }}>
        <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>TWS</div>
        <span style={{ fontSize: twsFs, fontWeight: 900, fontFamily: 'monospace', color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{twsText}</span>
        <span style={{ fontSize: Math.max(12, twsFs * 0.32), fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>KTS</span>
      </div>
    </div>
  )
}

export default function RaceAreaView({ wind, samples, speedBuckets }) {
  const [phase, setPhase] = useState('waiting')  // waiting | collecting | analyzing | done
  const [elapsed, setElapsed] = useState(0)
  const [raceSamples, setRaceSamples] = useState([])
  const [result, setResult] = useState(null)   // { stats, summary }
  const [errorMsg, setErrorMsg] = useState(null)
  const [time, setTime] = useState('')
  const since = useRef(null)

  useEffect(() => {
    const tick = () => setTime(new Date().toTimeString().slice(0, 8))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (phase !== 'collecting') return
    const id = setInterval(() => {
      const secs = (Date.now() - since.current) / 1000
      setElapsed(secs)
      setRaceSamples(samples.filter(s => s.time >= since.current))
      if (secs >= TARGET_SECS) startAnalysis()
    }, 1000)
    return () => clearInterval(id)
  }, [phase, samples])

  async function startAnalysis() {
    setPhase('analyzing')
    setErrorMsg(null)
    const snap = raceSamples
    try {
      const summary = await analyzeWind(snap)
      const stats   = computeStats(snap)
      setResult({ stats, summary })
      setPhase('done')
    } catch (e) {
      setErrorMsg(e.message)
    }
  }

  function confirm() {
    if (!getApiKey()) { setShowKey(true); return }
    since.current = Date.now()
    setElapsed(0)
    setRaceSamples([])
    setPhase('collecting')
  }

  function reset() {
    setPhase('waiting')
    setElapsed(0)
    setRaceSamples([])
    setResult(null)
    setErrorMsg(null)
  }

  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.12)' }} />

  // ── Header ────────────────────────────────────────────────────
  const header = (
    <div style={{ background: '#000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>RACE AREA</span>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{time}</span>
      </div>
      {divider}
    </div>
  )

  // ── Live wind row ─────────────────────────────────────────────
  const liveWind = <LiveWindRow wind={wind} />

  // ── Phases ───────────────────────────────────────────────────
  let body

  if (phase === 'waiting') {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
        {liveWind}
        {divider}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '32px 24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.5 }}>⛳</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em', color: '#fff', lineHeight: 1.3 }}>ARRIVED AT<br/>RACE AREA?</div>
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.7 }}>
            Tap to start 15-min wind collection.<br/>AI will brief you when complete.
          </div>
          <button onClick={confirm} style={{
            width: '100%', padding: '18px 0', background: '#fff', color: '#000',
            fontFamily: 'monospace', fontWeight: 700, fontSize: 14, letterSpacing: '0.15em',
            border: 'none', cursor: 'pointer',
          }}>CONFIRM ARRIVAL</button>
          {!getApiKey() && (
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
              ⚠ Set Anthropic API key first (tap ⚙ above)
            </div>
          )}
        </div>
      </div>
    )
  }

  else if (phase === 'collecting') {
    const progress = Math.min(1, elapsed / TARGET_SECS)
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', overflowY: 'auto' }}>
        {/* Progress bar */}
        <div style={{ padding: '14px 16px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>
              {timeFormatted(elapsed)} <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>/ 15:00</span>
            </span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>{raceSamples.length} SAMPLES</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress * 100}%`, background: '#fff', transition: 'width 1s linear' }} />
          </div>
        </div>
        {divider}
        {liveWind}
        {divider}
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', padding: '10px 16px 4px' }}>WIND SHIFT  (° FROM MEAN)</div>
          <OscillationChart samples={raceSamples} height={120} />
        </div>
        {divider}
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', padding: '10px 16px 4px' }}>SPEED HISTORY  (3 MIN BARS)</div>
          <SpeedHistoryChart buckets={speedBuckets} unit="KTS" height={90} />
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={reset} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', padding: '20px 0' }}>CANCEL</button>
      </div>
    )
  }

  else if (phase === 'analyzing') {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#000' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em' }}>ANALYSING WIND DATA…</div>
        {errorMsg && (
          <>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '0 24px' }}>{errorMsg}</div>
            <button onClick={startAnalysis} style={{ background: 'none', border: 'none', color: '#fff', fontFamily: 'monospace', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>RETRY</button>
          </>
        )}
      </div>
    )
  }

  else if (phase === 'done' && result) {
    const { stats, summary } = result
    body = (
      <div style={{ flex: 1, overflowY: 'auto', background: '#000' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <StatBox top="AVG TWD" value={`${stats.avgTWD}°`} bottom={`${stats.minTWD}°–${stats.maxTWD}°`} half />
          <StatBox top="TREND" value={stats.trendTWD >= 0 ? '→' : '←'} bottom={`${stats.trendTWD >= 0 ? '+' : ''}${stats.trendTWD.toFixed(1)}°`} half />
        </div>
        {divider}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <StatBox top="AVG TWS" value={stats.avgTWS.toFixed(1)} bottom="KTS" half />
          <StatBox top="MAX TWS" value={stats.maxTWS.toFixed(1)} bottom={stats.trendTWS >= 0 ? '▲ BUILDING' : '▼ DROPPING'} half />
        </div>
        {divider}
        <StatBox top="OSCILLATION" value={`±${stats.oscAmplitude.toFixed(0)}°`} bottom={`${stats.sampleCount} samples · ${stats.durationMin.toFixed(0)} min`} />
        {divider}
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>AI WIND BRIEF</div>
          <div style={{ fontSize: 14, fontFamily: 'monospace', color: '#fff', lineHeight: 1.7 }}>{summary}</div>
        </div>
        {divider}
        <button onClick={reset} style={{ width: '100%', padding: '18px 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontWeight: 700, fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer' }}>
          RESET — COLLECT NEW DATA
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {header}
      {body}
    </div>
  )
}
