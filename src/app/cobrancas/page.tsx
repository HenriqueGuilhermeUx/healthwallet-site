'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, Copy, CreditCard, ExternalLink, Loader2, QrCode, RefreshCw, WalletCards } from 'lucide-react'

const paymentLabels: Record<string, string> = {
  platform_pix: 'Cobrança MyDataMed',
  own_pix: 'Pix próprio',
  external_card_link: 'Cartão/link externo',
  external_payment_link: 'Link externo',
  offline: 'Recebido fora',
  not_defined: 'Não definido',
  other: 'Outro',
}

export default function CobrancasPage() {
  const { user, professional, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creatingId, setCreatingId] = useState('')
  const [savingId, setSavingId] = useState('')
  const [entries, setEntries] = useState<any[]>([])
  const [forms, setForms] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadEntries()
  }, [user, professional])

  async function loadEntries() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('professional_financial_entries')
      .select('*')
      .eq('professional_user_id', user.id)
      .eq('entry_type', 'receivable')
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) toast.error('Rode SQL_MYDATAMED_PAYMENT_OPTIONS_PATCH.sql para ativar formas opcionais de recebimento.')
    setEntries(data || [])
    setForms(Object.fromEntries((data || []).map((entry: any) => [entry.id, {
      payment_preference: entry.payment_preference || entry.payment_method || 'not_defined',
      own_pix_key: entry.own_pix_key || '',
      external_payment_url: entry.external_payment_url || entry.payment_url || '',
      payment_instructions: entry.payment_instructions || '',
    }])))
    setLoading(false)
  }

  async function savePreference(entry: any) {
    if (!user) return
    const form = forms[entry.id] || {}
    setSavingId(entry.id)
    const { error } = await supabase
      .from('professional_financial_entries')
      .update({
        payment_preference: form.payment_preference || 'not_defined',
        own_pix_key: form.own_pix_key || null,
        external_payment_url: form.external_payment_url || null,
        payment_instructions: form.payment_instructions || null,
        payment_method: form.payment_preference === 'platform_pix' ? 'platform_pix' : form.payment_preference === 'own_pix' ? 'direct_pix' : form.payment_preference === 'external_card_link' ? 'card' : entry.payment_method,
        metadata: { ...(entry.metadata || {}), payment_preference_updated_at: new Date().toISOString() },
      })
      .eq('id', entry.id)
      .eq('professional_user_id', user.id)
    setSavingId('')
    if (error) toast.error(error.message || 'Erro ao salvar forma de recebimento')
    else { toast.success('Forma de recebimento salva'); loadEntries() }
  }

  async function markPaid(entry: any) {
    if (!user) return
    const { error } = await supabase
      .from('professional_financial_entries')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', entry.id)
      .eq('professional_user_id', user.id)
    if (error) toast.error('Erro ao marcar como pago')
    else { toast.success('Marcado como pago'); loadEntries() }
  }

  async function createCharge(entry: any) {
    if (!session?.access_token) return toast.error('Sessão inválida')
    setCreatingId(entry.id)
    try {
      const response = await fetch('/api/billing/pix-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ financial_entry_id: entry.id, customer_tax_id: entry.customer_tax_id || '' }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao gerar Pix')
      toast.success('Cobrança Pix MyDataMed criada')
      loadEntries()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar Pix')
    } finally {
      setCreatingId('')
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success('Copiado')
  }

  function updateForm(id: string, field: string, value: string) {
    setForms((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }))
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><CreditCard className="w-4 h-4" /> Recebimentos</div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">O profissional escolhe como quer receber.</h1>
        <p className="text-white/70 mt-4 text-lg max-w-3xl">Use cobrança MyDataMed quando quiser automação. Ou registre Pix próprio, cartão/link externo e recebimentos fora da plataforma. O financeiro, status e recibo ficam no MyDataMed.</p>
        <button onClick={loadEntries} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-3 font-semibold"><RefreshCw className="w-4 h-4" /> Atualizar</button>
      </section>

      <section className="space-y-3">
        {entries.length ? entries.map((entry) => {
          const form = forms[entry.id] || {}
          const hasPlatformCharge = entry.payment_url || entry.pix_copy_paste || entry.pix_qr_code_url
          return (
            <div key={entry.id} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5 grid lg:grid-cols-[1fr_0.9fr] gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{entry.status === 'paid' ? 'Pago' : 'Aberto'}</span>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700">{paymentLabels[form.payment_preference || 'not_defined']}</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{entry.description}</h2>
                <p className="text-gray-500 text-sm mt-1">{entry.patient_name || 'Paciente não informado'}</p>
                <p className="text-2xl font-bold text-emerald-700 mt-3">{formatMoney(entry.amount_cents)}</p>
                {entry.status === 'paid' && <a href={`/recibos/${entry.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold">Abrir recibo</a>}
              </div>

              <div className="rounded-2xl bg-gray-50 border p-4 space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Forma de recebimento</label>
                <select value={form.payment_preference || 'not_defined'} onChange={(e) => updateForm(entry.id, 'payment_preference', e.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm">
                  <option value="not_defined">Escolher depois</option>
                  <option value="platform_pix">Cobrança MyDataMed Pix</option>
                  <option value="own_pix">Pix próprio do profissional/clínica</option>
                  <option value="external_card_link">Cartão/link externo</option>
                  <option value="external_payment_link">Outro link de pagamento</option>
                  <option value="offline">Recebido fora da plataforma</option>
                  <option value="other">Outro</option>
                </select>

                {form.payment_preference === 'own_pix' && <Field label="Chave Pix própria" value={form.own_pix_key} onChange={(v: string) => updateForm(entry.id, 'own_pix_key', v)} />}
                {(form.payment_preference === 'external_card_link' || form.payment_preference === 'external_payment_link') && <Field label="Link externo de pagamento" value={form.external_payment_url} onChange={(v: string) => updateForm(entry.id, 'external_payment_url', v)} />}
                {form.payment_preference !== 'platform_pix' && <Area label="Instruções ao paciente" value={form.payment_instructions} onChange={(v: string) => updateForm(entry.id, 'payment_instructions', v)} />}

                <button onClick={() => savePreference(entry)} disabled={savingId === entry.id} className="w-full rounded-xl border bg-white px-4 py-3 font-semibold disabled:opacity-60">{savingId === entry.id ? 'Salvando...' : 'Salvar forma de recebimento'}</button>

                {form.payment_preference === 'platform_pix' && (
                  hasPlatformCharge ? (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle className="w-4 h-4" /> Pix MyDataMed gerado</div>
                      {entry.pix_qr_code_url && <img src={entry.pix_qr_code_url} alt="QR Code Pix" className="w-40 h-40 object-contain rounded-xl bg-white border" />}
                      {entry.payment_url && <a href={entry.payment_url} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold"><ExternalLink className="w-4 h-4" /> Abrir pagamento</a>}
                      {entry.pix_copy_paste && <button onClick={() => copy(entry.pix_copy_paste)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold"><Copy className="w-4 h-4" /> Copiar Pix</button>}
                    </div>
                  ) : (
                    <button onClick={() => createCharge(entry)} disabled={creatingId === entry.id || entry.status === 'paid'} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 font-semibold disabled:opacity-60">
                      {creatingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                      Gerar Pix MyDataMed
                    </button>
                  )
                )}

                {entry.status !== 'paid' && <button onClick={() => markPaid(entry)} className="w-full rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold">Marcar como pago</button>}
              </div>
            </div>
          )
        }) : (
          <div className="rounded-3xl border border-dashed p-10 text-center text-gray-500">
            <WalletCards className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            Nenhuma conta a receber. Crie no Backoffice ou na Agenda.
          </div>
        )}
      </section>
    </main>
  )
}

function Field({ label, value, onChange }: any) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><input value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm" /></label>
}
function Area({ label, value, onChange }: any) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[80px] rounded-xl border px-3 py-3 text-sm" /></label>
}
function formatMoney(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
