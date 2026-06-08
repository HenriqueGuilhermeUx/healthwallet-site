'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { api, type ReceitaItem, type Medicamento, type Cid, type ClinicalAlert } from '@/lib/api'
import { MedicationAutocomplete } from '@/components/MedicationAutocomplete'
import { ArrowLeft, Plus, Trash2, Save, Send, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const TIPOS_RECEITA = [
  { value: 'simples',                  label: 'Receita Simples (1 via)' },
  { value: 'controle_especial_branca', label: 'Controle Especial (branca — 2 vias)' },
  { value: 'azul_b1b2',                label: 'Receita B — Psicotrópicos (azul — 2 vias)' },
  { value: 'amarela_a1a2',             label: 'Receita A — Entorpecentes (amarela — 2 vias)' },
]

function ClinicalAlertsBanner({ alerts, loading }: { alerts: ClinicalAlert[]; loading: boolean }) {
  if (loading && alerts.length === 0) {
    return (
      <div className="mb-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
        Verificando alergias e interações…
      </div>
    )
  }
  if (alerts.length === 0) {
    return null
  }

  const alergia    = alerts.filter((a) => a.tipo === 'alergia')
  const duplicado  = alerts.filter((a) => a.tipo === 'principio_ativo_duplicado')
  const emUso      = alerts.filter((a) => a.tipo === 'medicamento_ativo')

  return (
    <div className="mb-4 space-y-2">
      {alergia.length > 0 && (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-rose-700 text-lg">⚠️</span>
            <strong className="text-sm text-rose-900">
              Alergia identificada ({alergia.length})
            </strong>
          </div>
          <ul className="text-xs text-rose-800 space-y-1 ml-6 list-disc">
            {alergia.map((a, i) => (
              <li key={i}>{a.mensagem}</li>
            ))}
          </ul>
          <p className="text-[10px] text-rose-700 mt-2 ml-6 italic">
            Revise a prescrição — o princípio ativo coincide com alergia registrada.
          </p>
        </div>
      )}

      {duplicado.length > 0 && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-amber-700 text-lg">🔁</span>
            <strong className="text-sm text-amber-900">
              Princípio ativo duplicado ({duplicado.length})
            </strong>
          </div>
          <ul className="text-xs text-amber-800 space-y-1 ml-6 list-disc">
            {duplicado.map((a, i) => (
              <li key={i}>{a.mensagem}</li>
            ))}
          </ul>
        </div>
      )}

      {emUso.length > 0 && (
        <div className="rounded-lg border-2 border-sky-300 bg-sky-50 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sky-700 text-lg">ℹ️</span>
            <strong className="text-sm text-sky-900">
              Já em uso ({emUso.length})
            </strong>
          </div>
          <ul className="text-xs text-sky-800 space-y-1 ml-6 list-disc">
            {emUso.map((a, i) => (
              <li key={i}>{a.mensagem}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PrescNewInner() {
  const { professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const search = useSearchParams()
  const presetPatient = search?.get('patientId') || null

  // Pacientes vinculados via access_codes
  const [patients, setPatients] = useState<Array<{ id: string; full_name: string; cpf: string | null }>>([])
  const [pacienteId, setPacienteId] = useState<string>(presetPatient || '')
  const [tipo, setTipo] = useState('simples')

  // CID
  const [cidQuery, setCidQuery] = useState('')
  const [cidResults, setCidResults] = useState<Cid[]>([])
  const [cidPrincipal, setCidPrincipal] = useState<Cid | null>(null)
  const [cidOpen, setCidOpen] = useState(false)
  const [cidLoading, setCidLoading] = useState(false)

  // Texto livre
  const [cabecalho, setCabecalho] = useState('')
  const [rodape, setRodape] = useState('')

  // Itens
  const [itens, setItens] = useState<ReceitaItem[]>([{
    medicamento_id: null, medicamento_label: '', posologia: 'Tomar 1 comprimido de 8 em 8 horas por 7 dias',
    quantidade: 1, duracao_dias: 7, via_administracao: 'oral', observacoes: '', ordem: 0,
  }])

  // Submit
  const [submitting, setSubmitting] = useState(false)

  // Alertas clínicos em tempo real
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  useEffect(() => {
    if (!pacienteId) { setAlerts([]); return }
    const medIds = itens
      .map((it) => it.medicamento_id)
      .filter((x): x is number => typeof x === 'number' && x > 0)
    if (medIds.length === 0) { setAlerts([]); return }

    setAlertsLoading(true)
    const handle = setTimeout(() => {
      api.checkClinicalAlerts(pacienteId, medIds)
        .then((res) => setAlerts(res || []))
        .catch((err) => console.warn('alerts check falhou:', err))
        .finally(() => setAlertsLoading(false))
    }, 400) // debounce 400ms

    return () => clearTimeout(handle)
  }, [pacienteId, itens])

  useEffect(() => {
    if (!authLoading && !professional) router.push('/login')
  }, [professional, authLoading, router])

  // Carregar pacientes vinculados
  useEffect(() => {
    if (!professional) return
    async function load() {
      const { data } = await supabase
        .from('access_codes')
        .select('patient_id')
        .eq('professional_id', professional!.id)
        .not('used_at', 'is', null)
      if (!data) return

      // Buscar profiles
      const ids = Array.from(new Set(data.map((d: any) => d.patient_id)))
      if (ids.length === 0) return
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, cpf')
        .in('id', ids)
      setPatients((profiles || []) as any)
    }
    load()
  }, [professional])

  // CID search
  useEffect(() => {
    if (cidQuery.length < 2) { setCidResults([]); return }
    setCidLoading(true)
    const t = setTimeout(async () => {
      try {
        const list = await api.searchCids(cidQuery, 15)
        setCidResults(list)
        setCidOpen(true)
      } catch { setCidResults([]) }
      finally { setCidLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [cidQuery])

  function addItem() {
    setItens([...itens, {
      medicamento_id: null, medicamento_label: '', posologia: '',
      quantidade: 1, duracao_dias: null, via_administracao: 'oral', observacoes: '',
      ordem: itens.length,
    }])
  }
  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i })))
  }
  function updateItem(idx: number, patch: Partial<ReceitaItem>) {
    setItens(itens.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function save(sendAfter: boolean) {
    if (!pacienteId) { toast.error('Selecione um paciente'); return }
    if (itens.length === 0) { toast.error('Adicione ao menos um medicamento'); return }
    if (itens.some((it) => !it.posologia.trim())) {
      toast.error('Todos os itens precisam de posologia')
      return
    }
    setSubmitting(true)
    try {
      const created = await api.createPrescription({
        paciente_id: pacienteId,
        tipo,
        cid_principal_id: cidPrincipal?.id || null,
        texto_cabecalho: cabecalho || null,
        texto_rodape: rodape || null,
        itens: itens.map((it, i) => ({
          ...it,
          ordem: i,
          medicamento_label: it.medicamento_label, // não persistido mas ok enviar
        })),
      })
      if (sendAfter) {
        try {
          await api.sendPrescription((created as any).id)
          toast.success('Receita enviada para assinatura!')
        } catch (sendErr) {
          toast.warning('Receita salva, mas falhou ao enviar para assinatura. Você pode tentar novamente.')
          console.error(sendErr)
        }
      } else {
        toast.success('Rascunho salvo!')
      }
      router.push(`/prescriptions/${(created as any).id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !professional) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (professional.professional_type !== 'medico') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Apenas médicos podem emitir receitas digitais no momento.</p>
        <Link href="/dashboard" className="text-emerald-600 hover:underline mt-4 inline-block">Voltar</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/prescriptions" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova receita</h1>
          <p className="text-sm text-gray-500">Crie uma prescrição digital com assinatura ICP-Brasil</p>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-900 font-medium mb-2">Você ainda não tem pacientes vinculados</p>
          <p className="text-sm text-amber-800 mb-4">
            Peça ao paciente para gerar um código de acesso no app HealthWallet e digite o código no dashboard.
          </p>
          <Link href="/dashboard" className="inline-block px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold">
            Ir pro dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cabeçalho do formulário */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
              <select
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none"
              >
                <option value="">Selecione um paciente</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.cpf ? ` — CPF ${p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de receita</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none"
              >
                {TIPOS_RECEITA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {(tipo === 'azul_b1b2' || tipo === 'amarela_a1a2') && (
                <p className="text-xs text-amber-700 mt-1">
                  ⚠️ Receitas controladas (A/B) exigem numeração e selo da vigilância sanitária no carimbo de assinatura.
                </p>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Hipótese diagnóstica (CID)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={cidPrincipal ? `${cidPrincipal.codigo} — ${cidPrincipal.descricao}` : cidQuery}
                  onChange={(e) => { setCidPrincipal(null); setCidQuery(e.target.value) }}
                  onFocus={() => cidResults.length > 0 && setCidOpen(true)}
                  placeholder="Buscar por código (ex: J45) ou descrição (ex: diabetes)…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none"
                />
              </div>
              {cidOpen && cidResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {cidResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCidPrincipal(c); setCidOpen(false); setCidQuery('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-mono font-semibold text-emerald-700">{c.codigo}</span>{' '}
                      <span className="text-gray-700">{c.descricao}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Itens / medicamentos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <ClinicalAlertsBanner alerts={alerts} loading={alertsLoading} />

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Medicamentos</h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            <div className="space-y-4">
              {itens.map((it, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/30 relative">
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Medicamento</label>
                      <MedicationAutocomplete
                        value={null}
                        onChange={(med, label) => updateItem(idx, {
                          medicamento_id: med?.id || null,
                          medicamento_label: label,
                        })}
                        placeholder="Buscar por nome comercial ou princípio ativo…"
                      />
                      {it.medicamento_label && !it.medicamento_id && (
                        <p className="text-xs text-amber-700 mt-1">Texto livre — não consta do catálogo (será usado como está no PDF)</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Posologia</label>
                      <textarea
                        value={it.posologia}
                        onChange={(e) => updateItem(idx, { posologia: e.target.value })}
                        rows={2}
                        placeholder="Ex: Tomar 1 comprimido de 8 em 8 horas por 7 dias"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Qtd</label>
                        <input
                          type="number" min={1}
                          value={it.quantidade || ''}
                          onChange={(e) => updateItem(idx, { quantidade: e.target.value ? Number(e.target.value) : null })}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dias</label>
                        <input
                          type="number" min={1}
                          value={it.duracao_dias || ''}
                          onChange={(e) => updateItem(idx, { duracao_dias: e.target.value ? Number(e.target.value) : null })}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Via</label>
                        <select
                          value={it.via_administracao || 'oral'}
                          onChange={(e) => updateItem(idx, { via_administracao: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                        >
                          <option value="oral">Oral</option>
                          <option value="topica">Tópica</option>
                          <option value="intramuscular">IM</option>
                          <option value="intravenosa">IV</option>
                          <option value="subcutanea">SC</option>
                          <option value="inalatoria">Inalatória</option>
                          <option value="outra">Outra</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Observação</label>
                        <input
                          type="text"
                          value={it.observacoes || ''}
                          onChange={(e) => updateItem(idx, { observacoes: e.target.value })}
                          placeholder="opcional"
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Texto extra */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações no topo (opcional)</label>
              <textarea
                value={cabecalho}
                onChange={(e) => setCabecalho(e.target.value)}
                rows={2}
                placeholder="Ex: Manter uso contínuo. Retornar em 30 dias para reavaliação."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações no rodapé (opcional)</label>
              <textarea
                value={rodape}
                onChange={(e) => setRodape(e.target.value)}
                rows={2}
                placeholder="Ex: Em caso de reação adversa, suspender e entrar em contato."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none text-sm resize-none"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-white p-4 -mx-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-emerald-600 text-emerald-700 rounded-xl font-semibold hover:bg-emerald-50 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar rascunho
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Salvar e enviar para assinatura
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    }>
      <PrescNewInner />
    </Suspense>
  )
}
