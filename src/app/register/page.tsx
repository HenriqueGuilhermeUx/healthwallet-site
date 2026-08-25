'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { BriefcaseBusiness, Building2, CheckCircle, CreditCard, FileText, Heart, Link as LinkIcon, Loader2, Lock, Mail, MapPin, Phone, ShieldCheck, Sparkles, Stethoscope, User, WalletCards } from 'lucide-react'

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
  { value: 'start_attending', label: 'Começar a atender com estrutura profissional' },
  { value: 'digital_migration', label: 'Migrar consultório/clínica para o digital' },
  { value: 'reduce_typing', label: 'Reduzir digitação e fadiga de tela' },
  { value: 'voice_transcription', label: 'Gravar/transcrever atendimentos' },
  { value: 'structured_notes', label: 'Gerar evolução/nota estruturada' },
  { value: 'patient_followup', label: 'Acompanhar retornos e pacientes' },
]

const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

const PLANS = [
  { code: 'start', name: 'Start', price: 'R$ 129/mês', visits: '100 atendimentos', description: 'Para começar com consultório digital, agenda, página, IA, CRM e backoffice.' },
  { code: 'pro', name: 'Pro', price: 'R$ 199/mês', visits: '200 atendimentos', description: 'Para operar e crescer com MODO, CRM avançado, automações e assistente.' },
  { code: 'clinic', name: 'Clinic', price: 'R$ 399/mês', visits: '400 atendimentos', description: 'Para clínicas/equipes com recepção digital, múltiplos profissionais e gestão.' },
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

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function slugify(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function formatCPF(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : `${a}.${b}.${c}`)
}

function formatCNPJ(value: string) {
  const digits = onlyDigits(value).slice(0, 14)
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) => e ? `${a}.${b}.${c}/${d}-${e}` : `${a}.${b}.${c}/${d}`)
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
    professionalType: 'medico',
    specialty: '',
    noteTemplate: 'clinical_soap',
    primaryGoal: 'start_attending',
    patientAudience: '',
    serviceStyle: '',
    preferredTone: 'professional_clear',
    planCode: 'start',
    commercialName: '',
    documentType: 'cpf',
    cnpj: '',
    whatsapp: '',
    phone: '',
    city: '',
    state: '',
    serviceMode: 'hybrid',
    publicSlug: '',
  })
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const router = useRouter()

  const suggestedSlug = useMemo(() => {
    return slugify(formData.publicSlug || [formData.commercialName || formData.fullName, formData.specialty].filter(Boolean).join(' '))
  }, [formData.publicSlug, formData.fullName, formData.commercialName, formData.specialty])

  const selectedPlan = PLANS.find((plan) => plan.code === formData.planCode) || PLANS[0]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'professionalType') {
      setFormData(prev => ({ ...prev, professionalType: value, noteTemplate: inferTemplate(value) }))
      return
    }
    if (name === 'publicSlug') {
      setFormData(prev => ({ ...prev, publicSlug: slugify(value) }))
      return
    }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))
  }

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))
  }

  const suggestSlug = () => {
    setFormData(prev => ({ ...prev, publicSlug: slugify([prev.commercialName || prev.fullName, prev.specialty].filter(Boolean).join(' ')) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) return toast.error('As senhas não coincidem')
    if (formData.password.length < 8) return toast.error('A senha deve ter pelo menos 8 caracteres')
    if (onlyDigits(formData.cpf).length !== 11) return toast.error('CPF inválido')
    if (formData.documentType === 'cnpj' && onlyDigits(formData.cnpj).length !== 14) return toast.error('CNPJ inválido')
    if (!formData.professionalType) return toast.error('Informe sua profissão')
    if (!suggestedSlug || suggestedSlug.length < 3) return toast.error('Escolha um link público com pelo menos 3 caracteres')

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
        planCode: formData.planCode as any,
        publicSlug: suggestedSlug,
        commercialName: formData.commercialName,
        documentType: formData.documentType as any,
        documentNumber: formData.documentType === 'cnpj' ? formData.cnpj : formData.cpf,
        cnpj: formData.cnpj,
        whatsapp: formData.whatsapp,
        phone: formData.phone,
        city: formData.city,
        state: formData.state,
        serviceMode: formData.serviceMode as any,
      })

      if (error) {
        toast.error(error.message || 'Erro ao fazer cadastro. Confirme os SQLs no Supabase.')
        return
      }

      toast.success('Cadastro realizado! Sua estrutura inicial foi criada.')
      router.push('/minha-pagina')
    } catch {
      toast.error('Erro ao fazer cadastro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-120px)] px-4 py-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-24 rounded-[2rem] bg-slate-950 text-white p-7 overflow-hidden relative">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mb-5"><Heart className="w-7 h-7" /></div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-emerald-100 mb-4"><Sparkles className="w-4 h-4" /> Consultório digital pronto</div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Comece com página, agenda, IA, CRM e backoffice.</h1>
            <p className="text-white/70 mt-4">O cadastro já cria sua estrutura inicial: plano, dados comerciais, página/bio link, controle de atendimentos e base de backoffice.</p>
            <div className="grid gap-3 mt-6 text-sm">
              <Benefit icon={Stethoscope} text="Médicos e profissionais de saúde no centro da operação" />
              <Benefit icon={LinkIcon} text="Página pública editável no formato mydatamed.com/seu-link" />
              <Benefit icon={WalletCards} text="Planos por volume: 100, 200 ou 400 atendimentos" />
              <Benefit icon={ShieldCheck} text="IA assistiva: o profissional valida, assina e se responsabiliza" />
            </div>
          </div>
        </aside>

        <section className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-6 md:p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900">Cadastro e configuração inicial</h2>
            <p className="text-gray-600 mt-2">Preencha os dados mínimos para criar seu consultório digital. A página pública nasce como rascunho e você publica quando revisar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <Block title="1. Conta e profissional" icon={User}>
              <div className="grid md:grid-cols-2 gap-4">
                <Input icon={Mail} label="E-mail" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="seu@email.com" />
                <Input icon={User} label="Nome completo" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Seu nome completo" />
                <Input icon={Lock} label="Senha" type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="Mín. 8 caracteres" />
                <Input icon={Lock} label="Confirmar senha" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required placeholder="Repita a senha" />
                <Input icon={FileText} label="CPF do responsável/profissional" name="cpf" value={formData.cpf} onChange={handleCPFChange} required placeholder="000.000.000-00" maxLength={14} />
                <Select label="Profissão" name="professionalType" value={formData.professionalType} onChange={handleChange} options={PROFESSIONAL_TYPES} />
                <Input label="Registro profissional" name="professionalRegister" value={formData.professionalRegister} onChange={handleChange} placeholder="CRM, CRN, CREFITO etc." />
                <Select label="UF do registro" name="registerState" value={formData.registerState} onChange={handleChange} options={STATES.map((state) => ({ value: state, label: state }))} placeholder="UF" />
                <Input label="Especialidade / área" name="specialty" value={formData.specialty} onChange={handleChange} placeholder="Ex: Pediatria, Cardiologia, Nutrição esportiva" />
                <Select label="Modelo de nota" name="noteTemplate" value={formData.noteTemplate || inferTemplate(formData.professionalType)} onChange={handleChange} options={NOTE_TEMPLATES} />
              </div>
            </Block>

            <Block title="2. Plano inicial" icon={CreditCard}>
              <div className="grid md:grid-cols-3 gap-3">
                {PLANS.map((plan) => (
                  <button key={plan.code} type="button" onClick={() => setFormData(prev => ({ ...prev, planCode: plan.code }))} className={`rounded-2xl border p-4 text-left transition-all ${formData.planCode === plan.code ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10' : 'border-gray-100 bg-gray-50 hover:bg-white'}`}>
                    <p className="font-bold text-gray-900">{plan.name}</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{plan.price}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">{plan.visits}/mês</p>
                    <p className="text-xs text-gray-500 mt-2">{plan.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700">
                Plano escolhido: <strong>{selectedPlan.name}</strong> • {selectedPlan.visits}. Você poderá ajustar cobrança/assinatura depois em Planos/Backoffice.
              </div>
            </Block>

            <Block title="3. Dados comerciais e contato" icon={Building2}>
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Nome comercial / clínica" name="commercialName" value={formData.commercialName} onChange={handleChange} placeholder="Ex: Clínica Viver Bem ou Dra. Ana" />
                <Select label="Documento comercial" name="documentType" value={formData.documentType} onChange={handleChange} options={[{ value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' }, { value: 'not_informed', label: 'Informar depois' }]} />
                {formData.documentType === 'cnpj' && <Input label="CNPJ" name="cnpj" value={formData.cnpj} onChange={handleCNPJChange} placeholder="00.000.000/0000-00" maxLength={18} />}
                <Input icon={Phone} label="WhatsApp comercial" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="DDD + número" />
                <Input label="Telefone" name="phone" value={formData.phone} onChange={handleChange} placeholder="Opcional" />
                <Input icon={MapPin} label="Cidade" name="city" value={formData.city} onChange={handleChange} placeholder="Cidade" />
                <Select label="UF" name="state" value={formData.state} onChange={handleChange} options={STATES.map((state) => ({ value: state, label: state }))} placeholder="UF" />
                <Select label="Atendimento" name="serviceMode" value={formData.serviceMode} onChange={handleChange} options={[{ value: 'online', label: 'Online' }, { value: 'presencial', label: 'Presencial' }, { value: 'hybrid', label: 'Online e presencial' }]} />
              </div>
            </Block>

            <Block title="4. Página pública e posicionamento" icon={BriefcaseBusiness}>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Seu link público</label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex-1 flex rounded-xl border border-gray-200 overflow-hidden bg-white">
                      <span className="px-3 py-3 text-sm text-gray-500 bg-gray-50 border-r">mydatamed.com/</span>
                      <input name="publicSlug" value={formData.publicSlug || suggestedSlug} onChange={handleChange} placeholder="seu-link" className="flex-1 px-3 py-3 outline-none" />
                    </div>
                    <button type="button" onClick={suggestSlug} className="rounded-xl border px-4 py-3 font-semibold text-sm">Sugerir</button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">A página nasce como rascunho. Depois você revisa em “Minha Página” e publica.</p>
                </div>
                <Select label="Principal objetivo" name="primaryGoal" value={formData.primaryGoal} onChange={handleChange} options={GOALS} />
                <Input label="Público atendido" name="patientAudience" value={formData.patientAudience} onChange={handleChange} placeholder="Ex: crianças, adultos, atletas, idosos, gestantes" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Como você atende?</label>
                  <textarea name="serviceStyle" value={formData.serviceStyle} onChange={handleChange} placeholder="Ex: atendimento acolhedor, objetivo, com plano prático e acompanhamento de retorno." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[100px]" />
                </div>
              </div>
            </Block>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-950 flex gap-3"><Sparkles className="w-5 h-5 flex-shrink-0" /><span><strong>Pronto para operar:</strong> agenda, IA, CRM, pacotes, backoffice e página pública em uma base.</span></div>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-950 flex gap-3"><ShieldCheck className="w-5 h-5 flex-shrink-0" /><span><strong>Recursos regulados:</strong> receitas, pedidos e assinatura oficial dependem de validação da habilitação.</span></div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Criando estrutura...' : 'Cadastrar e criar meu consultório digital'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">Já tem conta? <Link href="/login" className="text-emerald-600 font-medium hover:underline">Faça login</Link></p>
          </div>
        </section>
      </div>
    </main>
  )
}

function Benefit({ icon: Icon, text }: any) {
  return <div className="flex items-start gap-2 rounded-2xl bg-white/10 border border-white/10 p-3"><Icon className="w-4 h-4 text-emerald-200 mt-0.5 flex-shrink-0" /><span className="text-white/80">{text}</span></div>
}

function Block({ title, icon: Icon, children }: any) {
  return <section className="space-y-4"><h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Icon className="w-5 h-5 text-emerald-700" /> {title}</h3>{children}</section>
}

function Input({ label, icon: Icon, ...props }: any) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
        <input {...props} className={`${Icon ? 'pl-12' : 'pl-4'} w-full pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none`} />
      </div>
    </label>
  )
}

function Select({ label, options, placeholder, ...props }: any) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <select {...props} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
