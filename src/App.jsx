import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
import Requalificacao from './pages/Requalificacao.jsx'
import MinhasTrilhas from './pages/MinhasTrilhas.jsx'
import Login from './pages/Login.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import { supabase } from './lib/supabase.js'

// ── Layout do painel do Enablement ───────────────────────────
function MainLayout({ activeTeam, onTeamChange, pendingCount }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activeTeam={activeTeam} onTeamChange={onTeamChange} pendingCount={pendingCount} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route index element={<Navigate to="/onboarding" replace />} />
          <Route path="onboarding"    element={<Onboarding    activeTeam={activeTeam} />} />
          <Route path="biblioteca"    element={<Biblioteca    activeTeam={activeTeam} />} />
          <Route path="revisoes"      element={<Revisoes      activeTeam={activeTeam} />} />
          <Route path="avaliacoes"    element={<Avaliacoes    activeTeam={activeTeam} />} />
          <Route path="gamificacao"   element={<Gamificacao   activeTeam={activeTeam} />} />
          <Route path="trilhas"       element={<Trilhas       activeTeam={activeTeam} />} />
          <Route path="exercicios"    element={<Exercicios    activeTeam={activeTeam} />} />
          <Route path="rh"            element={<PainelRH      activeTeam={activeTeam} />} />
          <Route path="configuracoes" element={<Configuracoes activeTeam={activeTeam} />} />
          <Route path="requalificacao" element={<Requalificacao activeTeam={activeTeam} />} />
        </Routes>
      </div>
    </div>
  )
}

// ── Rota protegida para Enablement ───────────────────────────
function EnablementRoute({ children }) {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (role === 'analyst') return <Navigate to="/analista" replace />
  if (role !== 'enablement') return <Navigate to="/unauthorized" replace />

  return children
}

// ── Rota protegida para Analista ─────────────────────────────
function AnalistaRoute({ children }) {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (role === 'enablement') return <Navigate to="/onboarding" replace />
  if (role !== 'analyst') return <Navigate to="/unauthorized" replace />

  return children
}

// ── App principal ────────────────────────────────────────────
function AppContent() {
  const { role, analyst, loading } = useAuth()
  const [activeTeam, setActiveTeam] = useState('atendimento')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (role === 'enablement') {
      loadPending()
      const interval = setInterval(loadPending, 30000)
      return () => clearInterval(interval)
    }
  }, [activeTeam, role])

  async function loadPending() {
    const { data } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('team', activeTeam)
      .eq('read', false)
    setPendingCount(data?.length || 0)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Rotas do analista — protegidas por SSO */}
      <Route path="/analista" element={
        <AnalistaRoute>
          <Trilha analystId={analyst?.id} />
        </AnalistaRoute>
      } />
      <Route path="/analista/gamificacao" element={
        <AnalistaRoute>
          <MinhaGamificacao analystId={analyst?.id} />
        </AnalistaRoute>
      } />
      <Route path="/analista/estudar" element={
        <AnalistaRoute>
          <Estudar analystId={analyst?.id} />
        </AnalistaRoute>
      } />
      <Route path="/analista/trilhas" element={
        <AnalistaRoute>
          <MinhasTrilhas analystId={analyst?.id} />
        </AnalistaRoute>
      } />

      {/* Painel do Enablement — protegido por SSO */}
      <Route path="/*" element={
        <EnablementRoute>
          <MainLayout
            activeTeam={activeTeam}
            onTeamChange={setActiveTeam}
            pendingCount={pendingCount}
          />
        </EnablementRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
