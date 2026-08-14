'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  Database,
  Eye,
  FileText,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'

type LgpdStats = {
  aiLogs: number
  clinicalNotes: number
  healthwalletAccesses: number
  guestPatients: number
}

const emptyStats: LgpdStats = { aiLogs: 0, clinicalNotes: 0, healthwalletAccesses: 0, guestPatients: 0 }

export default function LgpdConsultorioPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<LgpdStats>(emptyStats)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional) load()
  }, [user, professional])

  async function load() {
    if (!user || !professional) return
    setLoading(true)
    try {
      const [logsRes, notesRes, accessesRes, guestsRes] = await Promise.all([
        supabase.from('clinical_ai_usage_logs').select('id').eq('professional_user_id', user.id).limit(1000),
        supabase.from('clinical_notes').select('id').eq('professional_user_id', user.id).limit(1000),
        supabase.from('access_codes').select('id').eq('professional_id', professional.id).limit(1000),
        supabase.from('guest_patients').select('id').eq('professional_user_id', user.id).limit(1000),
      ])
      setStats({
        aiLogs: (logsRes.data || []).length,
        clinicalNotes: (notesRes.data || []).length,
        healthwalletAccesses: (accessesRes.data || []).length,
        guestPatients: (guestsRes.data || []).length,
      })
    } catch {
      // LGPD visual continua como checklist mesmo se alguma tabela opcional não existir.
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-blue-950 via-slate-950 to-emerald-950 text-white p-6 md:p-8 shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold mb-4"><ShieldCheck className="w-4 h-4" /> LGPD do consultório</div>
          <h1 className="text-3xl md:text-4xl font-bold">Privacidade como produto, não como burocracia escondida.</h1>
          <p className="text-white/75 mt-3">Dados de saúde são sensíveis. O MyDataMed deixa consentimentos, acessos, uso de IA e registros clínicos mais visíveis para o profissional pequeno.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/consulta-assistida" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-950 px-5 py-3 font-semibold hover:bg-emerald-50">Atendimento com consentimento <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/consultorio" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">Voltar ao consultório</Link>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-3">
        <Stat label="Uso de IA registrado" value={stats.aiLogs} loading={loading} icon={Eye} />
        <Stat label="Notas clínicas" value={stats.clinicalNotes} loading={loading} icon={FileText} />
        <Stat label="Acessos HealthWallet" value={stats.healthwalletAccesses} loading={loading} icon={UserCheck} />
        <Stat label="Pacientes avulsos" value={stats.guestPatients} loading={loading} icon={Database} />
      </section>

      <section className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4"><ClipboardCheck className="w-5 h-5 text-emerald-700" /><h2 className="font-bold text-gray-900">Checklist prático</h2></div>
          <div className="space-y-3">
            <ChecklistItem title="Consentimento antes de gravar/transcrever" description="A Consulta Assistida exige confirmação antes de iniciar o atendimento por voz." done />
            <ChecklistItem title="Separar paciente avulso de paciente HealthWallet" description="O escopo dos dados fica claro: somente consulta ou dados autorizados + consulta." done />
            <ChecklistItem title="Registrar uso de IA" description="Cada análise/cards/resumo gera log de apoio e auditoria." done />
            <ChecklistItem title="Revisão profissional obrigatória" description="A IA gera rascunho; o profissional revisa, edita e valida antes de salvar." done />
            <ChecklistItem title="Relatório exportável de LGPD" description="Fase seguinte: baixar PDF/CSV com consentimentos, acessos e auditorias." />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4"><Lock className="w-5 h-5 text-blue-700" /><h2 className="font-bold text-gray-900">Como vender isso para o profissional</h2></div>
          <div className="space-y-3 text-sm text-gray-700">
            <p className="rounded-2xl bg-blue-50 border border-blue-100 p-4"><strong>Consultório pequeno não tem DPO.</strong> Ele precisa de um caminho simples para pedir consentimento, registrar acesso e mostrar organização.</p>
            <p className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><strong>LGPD vira confiança.</strong> O paciente entende que seus dados, áudio, transcrição e histórico têm escopo e finalidade.</p>
            <p className="rounded-2xl bg-violet-50 border border-violet-100 p-4"><strong>IA com trilha.</strong> O sistema registra quando a IA apoiou o atendimento e reforça que a validação é do profissional.</p>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <PrivacyCard icon={Shield} title="Consentimentos" description="Gravação, transcrição, IA, compartilhamento e HealthWallet devem ter finalidade clara." />
        <PrivacyCard icon={Eye} title="Auditoria" description="Uso da IA, notas salvas e acessos autorizados ficam rastreáveis no consultório." />
        <PrivacyCard icon={Database} title="Minimização" description="Paciente avulso usa apenas dados do atendimento; HealthWallet depende de autorização." />
      </section>
    </div>
  )
}

function Stat({ label, value, loading, icon: Icon }: any) {
  return <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"><Icon className="w-5 h-5 text-emerald-700 mb-2" /><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : value}</p></div>
}

function ChecklistItem({ title, description, done = false }: { title: string; description: string; done?: boolean }) {
  return <div className="flex gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-4"><CheckCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${done ? 'text-emerald-700' : 'text-gray-300'}`} /><div><p className="font-semibold text-gray-900 text-sm">{title}</p><p className="text-xs text-gray-600 mt-1">{description}</p></div></div>
}

function PrivacyCard({ icon: Icon, title, description }: any) {
  return <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm"><Icon className="w-7 h-7 text-blue-700 mb-3" /><h3 className="font-bold text-gray-900">{title}</h3><p className="text-sm text-gray-600 mt-1">{description}</p></div>
}
