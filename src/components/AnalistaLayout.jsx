import { useParams, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const NAV_ITEMS = [
  { path: '',              icon: '🗓️', label: 'Minha trilha' },
  { path: '/trilhas',      icon: '🎬', label: 'Trilhas de vídeo' },
  { path: '/estudar',      icon: '📚', label: 'Materiais' },
  { path: '/gamificacao',  icon: '🏆', label: 'Gamificação' },
]

export default function AnalistaLayout({ children, analystName, analystTeam }) {
  const { token } = useParams()
  const location = useLocation()
  const [logoUrl, setLogoUrl] = useState('')
  const [companyName, setCompanyName] = useState('Auvo')

  useEffect(() => {
    async function loadSettings() {
      // Se não temos o time ainda, busca pelo token
      let team = analystTeam
      if (!team && token) {
        const { data: a } = await supabase
          .from('analysts').select('team').eq('access_token', token).single()
        team = a?.team
      }
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
  }, [token, analystTeam])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
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
            {analystName || 'Analista'}
          </div>
        </div>

        <div style={{ padding: '0 8px' }}>
          <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 6 }}>Menu</div>
          {NAV_ITEMS.map(item => {
            const fullPath = `/analista/${token}${item.path}`
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
      </aside>
      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </div>
  )
}
