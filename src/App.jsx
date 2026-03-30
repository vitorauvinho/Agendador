import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Biblioteca from './pages/Biblioteca.jsx'
import Revisoes from './pages/Revisoes.jsx'
import Avaliacoes from './pages/Avaliacoes.jsx'
import Gamificacao from './pages/Gamificacao.jsx'
import PainelRH from './pages/PainelRH.jsx'
import Configuracoes from './pages/Configuracoes.jsx'
import Trilha from './pages/Trilha.jsx'
import MinhaGamificacao from './pages/MinhaGamificacao.jsx'
import Estudar from './pages/Estudar.jsx'
import Trilhas from './pages/Trilhas.jsx'
import Exercicios from './pages/Exercicios.jsx'
import MinhasTrilhas from './pages/MinhasTrilhas.jsx'
import { supabase } from './lib/supabase.js'

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
      {/* Analyst views via unique token */}
      <Route path="/analista/:token" element={<Trilha />} />
      <Route path="/analista/:token/gamificacao" element={<MinhaGamificacao />} />
      <Route path="/analista/:token/estudar" element={<Estudar />} />
      <Route path="/analista/:token/trilhas" element={<MinhasTrilhas />} />

      {/* Main platform */}
      <Route path="/*" element={
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar activeTeam={activeTeam} onTeamChange={setActiveTeam} pendingCount={pendingCount} />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/onboarding" replace />} />
              <Route path="/onboarding"     element={<Onboarding    activeTeam={activeTeam} />} />
              <Route path="/biblioteca"     element={<Biblioteca    activeTeam={activeTeam} />} />
              <Route path="/revisoes"       element={<Revisoes      activeTeam={activeTeam} />} />
              <Route path="/avaliacoes"     element={<Avaliacoes    activeTeam={activeTeam} />} />
              <Route path="/gamificacao"    element={<Gamificacao   activeTeam={activeTeam} />} />
              <Route path="/trilhas"       element={<Trilhas       activeTeam={activeTeam} />} />
              <Route path="/exercicios"    element={<Exercicios    activeTeam={activeTeam} />} />
              <Route path="/rh"             element={<PainelRH      activeTeam={activeTeam} />} />
              <Route path="/configuracoes"  element={<Configuracoes activeTeam={activeTeam} />} />
            </Routes>
          </div>
        </div>
      } />
    </Routes>
  )
}
