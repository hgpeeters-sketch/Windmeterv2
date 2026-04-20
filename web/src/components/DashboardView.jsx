import { compassLabel } from '../useWindData'

export default function DashboardView({ wind }) {
  const dir = wind.direction
  const spd = (wind.speedMps * 1.94384).toFixed(1)

  return (
    <div style={{ background: '#000', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>RACING</span>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        <Tile label="TWD" value={`${dir}°`} sub={compassLabel(dir)} />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.12)' }} />
        <Tile label="TWS" value={spd} sub="KTS" />
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ display: 'flex', flex: 1 }}>
        <Tile label="MAX" value={(wind.speedMps * 1.94384).toFixed(1)} sub="KTS" />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.12)' }} />
        <Tile label="AVG" value={(wind.speedMps * 1.94384).toFixed(1)} sub="KTS" />
      </div>
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 0 16px 16px' }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 56, fontWeight: 700, fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 14, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}
