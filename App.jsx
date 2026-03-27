import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { supabase } from './lib/supabase.js'

// Placeholder pages — will be built in subsequent parts
function PlaceholderPage({ title, icon }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--muted)' }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted2)' }}>{title}</div>
      <div style={{ fontSize: 12 }}>Em construção — Parte 2</div>
    </div>
  )
}

// Analyst view — accessed via unique token link
function AnalistView() {
  const { token } = useParams()
  const [analyst, setAnalyst] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('analysts').select('*').eq('access_token', token).single()
      .then(({ data }) => { setAnalyst(data); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  if (!analyst) return (
    <div className="loading-screen">
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 16, color: 'var(--muted2)' }}>Link inválido ou expirado</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--muted)' }}>
      <div style={{ fontSize: 36 }}>🗓️</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Olá, {analyst.name}!</div>
      <div style={{ fontSize: 12 }}>Sua trilha será construída na Parte 2</div>
    </div>
  )
}

export default function App() {
  const [activeTeam, setActiveTeam] = useState('atendimento')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    supabase.from('unread_notifications').select('total_unread').eq('team', activeTeam).single()
      .then(({ data }) => setPendingCount(data?.total_unread || 0))
  }, [activeTeam])

  return (
    <Routes>
      {/* Analyst unique link */}
      <Route path="/analista/:token" element={<AnalistView />} />

      {/* Main platform */}
      <Route path="/*" element={
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar activeTeam={activeTeam} onTeamChange={setActiveTeam} pendingCount={pendingCount} />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/onboarding" replace />} />
              <Route path="/onboarding" element={<Onboarding activeTeam={activeTeam} />} />
              <Route path="/biblioteca"  element={<PlaceholderPage title="Biblioteca" icon="📚" />} />
              <Route path="/revisoes"    element={<PlaceholderPage title="Revisões" icon="📋" />} />
              <Route path="/avaliacoes"  element={<PlaceholderPage title="Avaliações" icon="📊" />} />
              <Route path="/gamificacao" element={<PlaceholderPage title="Gamificação" icon="🏆" />} />
              <Route path="/rh"          element={<PlaceholderPage title="Painel RH" icon="👥" />} />
              <Route path="/minha-trilha"      element={<PlaceholderPage title="Minha Trilha" icon="🗓️" />} />
              <Route path="/estudar"           element={<PlaceholderPage title="Estudar" icon="📖" />} />
              <Route path="/minha-gamificacao" element={<PlaceholderPage title="Minha Gamificação" icon="⭐" />} />
            </Routes>
          </div>
        </div>
      } />
    </Routes>
  )
}
