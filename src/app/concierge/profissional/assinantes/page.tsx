'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BadgeCheck,
  Circle,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const allowedRoles = new Set(['master','admin','care_coordinator','concierge_agent'])

const statusLabels: Record<string,string> = {
  inactive: 'Inativo',
  trial: 'Teste',
  active: 'Ativo',
  past_due: 'Pagamento pendente',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  grace: 'Carência',
}

export default function ConciergeSubscribersPage() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    void bootstrap()
  }, [user?.id])

  async function bootstrap() {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: team }, { data: concierge }] = await Promise.all([
        supabase.from('mydatamed_team_members').select('user_id,role,display_name,active').eq('user_id', user.id).maybeSingle(),
        supabase.from('concierge_staff').select('user_id,role,display_name,active').eq('user_id', user.id).maybeSingle(),
      ])

      const self = concierge?.active && allowedRoles.has(concierge.role)
        ? concierge
        : team?.active && allowedRoles.has(team.role)
          ? team
          : null

      setStaff(self)
      if (!self) return
      await load()
    } catch (error) {
      console.error('Subscriber readiness bootstrap failed:', error)
    } finally {
      setLoading(false)
    }
  }

  async function load(showToast = false) {
    const [readinessRes, membershipRes] = await Promise.all([
      supabase.from('concierge_subscriber_readiness').select('*').order('patient_id'),
      supabase.from('concierge_memberships').select('*').order('created_at', { ascending: false }),
    ])

    if (readinessRes.error) throw readinessRes.error
    if (membershipRes.error) throw membershipRes.error

    setRows(readinessRes.data || [])
    setMemberships(membershipRes.data || [])
    if (showToast) toast.success('Assinantes atualizados.')
  }

  function memberFor(patientId: string) {
    return memberships.find((item) => item.patient_id === patientId)
  }

  function patientLabel(patientId: string) {
    const member = memberFor(patientId)
    return member?.metadata?.patient_name
      || member?.metadata?.patient_email
      || `Paciente ${patientId.slice(0, 8)}`
  }

  async function setAccess(patientId: string, status: 'active'|'paused'|'cancelled') {
    setBusyId(patientId)
    try {
      const member = memberFor(patientId)
      const planCode = String(member?.plan_code || 'concierge_standard')

      const entitlementPayload: Record<string,any> = {
        patient_id: patientId,
        plan_code: planCode.startsWith('concierge') ? planCode : 'concierge_standard',
        status,
        billing_provider: null,
        metadata: {
          source: 'mydatamed_subscriber_console',
          manual_activation: true,
          managed_by: user?.id || null,
        },
      }

      if (status === 'active') entitlementPayload.activated_at = new Date().toISOString()
      if (status === 'cancelled') entitlementPayload.cancelled_at = new Date().toISOString()

      const { error: entitlementError } = await supabase
        .from('concierge_entitlements')
        .upsert(entitlementPayload, { onConflict: 'patient_id' })
      if (entitlementError) throw entitlementError

      const membershipPatch: Record<string,any> = {
        status: status === 'active' ? 'active' : status,
        plan_code: entitlementPayload.plan_code,
      }

      const { error: membershipError } = await supabase
        .from('concierge_memberships')
        .update(membershipPatch)
        .eq('patient_id', patientId)
      if (membershipError) throw membershipError

      toast.success(status === 'active' ? 'Acesso Concierge ativado.' : status === 'paused' ? 'Acesso pausado.' : 'Acesso cancelado.')
      await load()
    } catch (error) {
      console.error('Subscriber access update failed:', error)
      toast.error('Não foi possível atualizar o acesso.')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'ready') return rows.filter((item) => item.entitlement_status === 'active' && item.consent_status === 'accepted' && item.privacy_ready && item.representation_ready)
    if (filter === 'pending') return rows.filter((item) => !(item.entitlement_status === 'active' && item.consent_status === 'accepted' && item.privacy_ready && item.representation_ready))
    if (filter === 'whatsapp') return rows.filter((item) => item.whatsapp_ready)
    return rows
  }, [rows, filter])

  const stats = {
    total: rows.length,
    ready: rows.filter((item) => item.entitlement_status === 'active' && item.consent_status === 'accepted' && item.privacy_ready && item.representation_ready).length,
    whatsapp: rows.filter((item) => item.whatsapp_ready).length,
    pending: rows.filter((item) => !(item.entitlement_status === 'active' && item.consent_status === 'accepted' && item.privacy_ready && item.representation_ready)).length,
  }

  if (authLoading || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  if (!staff?.active) {
    return <main className="mx-auto max-w-4xl px-4 py-10"><div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-500">Acesso restrito à coordenação comercial/operacional do Concierge.</div></main>
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-900 p-6 text-white">
        <Link href="/concierge/profissional" className="inline-flex items-center gap-2 text-sm text-white/65"><ArrowLeft className="h-4 w-4" /> Concierge</Link>
        <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wider text-white/60"><Users className="h-4 w-4" /> Assinantes & readiness</div>
        <h1 className="mt-2 text-3xl font-bold">Quem está pronto para operar?</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/75">Plano, consentimento, assinatura DocWallet, representação, WhatsApp e demanda operacional em uma única visão.</p>

        <div className="mt-5 grid grid-cols-4 gap-2">
          <Stat label="Assinantes" value={stats.total} />
          <Stat label="Prontos" value={stats.ready} />
          <Stat label="WhatsApp" value={stats.whatsapp} />
          <Stat label="Pendências" value={stats.pending} />
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ['all','Todos'],
              ['ready','Prontos'],
              ['pending','Com pendências'],
              ['whatsapp','WhatsApp'],
            ].map(([value,label]) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-2 text-xs font-bold ${filter === value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => void load(true)} className="rounded-xl border p-2.5 text-gray-600"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </section>

      <section className="space-y-3">
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">Nenhum assinante neste filtro.</div>}

        {filtered.map((item) => {
          const member = memberFor(item.patient_id)
          const fullyReady = item.entitlement_status === 'active' && item.consent_status === 'accepted' && item.privacy_ready && item.representation_ready
          return (
            <article key={item.patient_id} className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold">{patientLabel(item.patient_id)}</p>
                    {fullyReady && <BadgeCheck className="h-5 w-5 text-emerald-600" />}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{member?.metadata?.patient_email || item.patient_id}</p>
                  <p className="mt-2 text-xs font-semibold text-gray-600">Plano: {item.plan_code || member?.plan_code || '—'} · {statusLabels[item.entitlement_status] || item.entitlement_status}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.entitlement_status !== 'active' && (
                    <button disabled={busyId === item.patient_id} onClick={() => void setAccess(item.patient_id, 'active')} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Ativar acesso</button>
                  )}
                  {item.entitlement_status === 'active' && (
                    <button disabled={busyId === item.patient_id} onClick={() => void setAccess(item.patient_id, 'paused')} className="rounded-xl border px-3 py-2 text-xs font-bold">Pausar</button>
                  )}
                  <Link href={`/concierge/profissional/paciente/${item.patient_id}`} className="rounded-xl border px-3 py-2 text-xs font-bold">Abrir paciente</Link>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <ReadyChip icon={WalletCards} label="Plano" ready={['active','trial','grace'].includes(item.entitlement_status)} detail={statusLabels[item.entitlement_status] || item.entitlement_status} />
                <ReadyChip icon={ShieldCheck} label="Consentimento" ready={item.consent_status === 'accepted'} detail={item.consent_status === 'accepted' ? 'Aceito' : 'Pendente'} />
                <ReadyChip icon={BadgeCheck} label="Representação" ready={Boolean(item.representation_ready)} detail={item.representation_ready ? 'Assinada' : 'Pendente'} />
                <ReadyChip icon={Smartphone} label="WhatsApp" ready={Boolean(item.whatsapp_ready)} detail={item.whatsapp_ready ? 'Verificado' : 'Não conectado'} />
                <ReadyChip icon={Users} label="Círculo" ready={Boolean(item.has_care_circle)} detail={item.has_care_circle ? 'Configurado' : 'Sem familiar'} optional />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {Number(item.open_operational_cases || 0) > 0 && <Link href="/concierge/profissional/navegacao" className="rounded-full bg-amber-50 px-3 py-2 font-bold text-amber-800">{item.open_operational_cases} caso(s) de plano</Link>}
                {Number(item.open_concierge_requests || 0) > 0 && <span className="rounded-full bg-blue-50 px-3 py-2 font-bold text-blue-800">{item.open_concierge_requests} solicitação(ões)</span>}
                {item.whatsapp_ready && <Link href="/concierge/profissional/conversas" className="rounded-full bg-emerald-50 px-3 py-2 font-bold text-emerald-800"><MessageCircle className="mr-1 inline h-3.5 w-3.5" /> Conversas</Link>}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-3 text-center"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-white/65">{label}</p></div>
}

function ReadyChip({ icon: Icon, label, ready, detail, optional = false }: { icon: any; label: string; ready: boolean; detail: string; optional?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${ready ? 'border-emerald-200 bg-emerald-50' : optional ? 'bg-slate-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-2">
        {ready ? <BadgeCheck className="h-4 w-4 text-emerald-700" /> : <Circle className="h-4 w-4 text-slate-400" />}
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 text-[11px] text-gray-600">{detail}{optional ? ' · opcional' : ''}</p>
    </div>
  )
}
