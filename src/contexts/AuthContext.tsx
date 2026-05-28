'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface Professional {
  id: string
  user_id: string
  full_name: string
  cpf: string
  professional_register: string
  register_state: string
  professional_type: string
  specialty: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  professional: Professional | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfessional: () => Promise<void>
}

interface SignUpData {
  email: string
  password: string
  fullName: string
  cpf: string
  professionalRegister: string
  registerState: string
  professionalType: string
  specialty?: string
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  professional: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfessional: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfessional = async () => {
    if (!user) {
      setProfessional(null)
      return
    }

    const { data } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setProfessional(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      refreshProfessional()
    } else {
      setProfessional(null)
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error as Error | null }
  }

  const signUp = async (data: SignUpData) => {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (authError) return { error: authError as Error }

    if (!authData.user) return { error: new Error('Failed to create user') }

    // Create professional record
    const { error: professionalError } = await supabase.from('professionals').insert({
      user_id: authData.user.id,
      full_name: data.fullName,
      cpf: data.cpf.replace(/\D/g, ''),
      professional_register: data.professionalRegister,
      register_state: data.registerState.toUpperCase(),
      professional_type: data.professionalType,
      specialty: data.specialty || null,
    })

    if (professionalError) return { error: professionalError }

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfessional(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, professional, loading, signIn, signUp, signOut, refreshProfessional }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
