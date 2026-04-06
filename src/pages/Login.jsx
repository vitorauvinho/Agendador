import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, role, analyst, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  // Redireciona se já estiver logado
  useEffect(() => {
    if (loading) return
    if (role === 'enablement') navigate('/onboarding', { replace: true })
    else if (role === 'analyst' && analyst) navigate('/analista', { replace: true })
    else if (user && !role) navigate('/unauthorized', { replace: true })
  }, [user, role, analyst, loading])

  async function handleLogin() {
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Erro ao fazer login:', err)
    }
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">A</div>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '48px 40px',
        width: 380,
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--auvo)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 24,
          margin: '0 auto 24px',
        }}>
          A
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Auvo Enablement
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 36, lineHeight: 1.5 }}>
          Acesse com sua conta Google da Auvo
        </div>

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: 10,
            border: '1px solid var(--border2)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--auvo)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
        >
          {/* Google icon SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.53.09-1.04.25-1.52V5.41H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.51.85 3.59l2.68-2.07z"/>
            <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 .98 9l2.83 2.07c.63-1.89 2.39-3.29 4.47-3.29l-.3-.2z"/>
          </svg>
          Entrar com Google
        </button>

        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 20 }}>
          Apenas emails @auvo.com.br autorizados
        </div>
      </div>
    </div>
  )
}
