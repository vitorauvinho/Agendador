import { useAuth } from '../contexts/AuthContext'

export default function Unauthorized() {
  const { user, signOut } = useAuth()

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
        width: 400,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>

        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Acesso não autorizado
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 8, lineHeight: 1.6 }}>
          O email <strong style={{ color: 'var(--text)' }}>{user?.email}</strong> não tem permissão para acessar esta plataforma.
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 32, lineHeight: 1.6 }}>
          Se você acredita que isso é um erro, entre em contato com o time de Enablement.
        </div>

        <button
          onClick={signOut}
          className="btn btn-sm"
          style={{ fontSize: 12 }}
        >
          Sair e tentar outro email
        </button>
      </div>
    </div>
  )
}
