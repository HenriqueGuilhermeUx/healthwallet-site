'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import {
  ArrowRight,
  CreditCard,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react'

export default function BuscarPacientePage() {
  const { user, session, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  async function searchPatient() {
    if (!session?.access_token) {
      toast.error('Sessão expirada. Entre novamente.')
      return
    }

    if (!query.trim()) {
      toast.error('Informe CPF ou CNS/Cartão SUS.')
      return
    }

    setLoading(true)
    setSearched(true)
    setResults([])

    const response = await fetch('/api/patient-lookup/cns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ query }),
    })

    const payload = await response.json()
    setLoading(false)

    if (!response.ok) {
      toast.error(payload.error || 'Erro ao buscar paciente')
      return
    }

    setResults(payload.results || [])
    if (!payload.found) toast.info(payload.message || 'Nenhum paciente encontrado')
  }

  if (authLoading || !professional) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="rounded-3xl bg-slate-950 text-white p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <p className="text-emerald-200 text-sm font-medium">Busca complementar</p>
            <h1 className="text-2xl md:text-3xl font-bold">Buscar paciente por CPF ou CNS/Cartão SUS</h1>
            <p className="text-white/70 mt-2 max-w-3xl">
              Localize pacientes cadastrados com vínculo SUS informado. O acesso aos dados continua dependendo de autorização, código ou consulta vinculada.
            </p>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="grid md:grid-cols-[1fr_auto] gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchPatient()}
            placeholder="Digite CPF ou CNS/Cartão SUS"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button onClick={searchPatient} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Buscar
          </button>
        </div>

        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 flex gap-3">
          <ShieldCheck className="w-5 h-5 mt-0.5" />
          <p>
            A busca é complementar e protegida. Mesmo quando o paciente é localizado, o profissional só abre dados se já tiver autorização registrada. Caso contrário, solicite o código pelo HealthWallet.
          </p>
        </div>
      </section>

      {searched && (
        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Resultado</h2>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              {results.map((item, index) => (
                <div key={index} className="rounded-2xl border bg-gray-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${item.authorized ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.authorized ? 'Autorizado' : 'Precisa autorização'}
                      </span>
                      <span className="text-xs rounded-full px-2 py-0.5 bg-white border text-gray-600">CNS {item.cns_masked || 'não informado'}</span>
                      <span className="text-xs rounded-full px-2 py-0.5 bg-white border text-gray-600">CPF {item.cpf_masked || 'não informado'}</span>
                    </div>
                    <p className="font-semibold text-gray-900 mt-2">{item.message}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {[item.sus_ubs_reference, item.sus_municipality].filter(Boolean).join(' · ') || 'UBS/município não informado'}
                    </p>
                  </div>

                  {item.authorized ? (
                    <Link href={`/patient/${item.access_code_id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold">
                      <UserCheck className="w-4 h-4" /> Abrir paciente
                    </Link>
                  ) : (
                    <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border px-4 py-2 text-sm font-semibold text-gray-700">
                      <KeyRound className="w-4 h-4" /> Pedir código
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              Nenhum paciente localizado por CPF/CNS nos dados cadastrados.
            </div>
          )}
        </section>
      )}

      <section className="grid md:grid-cols-3 gap-4">
        <InfoCard icon={Stethoscope} title="Profissionais" text="Encontram pacientes já autorizados e ganham contexto para atendimento." />
        <InfoCard icon={CreditCard} title="CNS / Cartão SUS" text="Funciona como vínculo operacional complementar informado pelo cidadão ou município." />
        <InfoCard icon={ShieldCheck} title="Privacidade" text="Sem autorização, o resultado não abre dados clínicos do paciente." />
      </section>
    </main>
  )
}

function InfoCard({ icon: Icon, title, text }: any) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
      <Icon className="w-7 h-7 text-emerald-600 mb-3" />
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{text}</p>
    </div>
  )
}
