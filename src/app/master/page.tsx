'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const ROLE_OPTIONS = [
  ['master', 'MASTER'],
  ['admin', 'Admin operacional'],
  ['care_coordinator', 'Coordenação Concierge'],
  ['concierge_agent', 'Concierge operacional'],
  ['nurse', 'Enfermagem Concierge'],
  ['doctor', 'Médico Concierge'],
  ['professional', 'Profissional MyDataMed'],
] as const

const PROFESSIONAL_TYPES = [
  ['medico', 'Médico(a)'],
  ['enfermeiro', 'Enfermeiro(a)'],
  ['nutricionista', 'Nutricionista'],
  ['fisioterapeuta', 'Fisioterapeuta'],
  ['psicologo', 'Psicólogo(a)'],
  ['terapeuta', 'Terapeuta'],
  ['fonoaudiologo', 'Fonoaudiólogo(a)'],
  ['odonto', 'Odontólogo(a)'],
  ['farmaceutico', 'Farmacêutico(a)'],
  ['educador_fisico', 'Educador(a) físico(a)'],
  ['outro', 'Outro profissional'],
] as const

function roleLabel(role: string) {
  return ROLE_OPTIONS.find(([value]) => value === role)?.[1] || role
}

export default function MasterConsolePage() {
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    role: 'concierge_agent',
    specialty: '',
    cpf: '',
    professionalRegister: '',
    registerState: 'SP',
    professionalType: 'outro',
    verificationStatus: 'pending',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (session?.access_token) void load()
  }, [session?.access_token])

  async function api(path: string, init?: RequestInit) {
    if (!session?.access_token) throw new Error('Sessão expirada.')
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token,
        ...(init?.headers || {}),
      },
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Erro na operação.')
    return payload
  }

  async function load() {
    setLoading(true)
    try {
      const data = await api('/api/master/team')
      setTeam(data.team || [])
    } catch (error: any) {
      toast.error(error?.message || 'Acesso MASTER indisponível.')
    } finally {
      setLoading(false)
    }
  }

  async function createMember() {
    if (!form.email.trim() || !form.displayName.trim()) {
      toast.error('Informe nome e e-mail.')
      return
    }

    setSaving(true)
    try {
      const data = await api('/api/master/team', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success(data.invited
        ? 'Convite enviado e membro cadastrado.'
        : 'Usuário existente vinculado à equipe.')
      setForm({
        email: '',
        displayName: '',
        role: 'concierge_agent',
        specialty: '',
        cpf: '',
        professionalRegister: '',
        registerState: 'SP',
        professionalType: 'outro',
        verificationStatus: 'pending',
      })
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cadastrar.')
    } finally {
      setSaving(false)
    }
  }

  async function updateMember(userId: string, patch: Record<string, unknown>) {
    setBusyId(userId)
    try {
      await api('/api/master/team', {
        method: 'PATCH',
        body: JSON.stringify({ userId, ...patch }),
      })
      toast.success('Equipe atualizada')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar.')
    } finally {
      setBusyId(null)
    }
  }

  const needsProfessionalData = ['doctor', 'nurse', 'professional'].includes(form.role)
  const stats = useMemo(() => ({
    active: team.filter((item) => item.active).length,
    concierge: team.filter((item) => ['care_coordinator', 'concierge_agent', 'nurse', 'doctor'].includes(item.role) && item.active).length,
    clinical: team.filter((item) => ['nurse', 'doctor', 'professional'].includes(item.role) && item.active).length,
    masters: team.filter((item) => item.role === 'master' && item.active).length,
  }), [team])

  if (authLoading || loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-violet-950 p-7 md:p-9 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="w-4 h-4" /> MyDataMed MASTER
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold">Equipe, permissões e operação em um só lugar.</h1>
            <p className="mt-3 max-w-3xl text-white/75">Cadastre profissionais, médicos, enfermagem, coordenação e operadores do Concierge. O acesso clínico continua separado do acesso operacional.</p>
          </div>
          <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/15">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric icon={Users} label="Ativos" value={stats.active} />
        <Metric icon={UserCog} label="Concierge" value={stats.concierge} />
        <Metric icon={Stethoscope} label="Clínicos" value={stats.clinical} />
        <Metric icon={ShieldCheck} label="Masters" value={stats.masters} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><UserPlus className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cadastrar / convidar</h2>
              <p className="text-sm text-gray-500">Se o e-mail já existir, o usuário é apenas vinculado à equipe.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <Input label="Nome" value={form.displayName} onChange={(value: string) => setForm({ ...form, displayName: value })} placeholder="Nome do profissional ou operador" />
            <Input label="E-mail" value={form.email} onChange={(value: string) => setForm({ ...form, email: value })} placeholder="email@exemplo.com" type="email" />

            <label className="text-sm font-medium text-gray-700">
              Função
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3">
                {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <Input label="Especialidade / área" value={form.specialty} onChange={(value: string) => setForm({ ...form, specialty: value })} placeholder="Opcional" />

            {needsProfessionalData && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Stethoscope className="mt-0.5 w-4 h-4 text-violet-700" />
                  <div>
                    <p className="text-sm font-bold text-violet-950">Perfil profissional MyDataMed</p>
                    <p className="mt-1 text-xs text-violet-900/70">Preencha os dados abaixo para criar também o perfil profissional. Sem eles, o vínculo de equipe é criado e o onboarding profissional pode ser concluído depois.</p>
                  </div>
                </div>

                <Input label="CPF" value={form.cpf} onChange={(value: string) => setForm({ ...form, cpf: value })} placeholder="Somente números ou formatado" />
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Input label="Registro profissional" value={form.professionalRegister} onChange={(value: string) => setForm({ ...form, professionalRegister: value })} placeholder="CRM, COREN, CREFITO..." />
                  <Input label="UF" value={form.registerState} onChange={(value: string) => setForm({ ...form, registerState: value.toUpperCase().slice(0, 2) })} />
                </div>
                <label className="text-sm font-medium text-gray-700">
                  Categoria profissional
                  <select value={form.professionalType} onChange={(e) => setForm({ ...form, professionalType: e.target.value })} className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-3">
                    {PROFESSIONAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Verificação inicial
                  <select value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })} className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-3">
                    <option value="pending">Pendente</option>
                    <option value="verified">Verificado</option>
                    <option value="self_declared">Autodeclarado</option>
                  </select>
                </label>
              </div>
            )}

            <button onClick={createMember} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              {saving ? 'Cadastrando...' : 'Cadastrar e enviar acesso'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Equipe MyDataMed</h2>
              <p className="mt-1 text-sm text-gray-500">MASTER controla quem entra e qual camada cada pessoa opera.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{team.length} pessoas</span>
          </div>

          <div className="mt-5 space-y-3">
            {team.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">Nenhum membro carregado.</div>}
            {team.map((member) => (
              <div key={member.user_id} className="rounded-2xl border bg-gray-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900">{member.display_name || member.email}</p>
                      {member.role === 'master' && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800"><BadgeCheck className="w-3 h-3" /> MASTER</span>}
                      <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + (member.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600')}>{member.active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">{member.email}</p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={member.role}
                      disabled={busyId === member.user_id || (member.user_id === user?.id && member.role === 'master')}
                      onChange={(e) => updateMember(member.user_id, { role: e.target.value })}
                      className="rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-60"
                    >
                      {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button
                      disabled={busyId === member.user_id || (member.user_id === user?.id && member.role === 'master')}
                      onClick={() => updateMember(member.user_id, { active: !member.active })}
                      className={'rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 ' + (member.active ? 'border border-red-200 bg-white text-red-700' : 'bg-emerald-700 text-white')}
                    >
                      {busyId === member.user_id ? '...' : member.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">Função atual: <strong>{roleLabel(member.role)}</strong></p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 w-5 h-5 shrink-0 text-blue-700" />
          <div>
            <p className="font-bold text-blue-950">Separação de privilégios</p>
            <p className="mt-1 text-sm leading-relaxed text-blue-900/75">Concierge operacional pode pesquisar prestadores e fechar agendamentos sem receber automaticamente acesso a exames, medicamentos ou contexto clínico. Enfermagem e médico continuam sujeitos às regras específicas do Concierge clínico.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: any) {
  return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Icon className="w-5 h-5 text-emerald-700" /><p className="mt-3 text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
}

function Input({ label, value, onChange, placeholder = '', type = 'text' }: any) {
  return <label className="text-sm font-medium text-gray-700">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 font-normal text-gray-900" /></label>
}
