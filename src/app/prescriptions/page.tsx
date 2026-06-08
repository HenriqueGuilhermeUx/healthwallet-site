'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api, type Receita } from '@/lib/api'
import { FileText, Plus, Loader2, Calendar, User, ChevronRight } from 'lucide-react'
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
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!professional) return
    load()
  }, [professional, filter])

  async function load() {
    setLoading(true)
    try {
      const data = await api.listPrescriptions(filter || undefined)
      setItems(data as Receita[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !professional) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
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
        <Link
          href="/prescriptions/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova receita
        </Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { v: '', label: 'Todas' },
          { v: 'rascunho', label: 'Rascunhos' },
          { v: 'aguardando_assinatura', label: 'Aguardando' },
          { v: 'assinada', label: 'Assinadas' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === f.v
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">
            {filter ? 'Nenhuma receita com esse filtro' : 'Você ainda não tem receitas'}
          </p>
          <Link
            href="/prescriptions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Criar primeira receita
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {items.map((r) => {
            const badge = STATUS_BADGE[r.status] || STATUS_BADGE.rascunho
            return (
              <Link
                key={r.id}
                href={`/prescriptions/${r.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">Receita #{r.id}</span>
                    <span className="text-xs text-gray-500">{TIPO_LABEL[r.tipo] || r.tipo}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.data_emissao).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Paciente {r.paciente_id.slice(0, 8)}…
                    </span>
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
