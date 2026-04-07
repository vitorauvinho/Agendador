import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { path: '',             icon: '🗓️', label: 'Minha trilha' },
  { path: '/trilhas',     icon: '🎬', label: 'Trilhas de vídeo' },
  { path: '/estudar',     icon: '📚', label: 'Materiais' },
  { path: '/gamificacao', icon: '🏆', label: 'Gamificação' },
]

const NOTEBOOK_URL = 'https://notebooklm.google.com/notebook/14128fec-c0ef-452b-9fde-fd5fc63dfda4'

export default function AnalistaLayout({ children, analystName, analystTeam }) {
  const { analyst: authAnalyst } = useAuth()
  const location = useLocation()
  const [logoUrl, setLogoUrl] = useState('')
  const [companyName, setCompanyName] = useState('Auvo')

  useEffect(() => {
    async function loadSettings() {
      const team = analystTeam || authAnalyst?.team
      if (!team) return
      const { data } = await supabase
        .from('team_settings')
        .select('logo_url, company_name')
        .eq('team', team)
        .single()
      if (data?.logo_url) setLogoUrl(data.logo_url)
      if (data?.company_name) setCompanyName(data.company_name)
    }
    loadSettings()
  }, [analystTeam, authAnalyst])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{ width: 200, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '18px 0' }}>
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
          {logoUrl ? (
            <img src={logoUrl} alt={companyName}
              style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', marginBottom: 8 }}
              onError={() => setLogoUrl('')} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--auvo)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              {companyName.charAt(0)}
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600 }}>{companyName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {analystName || authAnalyst?.name || 'Analista'}
          </div>
        </div>

        <div style={{ padding: '0 8px', flex: 1 }}>
          <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 6 }}>Menu</div>
          {NAV_ITEMS.map(item => {
            const fullPath = `/analista${item.path}`
            const isActive = location.pathname === fullPath
            return (
              <a key={item.path} href={fullPath}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 7, fontSize: 12, textDecoration: 'none', color: isActive ? 'var(--auvo)' : 'var(--muted2)', background: isActive ? 'var(--auvo-dim)' : 'transparent', border: `1px solid ${isActive ? 'var(--auvo-border)' : 'transparent'}`, marginBottom: 3, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            )
          })}
        </div>

        {/* Botão assistente na sidebar */}
        <div style={{ padding: '12px 8px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <button
            onClick={() => window.open(NOTEBOOK_URL, '_blank')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 7, fontSize: 12, width: '100%', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--auvo-border)', background: 'var(--auvo-dim)', color: 'var(--auvo)', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(109,38,194,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--auvo-dim)'}
          >
            <span style={{ fontSize: 15 }}>🤖</span>
            <span style={{ fontWeight: 600 }}>Assistente IA</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {children}
      </main>

      {/* Botão flutuante */}
      <button
        onClick={() => window.open(NOTEBOOK_URL, '_blank')}
        title="Abrir Assistente IA"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--auvo), #9333ea)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 4px 20px rgba(109,38,194,0.45)',
          transition: 'all 0.2s',
          zIndex: 999,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(109,38,194,0.6)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(109,38,194,0.45)' }}
      >
        🤖
      </button>
    </div>
  )
}
