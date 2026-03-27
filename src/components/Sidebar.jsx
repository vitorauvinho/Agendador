import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ENABLEMENT = [
  { path: '/onboarding',    icon: '📅', label: 'Onboarding' },
  { path: '/biblioteca',    icon: '📚', label: 'Biblioteca' },
  { path: '/revisoes',      icon: '📋', label: 'Revisões', badge: true },
  { path: '/avaliacoes',    icon: '📊', label: 'Avaliações' },
  { path: '/gamificacao',   icon: '🏆', label: 'Gamificação' },
  { path: '/rh',            icon: '👥', label: 'Painel RH' },
  { path: '/configuracoes', icon: '⚙️', label: 'Configurações' },
]

export default function Sidebar({ activeTeam, onTeamChange, pendingCount = 0 }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '18px 0', height: '100vh', overflow: 'hidden' }}>
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>A</div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Auvo Enablement</div>
        <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace', marginTop: 1 }}>platform v2.0</div>
      </div>

      <div style={{ padding: '0 8px', marginBottom: 6, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 4 }}>Enablement</div>
        {NAV_ENABLEMENT.map(item => {
          const isActive = location.pathname === item.path
          return (
            <div key={item.path} onClick={() => navigate(item.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: isActive ? 'var(--auvo)' : 'var(--muted2)', background: isActive ? 'var(--auvo-dim)' : 'transparent', border: `1px solid ${isActive ? 'var(--auvo-border)' : 'transparent'}`, transition: 'all 0.15s', marginBottom: 2 }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--auvo)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8 }}>{pendingCount}</span>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 8px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Time ativo</div>
        {[['atendimento','🎧 Atendimento'],['vendas','💼 Vendas']].map(([k,l]) => (
          <button key={k} onClick={() => onTeamChange(k)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${activeTeam===k?'var(--auvo-border)':'var(--border)'}`, background: activeTeam===k?'var(--auvo-dim)':'transparent', color: activeTeam===k?'var(--auvo)':'var(--muted2)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, transition: 'all 0.15s' }}>
            {l}
          </button>
        ))}
      </div>
    </aside>
  )
}
