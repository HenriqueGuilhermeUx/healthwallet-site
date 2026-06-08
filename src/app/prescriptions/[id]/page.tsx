'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api, type Receita } from '@/lib/api'
import { ClicksignWidget } from '@/components/ClicksignWidget'
import { ArrowLeft, Send, Loader2, FileText, CheckCircle2, ExternalLink, Download, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho:              { label: 'Rascunho',            cls: 'bg-gray-100 text-gray-700' },
  aguardando_assinatura: { label: 'Aguardando assinatura', cls: 'bg-amber-100 text-amber-800' },
  assinada:              { label: 'Assinada',            cls: 'bg-emerald-100 text-emerald-800' },
  cancelada:             { label: 'Cancelada',           cls: 'bg-red-100 text-red-800' },
  expirada:              { label: 'Expirada',            cls: 'bg-orange-100 text-orange-800' },
}

export default function PrescriptionDetailPage() {
  const { professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = Number(params?.id)
  const [receita, setReceita] = useState<Receita | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!authLoading && !professional) router.push('/login')
  }, [professional, authLoading, router])

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setLoading(true)
    try {
      const data = await api.getPrescription(id)
      setReceita(data as Receita)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Polling pra detectar quando a assinatura finaliza (Clicksign demora 30s-2min)
  useEffect(() => {
    if (!receita || receita.status !== 'aguardando_assinatura' || !polling) return
    const t = setInterval(async () => {
      try {
        const data = (await api.getPrescription(id)) as Receita
        if (data.status === 'assinada' || data.status === 'cancelada' || data.status === 'expirada') {
          setReceita(data)
          setPolling(false)
          if (data.status === 'assinada') toast.success('Receita assinada! PDF disponível abaixo.')
        }
      } catch { /* keep polling */ }
    }, 5000)
    return () => clearInterval(t)
  }, [receita?.status, polling, id])

  async function handleSend() {
    if (!receita) return
    setSending(true)
    try {
      const res = await api.sendPrescription(receita.id)
      setReceita({ ...receita, status: res.status, clicksign_sign_url: res.signUrl })
      setPolling(true)
      toast.success('Envelope criado! Abra a tela de assinatura abaixo.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro'
      if (msg.includes('CRM não validado')) {
        toast.error('Valide seu CRM antes de enviar. Vá em Configurações.', { duration: 5000 })
      } else {
        toast.error(msg)
      }
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!receita) return
    if (!confirm('Tem certeza que quer deletar esta receita? Ela será removida permanentemente.')) return
    try {
      await api.deletePrescription(receita.id)
      toast.success('Receita deletada')
      router.push('/prescriptions')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao deletar')
    }
  }

  if (authLoading || !professional) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }
  if (!receita) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Receita não encontrada</p>
        <Link href="/prescriptions" className="text-emerald-600 hover:underline">Voltar</Link>
      </div>
    )
  }

  const badge = STATUS_BADGE[receita.status] || STATUS_BADGE.rascunho

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/prescriptions" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Receita #{receita.id}</h1>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(receita.data_emissao).toLocaleString('pt-BR')}
          </p>
        </div>
        {receita.status === 'rascunho' && (
          <button
            onClick={handleDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Deletar rascunho"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Ações por status */}
      {receita.status === 'rascunho' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-900">Esta receita ainda é um rascunho</p>
            <p className="text-sm text-amber-800">Envie para que o sistema gere o PDF e abra a tela de assinatura digital.</p>
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar p/ assinatura
          </button>
        </div>
      )}

      {receita.status === 'aguardando_assinatura' && receita.clicksign_sign_url && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-gray-900">Assinatura digital pendente</h2>
            {polling && <span className="text-xs text-gray-500 ml-2">• verificando automaticamente…</span>}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Assine o documento abaixo com seu certificado digital ICP-Brasil (e-CPF, em nuvem ou token).
          </p>
          <ClicksignWidget
            signUrl={receita.clicksign_sign_url}
            onSigned={() => {
              setPolling(true)
              toast.info('Detectamos a assinatura. Confirmando com o servidor…')
            }}
            height={680}
          />
        </div>
      )}

      {receita.status === 'assinada' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900">Receita assinada digitalmente</p>
              <p className="text-sm text-emerald-800">
                Assinada em {receita.assinado_em ? new Date(receita.assinado_em).toLocaleString('pt-BR') : '—'}
                {receita.enviado_paciente_em && ' • Enviada ao paciente'}
              </p>
            </div>
            {receita.pdf_assinado_url && (
              <a
                href={receita.pdf_assinado_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Baixar PDF
              </a>
            )}
          </div>
        </div>
      )}

      {/* Resumo da receita */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Resumo</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Paciente:</span>{' '}
            <span className="text-gray-900">{receita.paciente_nome || receita.paciente_id.slice(0, 8) + '…'}</span>
          </div>
          <div>
            <span className="text-gray-500">Tipo:</span>{' '}
            <span className="text-gray-900">{receita.tipo}</span>
          </div>
          {receita.cid_principal && (
            <div className="sm:col-span-2">
              <span className="text-gray-500">CID:</span>{' '}
              <span className="font-mono text-emerald-700">{receita.cid_principal.codigo}</span>{' '}
              <span className="text-gray-900">{receita.cid_principal.descricao}</span>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Medicamentos</h3>
          <ul className="space-y-2">
            {(receita.receita_itens || []).map((it: any, idx: number) => (
              <li key={it.id || idx} className="border border-gray-200 rounded-lg p-3">
                <div className="font-medium text-gray-900">
                  {idx + 1}. {it.medicamento_label || `Medicamento #${it.medicamento_id || '?'}`}
                </div>
                <div className="text-sm text-gray-600 mt-1">{it.posologia}</div>
                {(it.quantidade || it.duracao_dias || it.via_administracao) && (
                  <div className="text-xs text-gray-500 mt-1">
                    {it.quantidade ? `Qtd: ${it.quantidade}` : ''}
                    {it.duracao_dias ? ` • ${it.duracao_dias} dias` : ''}
                    {it.via_administracao ? ` • Via ${it.via_administracao}` : ''}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {receita.texto_cabecalho && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Obs. no topo</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{receita.texto_cabecalho}</p>
          </div>
        )}
        {receita.texto_rodape && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Obs. no rodapé</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{receita.texto_rodape}</p>
          </div>
        )}
      </div>
    </div>
  )
}
