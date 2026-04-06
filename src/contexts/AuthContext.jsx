import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null) // 'enablement' | 'analyst' | null
  const [analyst, setAnalyst] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveRole(session.user)
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        resolveRole(session.user)
      } else {
        setUser(null)
        setRole(null)
        setAnalyst(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function resolveRole(authUser) {
    setUser(authUser)
    const email = authUser.email?.toLowerCase()

    // Verifica se é Enablement
    const { data: enablement } = await supabase
      .from('enablement_users')
      .select('*')
      .eq('email', email)
      .single()

    if (enablement) {
      setRole('enablement')
      setLoading(false)
      return
    }

    // Verifica se é Analista
    const { data: analystData } = await supabase
      .from('analysts')
      .select('*')
      .eq('email', email)
      .single()

    if (analystData) {
      setRole('analyst')
      setAnalyst(analystData)
      setLoading(false)
      return
    }

    // Nenhum dos dois
    setRole(null)
    setLoading(false)
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://agendador-one.vercel.app',
      }
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, analyst, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
