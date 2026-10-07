'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSignature,
  Headphones,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Siren,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const allowedRoles = new Set(['master','admin','care_coordinator','concierge_agent','nurse','doctor'])

const statusLabels: Record<string,string> = {
  new: 'Novo',
  collecting_docs: 'Coletando documentos',
  ready_to_contact: 'Pronto para contato',
  contacting_operator: 'Falando com operadora',
  waiting_operator: 'Aguardando operadora',
  action_required_patient: 'Aguardando paciente',
  escalated_ans: 'Escalado ANS/NIP',
  waiting_ans: 'Aguardando ANS',
  scheduled: 'Agendado',
  authorized: 'Autorizado',
  reimbursed: 'Reembolsado',
  resolved: 'Resolvido',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
}

const typeLabels: Record<string,string> = {
  provider_search: 'Busca de prestador',
  scheduling: 'Agendamento',
  insurance_authorization: 'Autorização',
  reimbursement: 'Reembolso',
  claim_denial: 'Negativa / glosa',
  hospitalization: 'Internação',
  surgery: 'Cirurgia',
  complex_case: 'Caso complexo',
  caregiver_coordination: 'Cuidado familiar',
  general_navigation: 'Navegação',
  other: 'Outro',
}

function fmt(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function dateInput(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0,16)
}

function guideForCase(item: any, guides: any[]) {
  const explicit = item?.metadata?.legal_guide_code
  if (explicit) {
    const found = guides.find((guide) => guide.guide_code === explicit)
    if (found) return found
  }
  const mapping: Record<string,string> = {
    provider_search: 'WAITING_TIME_RN566',
    scheduling: 'WAITING_TIME_RN566',
    insurance_authorization: 'AUTHORIZATION_RN623',
    reimbursement: 'REIMBURSEMENT_RULES',
    claim_denial: 'AUTHORIZATION_RN623',
    hospitalization: 'AUTHORIZATION_RN623',
    surgery: 'AUTHORIZATION_RN623',
    caregiver_coordination: 'CONCIERGE_BOUNDARIES',
  }
  return guides.find((guide) => guide.guide_code === mapping[item?.case_type]) || null
}

