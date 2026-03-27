import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Biblioteca from './pages/Biblioteca.jsx'
import Revisoes from './pages/Revisoes.jsx'
import Avaliacoes from './pages/Avaliacoes.jsx'
import Trilha from './pages/Trilha.jsx'
import { supabase } from './lib/supabase.js'

function PlaceholderPage({ title, icon }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--muted)' }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted2)' }}>{title}</div>
      <div style={{ fontSize: 12 }}>Em construção — Parte 3</div>
    </div>
  )
}

export default function App() {
  const [activeTeam, setActiveTeam] = useState('atendimento')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    loadPending()
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
  }, [activeTeam])

  async function loadPending() {
    const { data } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('team', activeTeam)
      .eq('read', false)
    setPendingCount(data?.length || 0)
  }

  return (
    <Routes>
      <Route path="/analista/:token" element={<Trilha />} />
      <Route path="/*" element={
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar activeTeam={activeTeam} onTeamChange={setActiveTeam} pendingCount={pendingCount} />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/onboarding" replace />} />
              <Route path="/onboarding"  element={<Onboarding activeTeam={activeTeam} />} />
              <Route path="/biblioteca"  element={<Biblioteca activeTeam={activeTeam} />} />
              <Route path="/revisoes"    element={<Revisoes   activeTeam={activeTeam} />} />
              <Route path="/avaliacoes"  element={<Avaliacoes activeTeam={activeTeam} />} />
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
