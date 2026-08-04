'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface Professional {
  id: string
  user_id: string
  full_name: string
  cpf: string
  professional_register: string | null
  register_state: string | null
  professional_type: string
  specialty: string | null
  verification_status?: 'self_declared' | 'pending' | 'verified' | 'rejected' | 'suspended'
  allowed_capabilities?: string[] | any
  blocked_capabilities?: string[] | any
  professional_context?: any
  practice_preferences?: any
  onboarding_objectives?: string[] | null
  consultation_template?: string | null
  onboarding_completed?: boolean | null
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
  professionalRegister?: string
  registerState?: string
  professionalType: string
  specialty?: string
  noteTemplate?: string
  primaryGoal?: string
  patientAudience?: string
  serviceStyle?: string
  preferredTone?: string
}

const defaultAllowedCapabilities = ['basic_workspace', 'ai_copilot', 'patient_records', 'care_plan', 'follow_up', 'crm']
const defaultBlockedCapabilities = ['prescription', 'official_signature', 'controlled_prescription', 'official_medical_document']

function inferNoteTemplate(professionalType: string, fallback?: string) {
  if (fallback) return fallback
  const map: Record<string, string> = {
    medico: 'clinical_soap',
    nutricionista: 'nutritional_evolution',
    fisioterapeuta: 'functional_rehab_evolution',
    psicologo: 'therapeutic_session_note',
    terapeuta: 'therapeutic_session_note',
    enfermeiro: 'nursing_triage_followup',
    fonoaudiologo: 'therapy_evolution',
    odonto: 'dental_visit_note',
    farmaceutico: 'pharmaceutical_care_note',
    educador_fisico: 'training_health_followup',
  }
  return map[professionalType] || 'general_health_visit'
}

function defaultQuestionsFor(professionalType: string) {
  const map: Record<string, string[]> = {
    medico: ['Queixa principal', 'Alergias', 'Medicamentos em uso', 'Antecedentes', 'Sinais de alarme'],
    nutricionista: ['Recordatório alimentar', 'Hidratação', 'Sono', 'Treino/atividade', 'Restrições e preferências', 'Objetivo nutricional'],
    fisioterapeuta: ['Local da dor', 'Escala de dor', 'Movimento que piora', 'Movimento que melhora', 'Limitação funcional', 'Exercícios orientados'],
    psicologo: ['Queixa principal', 'Contexto emocional', 'Sono', 'Rede de apoio', 'Objetivos terapêuticos', 'Pontos para próxima sessão'],
    terapeuta: ['Queixa principal', 'Contexto emocional', 'Sono', 'Rede de apoio', 'Objetivos terapêuticos', 'Pontos para próxima sessão'],
    enfermeiro: ['Sinais vitais', 'Queixa atual', 'Procedimentos realizados', 'Orientações dadas', 'Encaminhamentos'],
  }
  return map[professionalType] || ['Queixa/objetivo principal', 'Histórico relevante', 'Orientações dadas', 'Plano de acompanhamento']
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (data: SignUpData) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (authError) return { error: authError as Error }
    if (!authData.user) return { error: new Error('Failed to create user') }

    const noteTemplate = inferNoteTemplate(data.professionalType, data.noteTemplate)
    const professionalContext = {
      source: 'self_declared_onboarding',
      professional_type: data.professionalType,
      specialty: data.specialty || null,
      primary_goal: data.primaryGoal || null,
      patient_audience: data.patientAudience || null,
      service_style: data.serviceStyle || null,
      preferred_tone: data.preferredTone || 'professional_clear',
      note_template: noteTemplate,
      regulatory_level: 'workspace_only_until_verification',
    }

    const practicePreferences = {
      note_template: noteTemplate,
      preferred_summary_style: 'structured',
      required_questions: defaultQuestionsFor(data.professionalType),
      default_follow_up_message: '',
      custom_instructions: 'IA deve atuar apenas como apoio. O profissional revisa, edita, valida e assume responsabilidade dentro do seu escopo profissional.',
    }

    const professionalPayload = {
      user_id: authData.user.id,
      full_name: data.fullName,
      cpf: data.cpf.replace(/\D/g, ''),
      professional_register: data.professionalRegister || null,
      register_state: data.registerState ? data.registerState.toUpperCase() : null,
      professional_type: data.professionalType,
      specialty: data.specialty || null,
      verification_status: 'self_declared',
      allowed_capabilities: defaultAllowedCapabilities,
      blocked_capabilities: defaultBlockedCapabilities,
      professional_context: professionalContext,
      practice_preferences: practicePreferences,
      onboarding_objectives: data.primaryGoal ? [data.primaryGoal] : [],
      consultation_template: noteTemplate,
      onboarding_completed: true,
    }

    const { data: professionalRow, error: professionalError } = await supabase
      .from('professionals')
      .insert(professionalPayload)
      .select('*')
      .single()

    if (professionalError) return { error: professionalError }

    try {
      await supabase.from('professional_ai_preferences').insert({
        professional_id: professionalRow?.id || null,
        professional_user_id: authData.user.id,
        professional_type: data.professionalType,
        specialty: data.specialty || null,
        note_template: noteTemplate,
        preferred_summary_style: 'structured',
        preferred_tone: data.preferredTone || 'professional_clear',
        patient_audience: data.patientAudience || null,
        service_style: data.serviceStyle || null,
        required_questions: defaultQuestionsFor(data.professionalType),
        custom_instructions: practicePreferences.custom_instructions,
        capabilities_snapshot: {
          verification_status: 'self_declared',
          allowed_capabilities: defaultAllowedCapabilities,
          blocked_capabilities: defaultBlockedCapabilities,
        },
      })
    } catch {
      // Tabela opcional criada por SQL_PROFESSIONAL_PERSONALIZATION_V1.sql. Não trava o cadastro se ainda não foi rodada.
    }

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
