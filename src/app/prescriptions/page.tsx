'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api, type Receita } from '@/lib/api'
import { FileText, Plus, Loader2, Calendar, User, ChevronRight, AlertCircle, LogIn, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho:                 { label: 'Rascunho',         cls: 'bg-gray-100 text-gray-700' },
  aguardando_assinatura:    { label: 'Aguard. assinatura', cls: 'bg-amber-100 text-amber-800' },
  assinada:                 { label: 'Assinada',         cls: 'bg-emerald-100 text-emerald-800' },
  cancelada:                { label: 'Cancelada',        cls: 'bg-red-100 text-red-800' },
  expirada:                 { label: 'Expirada',         cls: 'bg-orange-100 text-orange-800' },
}

const TIPO_LABEL: Record<string, string> = {
  simples: 'Simples',
  controle_especial_branca: 'Controle Especial',
  azul_b1b2: 'Receita B (Azul)',
  amarela_a1a2: 'Receita A (Amarela)',
}

export default function PrescriptionsListPage() {
  const { user, professional, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!authLoading && user && !professional) {
      setLoadError('Seu usuário está logado, mas o perfil profissional não foi encontrado. Isso pode acontecer se o cadastro foi feito há muito tempo ou em outro ambiente. Tente fazer logout e login novamente.')
    }
  }, [user, professional, authLoading])

  useEffect(() => {
    if (!professional) return
    if (!canUsePrescriptions(professional)) {
      setLoading(false)
      return
    }
    load()
  }, [professional, filter])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.listPrescriptions(filter || undefined)
      setItems(data as Receita[])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar'
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <p className="text-sm text-gray-500">Verificando sessão…</p>
      </div>
    )
  }

  if (user && !professional && loadError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <h2 className="text-lg font-semibold text-gray-900">Perfil profissional não encontrado</h2>
        <p className="text-sm text-gray-600">{loadError}</p>
        <div className="flex gap-2">
          <button onClick={async () => { await signOut(); router.push('/login') }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            <LogIn className="w-4 h-4" /> Fazer logout e login
          </button>
        </div>
      </div>
    )
  }

  if (!professional) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <p className="text-sm text-gray-500">Carregando perfil…</p>
      </div>
    )
  }

  if (!canUsePrescriptions(professional)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-lg p-8">
          <ShieldCheck className="w-14 h-14 text-amber-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Prescrição exige verificação</h1>
          <p className="text-gray-600 mt-3">Seu workspace, Consulta Assistida, IA, pacientes, notas e CRM podem ser usados no modo autodeclarado. Para emitir receitas ou documentos formais, precisamos validar categoria profissional, registro e permissões aplicáveis.</p>
          <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950 text-left">
            <strong>Status atual:</strong> {professional.verification_status === 'verified' ? 'verificado' : 'autodeclarado'}<br />
            <strong>Profissão:</strong> {professional.professional_type}<br />
            <strong>Bloqueado até verificação:</strong> prescrição, assinatura oficial e documentos regulados.
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/consulta-assistida" className="px-5 py-3 rounded-xl bg-violet-700 text-white font-semibold hover:bg-violet-800">Usar Consulta Assistida</Link>
            <Link href="/meu-jeito-atender" className="px-5 py-3 rounded-xl border border-emerald-200 text-emerald-700 font-semibold hover:bg-emerald-50">Meu jeito de atender</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
          <p className="text-sm text-gray-500 mt-1">Suas prescrições digitais e rascunhos</p>
        </div>
        <Link href="/prescriptions/new" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" /> Nova receita
        </Link>
      </div>

      {loadError && !loading && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Erro ao carregar receitas</p>
            <p className="text-sm text-amber-800 mt-1">{loadError}</p>
          </div>
          <button onClick={load} className="text-sm text-amber-900 hover:text-amber-700 font-medium flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Tentar de novo
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { v: '', label: 'Todas' },
          { v: 'rascunho', label: 'Rascunhos' },
          { v: 'aguardando_assinatura', label: 'Aguardando' },
          { v: 'assinada', label: 'Assinadas' },
        ].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${filter === f.v ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">{filter ? 'Nenhuma receita com esse filtro' : 'Você ainda não tem receitas'}</p>
          <Link href="/prescriptions/new" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Criar primeira receita
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {items.map((r) => {
            const badge = STATUS_BADGE[r.status] || STATUS_BADGE.rascunho
            return (
              <Link key={r.id} href={`/prescriptions/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-emerald-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">Receita #{r.id}</span>
                    <span className="text-xs text-gray-500">{TIPO_LABEL[r.tipo] || r.tipo}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(r.data_emissao).toLocaleDateString('pt-BR')}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />Paciente {r.paciente_id.slice(0, 8)}…</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function canUsePrescriptions(professional: any) {
  if (professional.professional_type !== 'medico') return false
  const blocked = Array.isArray(professional.blocked_capabilities) ? professional.blocked_capabilities : []
  const allowed = Array.isArray(professional.allowed_capabilities) ? professional.allowed_capabilities : []
  if (professional.verification_status !== 'verified') return false
  if (blocked.includes('prescription')) return false
  return allowed.includes('prescription') || professional.verification_status === 'verified'
}