export default function ConciergeNavigationPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [guides, setGuides] = useState<any[]>([])
  const [playbooks, setPlaybooks] = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [checklist, setChecklist] = useState<any[]>([])
  const [escalations, setEscalations] = useState<any[]>([])
  const [intakes, setIntakes] = useState<any[]>([])
  const [draft, setDraft] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState<string | null>(null)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    void bootstrap()
  }, [user?.id])

  useEffect(() => {
    if (!staff?.active || !user) return
    const channel = supabase
      .channel(`concierge-ops-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concierge_operational_cases' }, () => void loadCases())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'concierge_case_events' }, (payload: any) => {
        if (selectedId && payload.new?.case_id === selectedId) void loadDetail(selectedId)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [staff?.active, selectedId, user?.id])

  async function bootstrap() {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: team }, { data: concierge }] = await Promise.all([
        supabase.from('mydatamed_team_members').select('user_id,role,display_name,active').eq('user_id', user.id).maybeSingle(),
        supabase.from('concierge_staff').select('user_id,role,display_name,active').eq('user_id', user.id).maybeSingle(),
      ])
      const self = concierge?.active
        ? concierge
        : team?.active && allowedRoles.has(team.role)
          ? { ...team, active: true }
          : null
      setStaff(self)
      if (!self) return

      const [guideRes, playbookRes, membershipRes] = await Promise.all([
        supabase.from('concierge_regulatory_guides').select('*').eq('active', true).order('topic'),
        supabase.from('concierge_regulatory_playbooks').select('*').eq('active', true).order('title'),
        supabase.from('concierge_memberships').select('patient_id,metadata,status,plan_code').limit(1000),
      ])
      setGuides(guideRes.data || [])
      setPlaybooks(playbookRes.data || [])
      setMemberships(membershipRes.data || [])
      await loadCases()
      await loadIntakes()
    } catch (error) {
      console.error('Navigation cockpit bootstrap failed:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadCases(showToast = false) {
    const { data, error } = await supabase
      .from('concierge_operational_cases')
      .select('*')
      .order('priority', { ascending: false })
      .order('regulatory_deadline_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(300)
    if (error) {
      console.error(error)
      return
    }
    setCases(data || [])
    if (showToast) toast.success('Fila atualizada')
  }

  async function selectCase(id: string) {
    const item = cases.find((row) => row.id === id)
    setSelectedId(id)
    setDraft(item ? {
      status: item.status,
      insurer_name: item.insurer_name || '',
      plan_name: item.plan_name || '',
      protocol_number: item.protocol_number || '',
      regulatory_rule_code: item.regulatory_rule_code || '',
      regulatory_deadline_at: dateInput(item.regulatory_deadline_at),
      deadline_confirmed: Boolean(item.deadline_confirmed),
      next_followup_at: dateInput(item.next_followup_at),
      amount_requested: item.amount_requested ?? '',
      amount_reimbursed: item.amount_reimbursed ?? '',
      outcome: item.outcome || '',
    } : {})
    const activeGuide = item ? guideForCase(item, guides) : null
    if (item && activeGuide) await ensureChecklist(item, activeGuide)
    await loadDetail(id)
  }

  async function ensureChecklist(item: any, guide: any) {
    const { data: existing } = await supabase
      .from('concierge_case_checklist_items')
      .select('item_key')
      .eq('case_id', item.id)

    const existingKeys = new Set((existing || []).map((row: any) => row.item_key))
    const rows: any[] = []

    ;(guide.staff_checklist || []).forEach((label: string, index: number) => {
      const itemKey = `action_${String(index + 1).padStart(2, '0')}`
      if (!existingKeys.has(itemKey)) rows.push({
        case_id: item.id,
        patient_id: item.patient_id,
        item_key: itemKey,
        category: 'action',
        label,
        required: true,
        metadata: { guide_code: guide.guide_code },
      })
    })

    ;(guide.required_documents || []).forEach((label: string, index: number) => {
      const itemKey = `document_${String(index + 1).padStart(2, '0')}`
      if (!existingKeys.has(itemKey)) rows.push({
        case_id: item.id,
        patient_id: item.patient_id,
        item_key: itemKey,
        category: 'document',
        label,
        required: true,
        metadata: { guide_code: guide.guide_code },
      })
    })

    if (guide.legal_boundary && !existingKeys.has('boundary_01')) {
      rows.push({
        case_id: item.id,
        patient_id: item.patient_id,
        item_key: 'boundary_01',
        category: 'boundary',
        label: guide.legal_boundary,
        required: true,
        metadata: { guide_code: guide.guide_code },
      })
    }

    if (rows.length) {
      await supabase.from('concierge_case_checklist_items').insert(rows)
    }
  }

  async function toggleChecklist(item: any) {
    if (!user) return
    const nextStatus = item.status === 'done' ? 'pending' : 'done'
    const { error } = await supabase
      .from('concierge_case_checklist_items')
      .update({
        status: nextStatus,
        completed_by: nextStatus === 'done' ? user.id : null,
        completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (error) return toast.error('Não foi possível atualizar o checklist.')
    if (selectedId) await loadDetail(selectedId)
  }

  async function loadIntakes() {
    const { data } = await supabase
      .from('concierge_document_intake')
      .select('*')
      .in('status', ['received','needs_review','classified'])
      .order('created_at', { ascending: false })
      .limit(100)
    setIntakes(data || [])
  }

  async function loadDetail(id: string) {
    const [docRes, eventRes, checklistRes, escalationRes] = await Promise.all([
      supabase.from('concierge_case_documents').select('*').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('concierge_case_events').select('*').eq('case_id', id).order('created_at', { ascending: true }),
      supabase.from('concierge_case_checklist_items').select('*').eq('case_id', id).order('created_at', { ascending: true }),
      supabase.from('concierge_case_escalations').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    ])
    setDocuments(docRes.data || [])
    setEvents(eventRes.data || [])
    setChecklist(checklistRes.data || [])
    setEscalations(escalationRes.data || [])
  }

  async function takeCase(item: any) {
    if (!user) return
    const { error } = await supabase
      .from('concierge_operational_cases')
      .update({ assigned_to: user.id })
      .eq('id', item.id)
    if (error) return toast.error('Não foi possível assumir o caso.')
    toast.success('Caso atribuído a você.')
    await loadCases()
  }

  async function saveCase() {
    if (!selectedId || !user) return
    setSaving(true)
    try {
      const patch = {
        status: draft.status,
        insurer_name: draft.insurer_name || null,
        plan_name: draft.plan_name || null,
        protocol_number: draft.protocol_number || null,
        protocol_opened_at: draft.protocol_number ? new Date().toISOString() : null,
        regulatory_rule_code: draft.regulatory_rule_code || null,
        regulatory_deadline_at: draft.regulatory_deadline_at ? new Date(draft.regulatory_deadline_at).toISOString() : null,
        deadline_confirmed: Boolean(draft.deadline_confirmed),
        next_followup_at: draft.next_followup_at ? new Date(draft.next_followup_at).toISOString() : null,
        amount_requested: draft.amount_requested === '' ? null : Number(draft.amount_requested),
        amount_reimbursed: draft.amount_reimbursed === '' ? null : Number(draft.amount_reimbursed),
        outcome: draft.outcome || null,
        resolved_at: ['resolved','reimbursed','authorized','scheduled'].includes(draft.status) ? new Date().toISOString() : null,
        closed_at: draft.status === 'closed' ? new Date().toISOString() : null,
      }
      const { error } = await supabase.from('concierge_operational_cases').update(patch).eq('id', selectedId)
      if (error) throw error

      await supabase.from('concierge_case_events').insert({
        case_id: selectedId,
        patient_id: selected?.patient_id,
        actor_user_id: user.id,
        actor_role: staff?.role === 'nurse' ? 'nurse' : staff?.role === 'doctor' ? 'doctor' : 'concierge',
        event_type: 'case_updated',
        visibility: 'staff_only',
        message: 'Caso operacional atualizado pela equipe Concierge.',
        payload: { status: draft.status, protocol_number: draft.protocol_number || null },
      })

      toast.success('Caso atualizado.')
      await loadCases()
      await loadDetail(selectedId)
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível salvar o caso.')
    } finally {
      setSaving(false)
    }
  }

  function estimateDeadline(ruleCode: string) {
    const rule = playbooks.find((item) => item.rule_code === ruleCode)
    const days = Number(rule?.max_business_days || 0)
    if (!days) return
    const date = new Date()
    let left = days
    while (left > 0) {
      date.setDate(date.getDate() + 1)
      const weekday = date.getDay()
      if (weekday !== 0 && weekday !== 6) left -= 1
    }
    const z = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    setDraft((current: any) => ({
      ...current,
      regulatory_rule_code: ruleCode,
      regulatory_deadline_at: z.toISOString().slice(0,16),
      deadline_confirmed: false,
    }))
    toast.message('Estimativa calculada sem feriados. Confirme o prazo antes de marcar como validado.')
  }

  async function generateLegalDocument(type: 'privacy_consent'|'representation_authorization'|'combined_onboarding') {
    if (!selectedId) return
    setCreatingDoc(type)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sessão expirada.')

      const response = await fetch('/api/concierge/legal-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caseId: selectedId, documentType: type }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Falha ao gerar documento.')

      if (result.signUrl) {
        await navigator.clipboard.writeText(result.signUrl).catch(() => undefined)
        toast.success('Documento criado. Link de assinatura copiado.')
        window.open(result.signUrl, '_blank', 'noopener,noreferrer')
      } else {
        toast.success('Documento criado no DocWallet.')
      }
      await loadDetail(selectedId)
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível gerar o documento.')
    } finally {
      setCreatingDoc(null)
    }
  }

  async function businessDeadline(startDate: Date, days: number) {
    try {
      const { data, error } = await supabase.rpc('concierge_compute_business_deadline', {
        p_start_date: startDate.toISOString().slice(0, 10),
        p_business_days: days,
        p_state_code: selected?.metadata?.state_code || null,
        p_city_name: selected?.metadata?.city_name || null,
      })
      if (!error && data) return new Date(String(data) + 'T18:00:00')
    } catch {
      // Fallback below keeps the workflow usable before local holiday setup.
    }

    const date = new Date(startDate)
    let left = days
    while (left > 0) {
      date.setDate(date.getDate() + 1)
      if (![0, 6].includes(date.getDay())) left -= 1
    }
    return date
  }

  function buildNipNarrative(item: any, activeGuide: any) {
    const protocol = draft.protocol_number || item.protocol_number || 'não informado'
    const insurer = draft.insurer_name || item.insurer_name || 'operadora não informada'
    const patient = patientName(item.patient_id)
    const outcome = draft.outcome || item.outcome || item.description || 'demanda ainda não solucionada'

    return [
      `Beneficiário: ${patient}.`,
      `Operadora: ${insurer}.`,
      `Protocolo prévio na operadora: ${protocol}.`,
      `Demanda: ${item.title}.`,
      `Situação atual: ${outcome}.`,
      activeGuide?.patient_answer ? `Referência operacional utilizada: ${activeGuide.topic}.` : '',
      'Solicitação: intermediação para que a operadora apresente solução clara e conclusiva à demanda, observados o contrato e a regulamentação aplicável.',
      'Esta narrativa registra fatos e pedido administrativo; não contém parecer jurídico individualizado.',
    ].filter(Boolean).join('\n')
  }

  async function prepareNip() {
    if (!selected || !user) return

    const protocol = String(draft.protocol_number || selected.protocol_number || '').trim()
    if (!protocol) {
      toast.error('Registre primeiro o protocolo prévio da operadora. Ele é essencial para o fluxo NIP.')
      return
    }

    const assistential = ['provider_search','scheduling','insurance_authorization','claim_denial','hospitalization','surgery','complex_case'].includes(selected.case_type)
    const narrative = buildNipNarrative(selected, guide)
    const requestedOutcome = 'Solicito solução administrativa objetiva para a demanda e resposta clara sobre cobertura, autorização, agendamento ou providência aplicável.'

    const signedRepresentation = documents.some((doc) =>
      ['representation_authorization','combined_onboarding'].includes(doc.document_type)
      && doc.status === 'signed'
    )

    const snapshot = {
      case_type: selected.case_type,
      insurer_name: draft.insurer_name || selected.insurer_name || null,
      operator_protocol: protocol,
      guide_code: guide?.guide_code || null,
      required_documents: guide?.required_documents || [],
      checklist_done: checklist.filter((item) => item.status === 'done').map((item) => item.item_key),
      representation_signed: signedRepresentation,
      nip_classification: assistential ? 'assistential' : 'non_assistential',
      response_business_days: assistential ? 5 : 10,
    }

    const { data: existing } = await supabase
      .from('concierge_case_escalations')
      .select('id')
      .eq('case_id', selected.id)
      .eq('escalation_type', 'ans_nip')
      .in('status', ['draft','ready'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const payload = {
      case_id: selected.id,
      patient_id: selected.patient_id,
      escalation_type: 'ans_nip',
      status: 'ready',
      narrative,
      requested_outcome: requestedOutcome,
      created_by: user.id,
      assigned_to: user.id,
      visibility: 'patient',
      snapshot,
      metadata: {
        representation_signed: signedRepresentation,
        prepared_from: 'mydatamed_navigation_cockpit',
      },
    }

    const result = existing?.id
      ? await supabase.from('concierge_case_escalations').update(payload).eq('id', existing.id).select('*').single()
      : await supabase.from('concierge_case_escalations').insert(payload).select('*').single()

    if (result.error) {
      console.error(result.error)
      return toast.error('Não foi possível preparar o pacote NIP.')
    }

    const packet = [
      'PACOTE NIP — MYDATAMED CONCIERGE',
      '',
      narrative,
      '',
      `Resultado solicitado: ${requestedOutcome}`,
      '',
      `Classificação: ${assistential ? 'assistencial (acompanhamento em 5 dias úteis)' : 'não assistencial (acompanhamento em 10 dias úteis)'}.`,
      `Representação administrativa assinada: ${signedRepresentation ? 'sim' : 'não — obter antes de atuar em nome do cliente, quando necessária'}.`,
    ].join('\n')

    await navigator.clipboard.writeText(packet).catch(() => undefined)

    await supabase.from('concierge_case_events').insert({
      case_id: selected.id,
      patient_id: selected.patient_id,
      actor_user_id: user.id,
      actor_role: 'concierge',
      event_type: 'nip_packet_ready',
      visibility: 'staff_only',
      message: 'Pacote NIP preparado para conferência e protocolo humano.',
      payload: snapshot,
    })

    toast.success('Pacote NIP pronto e copiado. Revise e protocole no canal oficial da ANS.')
    await loadDetail(selected.id)
  }

  async function markNipSubmitted(escalation: any) {
    if (!selected || !user) return
    const protocol = window.prompt('Informe o número da demanda/NIP registrado na ANS:')
    if (!protocol?.trim()) return

    const days = Number(escalation?.snapshot?.response_business_days || 5)
    const submittedAt = new Date()
    const responseDue = await businessDeadline(submittedAt, days)

    const { error } = await supabase
      .from('concierge_case_escalations')
      .update({
        status: 'waiting_response',
        protocol_number: protocol.trim(),
        submitted_at: submittedAt.toISOString(),
        response_due_at: responseDue.toISOString(),
      })
      .eq('id', escalation.id)

    if (error) return toast.error('Não foi possível registrar o protocolo da NIP.')

    await supabase.from('concierge_operational_cases').update({
      status: 'escalated_ans',
      next_followup_at: responseDue.toISOString(),
      metadata: {
        ...(selected.metadata || {}),
        nip_protocol: protocol.trim(),
        nip_submitted_at: submittedAt.toISOString(),
      },
    }).eq('id', selected.id)

    await supabase.from('concierge_case_events').insert({
      case_id: selected.id,
      patient_id: selected.patient_id,
      actor_user_id: user.id,
      actor_role: 'concierge',
      event_type: 'nip_submitted',
      visibility: 'patient',
      message: 'A reclamação administrativa na ANS foi registrada e está sendo acompanhada.',
      payload: {
        nip_protocol: protocol.trim(),
        response_due_at: responseDue.toISOString(),
        response_business_days: days,
      },
    })

    toast.success('NIP registrada. O follow-up foi programado automaticamente.')
    await loadCases()
    await loadDetail(selected.id)
  }

  async function createAdministrativeEscalation(type: 'operator_ombudsman'|'procon'|'legal_referral'|'clinical_referral') {
    if (!selected || !user) return

    const labels: Record<string, string> = {
      operator_ombudsman: 'Ouvidoria da operadora',
      procon: 'Procon / defesa do consumidor',
      legal_referral: 'Encaminhamento jurídico',
      clinical_referral: 'Encaminhamento clínico',
    }

    const protocol = String(draft.protocol_number || selected.protocol_number || '').trim()
    const administrative = ['operator_ombudsman','procon'].includes(type)

    if (administrative && !protocol) {
      toast.error('Registre o protocolo prévio da operadora antes de preparar este escalonamento.')
      return
    }

    const narrative = [
      `Paciente: ${patientName(selected.patient_id)}.`,
      `Caso: ${selected.title}.`,
      draft.insurer_name || selected.insurer_name ? `Operadora: ${draft.insurer_name || selected.insurer_name}.` : '',
      protocol ? `Protocolo anterior: ${protocol}.` : '',
      draft.outcome || selected.outcome || selected.description ? `Situação: ${draft.outcome || selected.outcome || selected.description}.` : '',
      `Próximo nível: ${labels[type]}.`,
    ].filter(Boolean).join('\n')

    const { data, error } = await supabase
      .from('concierge_case_escalations')
      .insert({
        case_id: selected.id,
        patient_id: selected.patient_id,
        escalation_type: type,
        status: 'ready',
        narrative,
        requested_outcome: type === 'legal_referral'
          ? 'Avaliar necessidade de orientação ou medida jurídica individualizada fora do escopo administrativo do Concierge.'
          : type === 'clinical_referral'
            ? 'Avaliar a questão clínica por profissional habilitado.'
            : 'Solicitar revisão e solução administrativa da demanda.',
        created_by: user.id,
        assigned_to: user.id,
        visibility: type === 'legal_referral' || type === 'clinical_referral' ? 'staff_only' : 'patient',
        snapshot: {
          guide_code: guide?.guide_code || null,
          protocol_number: protocol || null,
          checklist_done: checklist.filter((item) => item.status === 'done').map((item) => item.item_key),
        },
        metadata: { prepared_from: 'mydatamed_navigation_cockpit' },
      })
      .select('*')
      .single()

    if (error) return toast.error('Não foi possível preparar o escalonamento.')

    await supabase.from('concierge_case_events').insert({
      case_id: selected.id,
      patient_id: selected.patient_id,
      actor_user_id: user.id,
      actor_role: 'concierge',
      event_type: 'escalation_prepared',
      visibility: 'staff_only',
      message: `${labels[type]} preparado para revisão.`,
      payload: { escalation_id: data.id, escalation_type: type },
    })

    await navigator.clipboard.writeText(narrative).catch(() => undefined)
    toast.success(`${labels[type]} preparado e narrativa copiada.`)
    await loadDetail(selected.id)
  }

  async function linkIntakeToSelectedCase(intake: any) {
    if (!selected || !user) return

    const allowedDocs = new Set([
      'medical_order','medical_report','insurance_card','receipt_invoice',
      'proof_of_payment','authorization','denial','reimbursement_form','other',
    ])
    const documentType = allowedDocs.has(intake.document_type) ? intake.document_type : 'other'

    const { error } = await supabase
      .from('concierge_document_intake')
      .update({
        case_id: selected.id,
        status: 'linked',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', intake.id)

    if (error) return toast.error('Não foi possível vincular o documento.')

    await supabase.from('concierge_case_documents').insert({
      case_id: selected.id,
      patient_id: selected.patient_id,
      document_type: documentType,
      label: intake.original_filename || intake.document_type || 'Documento recebido',
      status: 'received',
      uploaded_by: user.id,
      metadata: {
        intake_id: intake.id,
        storage_bucket: intake.storage_bucket,
        storage_path: intake.storage_path,
        extracted_fields: intake.extracted_fields || {},
        extraction_confidence: intake.extraction_confidence,
      },
    })

    await supabase.from('concierge_case_events').insert({
      case_id: selected.id,
      patient_id: selected.patient_id,
      actor_user_id: user.id,
      actor_role: 'concierge',
      event_type: 'document_linked',
      visibility: 'staff_only',
      message: `Documento vinculado ao caso: ${intake.original_filename || documentType}.`,
      payload: { intake_id: intake.id, document_type: documentType },
    })

    toast.success('Documento revisado e vinculado ao caso.')
    await Promise.all([loadIntakes(), loadDetail(selected.id)])
  }

  const filtered = useMemo(() => {
    const terminal = new Set(['closed','cancelled'])
    if (filter === 'open') return cases.filter((item) => !terminal.has(item.status))
    if (filter === 'deadline') return cases.filter((item) => item.regulatory_deadline_at && !terminal.has(item.status))
    if (filter === 'unassigned') return cases.filter((item) => !item.assigned_to && !terminal.has(item.status))
    return cases
  }, [cases, filter])

  const selected = cases.find((item) => item.id === selectedId) || null
  const guide = selected ? guideForCase(selected, guides) : null

  const patientName = (patientId: string) => {
    const member = memberships.find((item) => item.patient_id === patientId)
    return member?.metadata?.patient_name || member?.metadata?.patient_email || `Paciente ${patientId.slice(0,8)}`
  }

  const stats = {
    open: cases.filter((item) => !['closed','cancelled'].includes(item.status)).length,
    high: cases.filter((item) => item.priority === 'high' && !['closed','cancelled'].includes(item.status)).length,
    due: cases.filter((item) => item.next_followup_at && new Date(item.next_followup_at).getTime() <= Date.now() && !['closed','cancelled'].includes(item.status)).length,
    unassigned: cases.filter((item) => !item.assigned_to && !['closed','cancelled'].includes(item.status)).length,
  }

  if (authLoading || loading) {
    return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }
  if (!user) return null
  if (!staff?.active) return <main className="max-w-4xl mx-auto px-4 py-10"><div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-500">Acesso restrito à equipe Concierge.</div></main>

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-cyan-950 to-emerald-900 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/concierge/profissional" className="inline-flex items-center gap-2 text-sm text-white/65"><ArrowLeft className="h-4 w-4" /> Concierge</Link>
            <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wider text-white/60"><ShieldCheck className="h-4 w-4" /> Navegação & Planos</div>
            <h1 className="mt-2 text-3xl font-bold">Resolver burocracia, fechar o loop.</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/75">Autorizações, reembolso, negativas, prazos ANS, NIP e documentação — com playbook, protocolo e próximo passo.</p>
          </div>
          <button onClick={() => void loadCases(true)} className="rounded-xl bg-white/10 p-3"><RefreshCw className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          <Stat label="Abertos" value={stats.open} />
          <Stat label="Alta prioridade" value={stats.high} />
          <Stat label="Follow-up vencido" value={stats.due} />
          <Stat label="Sem responsável" value={stats.unassigned} />
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilter('open')} className={pill(filter === 'open')}>Abertos</button>
          <button onClick={() => setFilter('deadline')} className={pill(filter === 'deadline')}>Com prazo</button>
          <button onClick={() => setFilter('unassigned')} className={pill(filter === 'unassigned')}>Sem responsável</button>
          <button onClick={() => setFilter('all')} className={pill(filter === 'all')}>Todos</button>
        </div>
      </section>

      <section className="grid min-h-[650px] gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="font-bold">Fila operacional</h2>
          <div className="mt-4 space-y-2">
            {filtered.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">Nenhum caso nesta fila.</div>}
            {filtered.map((item) => {
              const overdue = item.next_followup_at && new Date(item.next_followup_at).getTime() <= Date.now()
              return (
                <button key={item.id} onClick={() => void selectCase(item.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedId === item.id ? 'border-emerald-400 bg-emerald-50' : 'hover:border-emerald-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{patientName(item.patient_id)}</p>
                    </div>
                    {item.priority === 'high' && <Siren className="h-4 w-4 shrink-0 text-rose-600" />}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{typeLabels[item.case_type] || item.case_type}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{statusLabels[item.status] || item.status}</span>
                    {overdue && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">FOLLOW-UP</span>}
                  </div>
                  {item.insurer_name && <p className="mt-2 text-xs text-gray-600">{item.insurer_name}{item.protocol_number ? ` · protocolo ${item.protocol_number}` : ''}</p>}
                  {item.regulatory_deadline_at && <p className="mt-2 text-[11px] font-semibold text-amber-700">Prazo: {fmt(item.regulatory_deadline_at)} {item.deadline_confirmed ? '✓' : '(estimado)'}</p>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="flex min-h-[560px] items-center justify-center text-center">
              <div><ClipboardList className="mx-auto h-9 w-9 text-emerald-600" /><p className="mt-3 font-bold">Selecione um caso</p><p className="mt-1 text-sm text-gray-500">O playbook aplicável e os próximos passos aparecem aqui.</p></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{typeLabels[selected.case_type] || selected.case_type}</p>
                  <h2 className="mt-1 text-xl font-bold">{selected.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{patientName(selected.patient_id)} · aberto {fmt(selected.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  {!selected.assigned_to && <button onClick={() => void takeCase(selected)} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white"><UserRoundCheck className="mr-1 inline h-4 w-4" /> Assumir</button>}
                  <Link href={`/concierge/profissional/paciente/${selected.patient_id}`} className="rounded-xl border px-3 py-2 text-xs font-bold">Abrir paciente</Link>
                </div>
              </div>

              {guide && (
                <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-violet-700" /><h3 className="font-bold text-violet-950">{guide.topic}</h3></div>
                  <p className="mt-2 text-sm font-semibold text-violet-950">{guide.question}</p>
                  <p className="mt-2 text-sm leading-relaxed text-violet-900/80">{guide.patient_answer}</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Checklist da equipe</p>
                      <ol className="mt-2 space-y-1.5 text-xs text-violet-950">
                        {(guide.staff_checklist || []).map((step: string, i: number) => <li key={i}>{i + 1}. {step}</li>)}
                      </ol>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Documentos</p>
                      <ul className="mt-2 space-y-1.5 text-xs text-violet-950">
                        {(guide.required_documents || []).map((doc: string, i: number) => <li key={i}>• {doc}</li>)}
                      </ul>
                    </div>
                  </div>
                  {guide.legal_boundary && <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs text-violet-900"><strong>Limite:</strong> {guide.legal_boundary}</p>}
                </section>
              )}

              {checklist.length > 0 && (
                <section className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold">Checklist executável</h3>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      {checklist.filter((item) => item.status === 'done').length}/{checklist.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {checklist.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void toggleChecklist(item)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${item.status === 'done' ? 'border-emerald-200 bg-emerald-50' : item.category === 'boundary' ? 'border-amber-200 bg-amber-50' : 'bg-slate-50 hover:border-emerald-200'}`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${item.status === 'done' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                          {item.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className={`text-sm ${item.status === 'done' ? 'font-semibold text-emerald-950 line-through opacity-70' : 'font-medium text-gray-800'}`}>{item.label}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            {item.category === 'document' ? 'Documento' : item.category === 'boundary' ? 'Limite de atuação' : 'Ação'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid gap-4 md:grid-cols-2">
                <Field label="Operadora"><input value={draft.insurer_name || ''} onChange={(e) => setDraft({ ...draft, insurer_name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></Field>
                <Field label="Plano"><input value={draft.plan_name || ''} onChange={(e) => setDraft({ ...draft, plan_name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></Field>
                <Field label="Protocolo"><input value={draft.protocol_number || ''} onChange={(e) => setDraft({ ...draft, protocol_number: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></Field>
                <Field label="Status">
                  <select value={draft.status || 'new'} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                    {Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Regra / playbook de prazo">
                  <select value={draft.regulatory_rule_code || ''} onChange={(e) => { setDraft({ ...draft, regulatory_rule_code: e.target.value }); if (e.target.value) estimateDeadline(e.target.value) }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                    <option value="">Sem regra selecionada</option>
                    {playbooks.map((rule) => <option key={rule.rule_code} value={rule.rule_code}>{rule.title}{rule.max_business_days ? ` · ${rule.max_business_days} dias úteis` : ''}</option>)}
                  </select>
                </Field>
                <Field label="Prazo regulatório">
                  <input type="datetime-local" value={draft.regulatory_deadline_at || ''} onChange={(e) => setDraft({ ...draft, regulatory_deadline_at: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(draft.deadline_confirmed)} onChange={(e) => setDraft({ ...draft, deadline_confirmed: e.target.checked })} /> Prazo conferido pela equipe (inclusive feriados)</label>
                </Field>
                <Field label="Próximo follow-up"><input type="datetime-local" value={draft.next_followup_at || ''} onChange={(e) => setDraft({ ...draft, next_followup_at: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></Field>
                <Field label="Valor solicitado"><input type="number" step="0.01" value={draft.amount_requested ?? ''} onChange={(e) => setDraft({ ...draft, amount_requested: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></Field>
                <Field label="Valor reembolsado"><input type="number" step="0.01" value={draft.amount_reimbursed ?? ''} onChange={(e) => setDraft({ ...draft, amount_reimbursed: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></Field>
              </section>

              <Field label="Resultado / observação">
                <textarea rows={3} value={draft.outcome || ''} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 resize-none" />
              </Field>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => void saveCase()} disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />}Salvar caso</button>
                <button onClick={() => void prepareNip()} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900"><ShieldCheck className="mr-2 inline h-4 w-4" />Preparar NIP</button>
              </div>

              <section className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-indigo-700" /><h3 className="font-bold">Documentos e representação</h3></div>
                <p className="mt-1 text-xs text-gray-500">DocWallet gera assinatura eletrônica com OTP obrigatório para estes documentos.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DocButton label="Autorização / procuração" busy={creatingDoc === 'representation_authorization'} onClick={() => void generateLegalDocument('representation_authorization')} />
                  <DocButton label="Consentimento LGPD" busy={creatingDoc === 'privacy_consent'} onClick={() => void generateLegalDocument('privacy_consent')} />
                  <DocButton label="Termo integrado" busy={creatingDoc === 'combined_onboarding'} onClick={() => void generateLegalDocument('combined_onboarding')} />
                </div>
                <div className="mt-4 space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-xl border bg-white p-3 text-xs">
                      <div><p className="font-bold">{doc.label}</p><p className="mt-1 text-gray-500">{doc.status} · {fmt(doc.created_at)}</p></div>
                      {doc.status === 'signed' ? <BadgeCheck className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-amber-600" />}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-bold">Linha do caso</h3>
                <div className="mt-3 space-y-2">
                  {events.length === 0 && <p className="text-sm text-gray-500">Nenhum evento registrado ainda.</p>}
                  {events.map((event) => (
                    <div key={event.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">{event.event_type}</p><p className="text-[11px] text-gray-400">{fmt(event.created_at)}</p></div>
                      {event.message && <p className="mt-1 text-sm text-gray-700">{event.message}</p>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5">
        <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-violet-700" /><h2 className="font-bold">Respostas rápidas e playbooks</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {guides.map((item) => (
            <details key={item.guide_code} className="rounded-2xl border p-4">
              <summary className="cursor-pointer font-bold">{item.question}</summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">{item.patient_answer}</p>
              <p className="mt-3 text-xs text-violet-700"><strong>Escalonamento:</strong> {(item.escalation_path || []).join(' → ')}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}

function pill(active: boolean) {
  return `rounded-full border px-3 py-2 text-xs font-bold ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'bg-white text-gray-600'}`
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/10 p-3 text-center"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-white/65">{label}</p></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>{children}</label>
}

function DocButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={busy} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50">{busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <FileSignature className="mr-1 inline h-3.5 w-3.5" />}{label}</button>
}
