'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Heart, Mail, Lock, User, FileText, Loader2, Sparkles, ShieldCheck } from 'lucide-react'

const PROFESSIONAL_TYPES = [
  { value: 'medico', label: 'Médico(a)' },
  { value: 'nutricionista', label: 'Nutricionista' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { value: 'psicologo', label: 'Psicólogo(a)' },
  { value: 'terapeuta', label: 'Terapeuta' },
  { value: 'enfermeiro', label: 'Enfermeiro(a)' },
  { value: 'fonoaudiologo', label: 'Fonoaudiólogo(a)' },
  { value: 'odonto', label: 'Odontólogo(a) / Dentista' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
  { value: 'educador_fisico', label: 'Educador(a) físico(a)' },
  { value: 'outro', label: 'Outro profissional da saúde' },
]

const NOTE_TEMPLATES = [
  { value: 'clinical_soap', label: 'SOAP clínico' },
  { value: 'nutritional_evolution', label: 'Evolução nutricional' },
  { value: 'functional_rehab_evolution', label: 'Evolução fisioterapêutica / funcional' },
  { value: 'therapeutic_session_note', label: 'Registro terapêutico' },
  { value: 'nursing_triage_followup', label: 'Triagem / acompanhamento de enfermagem' },
  { value: 'therapy_evolution', label: 'Evolução terapêutica' },
  { value: 'general_health_visit', label: 'Nota geral de atendimento' },
]

const GOALS = [
  { value: 'reduce_typing', label: 'Reduzir digitação e fadiga de tela' },
  { value: 'voice_transcription', label: 'Gravar/transcrever atendimentos' },
  { value: 'structured_notes', label: 'Gerar evolução/nota estruturada' },
  { value: 'care_plans', label: 'Criar planos de cuidado/orientações' },
  { value: 'patient_followup', label: 'Acompanhar retornos e pacientes' },
  { value: 'prescriptions_documents', label: 'Emitir receitas/documentos futuramente' },
]

const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

function inferTemplate(professionalType: string) {
  const map: Record<string, string> = {
    medico: 'clinical_soap',
    nutricionista: 'nutritional_evolution',
    fisioterapeuta: 'functional_rehab_evolution',
    psicologo: 'therapeutic_session_note',
    terapeuta: 'therapeutic_session_note',
    enfermeiro: 'nursing_triage_followup',
    fonoaudiologo: 'therapy_evolution',
    odonto: 'general_health_visit',
    farmaceutico: 'general_health_visit',
    educador_fisico: 'general_health_visit',
  }
  return map[professionalType] || 'general_health_visit'
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    cpf: '',
    professionalRegister: '',
    registerState: '',
    professionalType: '',
    specialty: '',
    noteTemplate: '',
    primaryGoal: '',
    patientAudience: '',
    serviceStyle: '',
    preferredTone: 'professional_clear',
  })
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'professionalType') {
      setFormData(prev => ({ ...prev, professionalType: value, noteTemplate: inferTemplate(value) }))
      return
    }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : `${a}.${b}.${c}`)
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value)
    setFormData(prev => ({ ...prev, cpf: formatted }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (formData.password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres')
      return
    }

    if (formData.cpf.replace(/\D/g, '').length !== 11) {
      toast.error('CPF inválido')
      return
    }

    if (!formData.professionalType) {
      toast.error('Informe sua profissão para personalizar o MyDataMed')
      return
    }

    setLoading(true)

    try {
      const { error } = await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        cpf: formData.cpf,
        professionalRegister: formData.professionalRegister,
        registerState: formData.registerState,
        professionalType: formData.professionalType,
        specialty: formData.specialty,
        noteTemplate: formData.noteTemplate || inferTemplate(formData.professionalType),
        primaryGoal: formData.primaryGoal,
        patientAudience: formData.patientAudience,
        serviceStyle: formData.serviceStyle,
        preferredTone: formData.preferredTone,
      })

      if (error) {
        toast.error(error.message || 'Erro ao fazer cadastro. Rode SQL_PROFESSIONAL_PERSONALIZATION_V1.sql se necessário.')
        return
      }

      toast.success('Cadastro realizado! Seu MyDataMed foi personalizado para sua profissão.')
      router.push('/meu-jeito-atender')
    } catch {
      toast.error('Erro ao fazer cadastro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Cadastro de Profissional de Saúde</h1>
            <p className="text-gray-600 mt-2">Entre rápido, diga sua profissão e o MyDataMed adapta a IA ao seu jeito de atender.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-6">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-950 flex gap-3">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <span><strong>Primeiro acesso autodeclarado.</strong> Agenda, IA, transcrição, pacientes avulsos e CRM ficam liberados.</span>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950 flex gap-3">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <span><strong>Verificação depois.</strong> Prescrições, assinatura oficial e documentos regulados exigem validação.</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="seu@email.com" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                </div>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Seu nome completo" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Mín 8 caracteres" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Repita a senha" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" name="cpf" value={formData.cpf} onChange={handleCPFChange} placeholder="000.000.000-00" maxLength={14} required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profissão</label>
                <select name="professionalType" value={formData.professionalType} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none">
                  <option value="">Selecione</option>
                  {PROFESSIONAL_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registro profissional</label>
                <input type="text" name="professionalRegister" value={formData.professionalRegister} onChange={handleChange} placeholder="CRM, CRN, CREFITO etc. Opcional agora" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                <p className="text-xs text-gray-500 mt-1">Obrigatório depois para recursos regulados da sua categoria.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UF do registro</label>
                <select name="registerState" value={formData.registerState} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none">
                  <option value="">UF</option>
                  {STATES.map(state => <option key={state} value={state}>{state}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Especialidade / área de atuação</label>
                <input type="text" name="specialty" value={formData.specialty} onChange={handleChange} placeholder="Ex: Nutrição esportiva, ortopedia, terapia familiar" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modelo de nota preferido</label>
                <select name="noteTemplate" value={formData.noteTemplate || inferTemplate(formData.professionalType)} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none">
                  {NOTE_TEMPLATES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Principal objetivo</label>
                <select name="primaryGoal" value={formData.primaryGoal} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none">
                  <option value="">Selecione</option>
                  {GOALS.map(goal => <option key={goal.value} value={goal.value}>{goal.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Público atendido</label>
                <input type="text" name="patientAudience" value={formData.patientAudience} onChange={handleChange} placeholder="Ex: adultos, idosos, atletas, gestantes, crianças" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Como você atende?</label>
                <textarea name="serviceStyle" value={formData.serviceStyle} onChange={handleChange} placeholder="Ex: atendimento objetivo com plano prático, foco em retorno de 30 dias, gosto de registrar metas e tarefas." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[90px]" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Personalizando...' : 'Cadastrar e personalizar MyDataMed'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Já tem conta? <Link href="/login" className="text-emerald-600 font-medium hover:underline">Faça login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
