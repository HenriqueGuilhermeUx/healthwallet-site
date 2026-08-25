'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, Copy, CreditCard, ExternalLink, Loader2, QrCode, RefreshCw, WalletCards } from 'lucide-react'

export default function CobrancasPage() {
  const { user, professional, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creatingId, setCreatingId] = useState('')
  const [entries, setEntries] = useState<any[]>([])

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
    if (error) toast.error('Rode SQL_MYDATAMED_OPS_BILLING_USAGE_V1.sql para ativar cobrança Pix.')
    setEntries(data || [])
    setLoading(false)
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
      toast.success('Cobrança Pix criada')
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

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><CreditCard className="w-4 h-4" /> Cobranças</div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">Cobrança Pix pela plataforma ou recebimento direto.</h1>
        <p className="text-white/70 mt-4 text-lg max-w-3xl">Selecione uma conta a receber, gere Pix e envie o link/copiar e cola para o paciente. O provedor de pagamento roda nos bastidores.</p>
        <button onClick={loadEntries} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-3 font-semibold"><RefreshCw className="w-4 h-4" /> Atualizar</button>
      </section>

      <section className="space-y-3">
        {entries.length ? entries.map((entry) => (
          <div key={entry.id} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5 grid lg:grid-cols-[1fr_0.8fr] gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{entry.status === 'paid' ? 'Pago' : 'Aberto'}</span>
                {entry.payment_method === 'platform_pix' && <span className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700">Pix plataforma</span>}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{entry.description}</h2>
              <p className="text-gray-500 text-sm mt-1">{entry.patient_name || 'Paciente não informado'}</p>
              <p className="text-2xl font-bold text-emerald-700 mt-3">{formatMoney(entry.amount_cents)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 border p-4 space-y-3">
              {entry.payment_url || entry.pix_copy_paste || entry.pix_qr_code_url ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle className="w-4 h-4" /> Pix gerado</div>
                  {entry.pix_qr_code_url && <img src={entry.pix_qr_code_url} alt="QR Code Pix" className="w-40 h-40 object-contain rounded-xl bg-white border" />}
                  {entry.payment_url && <a href={entry.payment_url} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold"><ExternalLink className="w-4 h-4" /> Abrir pagamento</a>}
                  {entry.pix_copy_paste && <button onClick={() => copy(entry.pix_copy_paste)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold"><Copy className="w-4 h-4" /> Copiar Pix</button>}
                </>
              ) : (
                <button onClick={() => createCharge(entry)} disabled={creatingId === entry.id || entry.status === 'paid'} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 font-semibold disabled:opacity-60">
                  {creatingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Gerar Pix
                </button>
              )}
            </div>
          </div>
        )) : (
          <div className="rounded-3xl border border-dashed p-10 text-center text-gray-500">
            <WalletCards className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            Nenhuma conta a receber. Crie no Backoffice ou na Agenda.
          </div>
        )}
      </section>
    </main>
  )
}

function formatMoney(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
