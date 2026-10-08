import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedRoles = new Set(['master','admin','care_coordinator','concierge_agent','nurse','doctor'])

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) throw new Error('SUPABASE_ENV_INCOMPLETE')

  return {
    authClient: createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    adminClient: createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function bearer(request: NextRequest) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}

async function requireStaff(request: NextRequest) {
  const token = bearer(request)
  if (!token) throw new Error('UNAUTHORIZED')

  const { authClient, adminClient } = getClients()
  const { data: authData, error } = await authClient.auth.getUser(token)
  if (error || !authData.user) throw new Error('UNAUTHORIZED')

  const userId = authData.user.id
  const [{ data: team }, { data: concierge }] = await Promise.all([
    adminClient.from('mydatamed_team_members').select('role,active,display_name').eq('user_id', userId).maybeSingle(),
    adminClient.from('concierge_staff').select('role,active,display_name').eq('user_id', userId).maybeSingle(),
  ])

  const role = concierge?.active ? concierge.role : team?.active ? team.role : null
  if (!role || !allowedRoles.has(role)) throw new Error('FORBIDDEN')

  return { adminClient, user: authData.user, role }
}

function docwalletConfig() {
  const baseUrl = String(process.env.DOCWALLET_API_URL || '').replace(/\/$/, '')
  const key = String(process.env.DOCWALLET_MYDATAMED_SERVICE_KEY || '')
  if (!baseUrl || !key) throw new Error('DOCWALLET_NOT_CONFIGURED')
  return { baseUrl, key }
}

function templateFor(params: {
  type: string
  signerName: string
  signerEmail: string
  subjectName: string
  relationship: string | null
  insurerName: string | null
  caseTitle: string
}) {
  const today = new Intl.DateTimeFormat('pt-BR').format(new Date())
  const subjectLine = params.subjectName && params.subjectName !== params.signerName
    ? `A autorização também abrange a coordenação administrativa da saúde de ${params.subjectName}${params.relationship ? ` (${params.relationship})` : ''}, nos limites abaixo.`
    : 'A autorização refere-se à própria jornada de saúde do signatário.'

  if (params.type === 'privacy_consent') {
    return {
      title: 'Consentimento de Privacidade e Tratamento de Dados de Saúde — MyDataMed Concierge',
      content: `CONSENTIMENTO DE PRIVACIDADE E TRATAMENTO DE DADOS DE SAÚDE

Data: ${today}
Titular/signatário: ${params.signerName}
E-mail: ${params.signerEmail}

O titular autoriza a MyDataMed/HealthWallet a tratar dados pessoais e dados pessoais sensíveis de saúde estritamente para prestar o serviço Concierge, incluindo organização da jornada, coordenação administrativa de atendimentos, autorizações, reembolsos, protocolos, acompanhamento de resultados, comunicação com prestadores e operadoras, e manutenção do histórico necessário à continuidade do serviço.

${subjectLine}

O tratamento deve observar finalidade, necessidade, segurança, controle de acesso e registro de operações. O compartilhamento deve ocorrer apenas com pessoas e organizações necessárias à execução do serviço, inclusive profissionais assistenciais, prestadores, operadoras, autoridades regulatórias e fornecedores tecnológicos contratados, conforme aplicável.

Este consentimento não autoriza a MyDataMed a tomar decisões médicas em nome do titular, alterar condutas clínicas ou compartilhar dados além do necessário para a finalidade autorizada.

O titular pode solicitar informações sobre o tratamento e exercer seus direitos aplicáveis de proteção de dados. A revogação do consentimento produzirá efeitos prospectivos, observadas hipóteses legais de conservação.

Ao assinar eletronicamente, o titular declara que leu e compreendeu este documento e autoriza o tratamento descrito acima.`,
    }
  }

  if (params.type === 'representation_authorization') {
    return {
      title: 'Autorização Específica de Representação Administrativa — MyDataMed Concierge',
      content: `AUTORIZAÇÃO ESPECÍFICA DE REPRESENTAÇÃO ADMINISTRATIVA EM SAÚDE

Data: ${today}
Outorgante/signatário: ${params.signerName}
E-mail: ${params.signerEmail}
Caso Concierge: ${params.caseTitle}
Operadora/destinatário principal: ${params.insurerName || 'a informar'}

Esta autorização é EXCLUSIVA para o caso Concierge acima identificado. Ela não concede representação geral, permanente ou para outros casos.

O outorgante autoriza a MyDataMed e sua equipe Concierge, por representantes designados, somente na medida necessária para este caso, a:

1. solicitar informações, status, justificativas e números de protocolo;
2. protocolar e acompanhar pedido de autorização, reanálise ou recurso administrativo relacionado a este caso;
3. encaminhar documentos fornecidos pelo titular e receber respostas relacionadas a este caso;
4. contatar operadora, prestadores, central de atendimento e Ouvidoria;
5. registrar reclamação administrativa relacionada a este caso quando o canal admitir representação por terceiro;
6. acompanhar prazos e obter documentos de negativa e registros de atendimento vinculados a este caso.

${subjectLine}

LIMITES: esta autorização não permite movimentação financeira, contratação ou cancelamento de plano, alteração de beneficiários, aceite de acordo com renúncia de direitos, compartilhamento ou armazenamento de senha pessoal, decisão médica, prescrição, alteração de tratamento, representação judicial ou qualquer atuação fora deste caso.

A autorização termina com o encerramento deste caso, sua revogação pelo titular ou o término da finalidade específica, o que ocorrer primeiro.

Quando um canal exigir credencial pessoal do beneficiário ou instrumento com formalidade própria, a equipe solicitará ao titular a providência necessária.

Ao assinar eletronicamente, o titular declara que leu, compreendeu e autoriza apenas os atos descritos acima para este caso específico.`,
    }
  }

  return {
    title: 'Termo Integrado de Serviço, Privacidade e Representação — MyDataMed Concierge',
    content: `TERMO INTEGRADO MYDATAMED CONCIERGE

Data: ${today}
Titular/signatário: ${params.signerName}
E-mail: ${params.signerEmail}

1. OBJETO
O MyDataMed Concierge presta coordenação administrativa e operacional da jornada de saúde, incluindo organização de demandas, comunicação, acompanhamento de protocolos, busca e agendamento de prestadores, autorizações, reembolsos e acompanhamento de pendências.

2. LIMITES
O Concierge não substitui atendimento médico, não diagnostica, não prescreve e não altera tratamento. Informações regulatórias são educativas e operacionais e não constituem parecer jurídico individualizado. Ações judiciais e medidas que exijam representação profissional serão encaminhadas a advogado habilitado.

3. DADOS DE SAÚDE
O titular autoriza o tratamento de dados pessoais e sensíveis necessários à prestação do serviço, com acesso restrito, finalidade determinada e compartilhamento apenas quando necessário à execução da demanda.

4. REPRESENTAÇÃO ADMINISTRATIVA
O titular autoriza a equipe Concierge a contatar operadoras e prestadores, registrar e acompanhar protocolos, autorizações, reembolsos, reanálises e reclamações administrativas quando o canal admitir representação, sem compartilhamento de senha pessoal.

${subjectLine}

5. REVOGAÇÃO
O titular pode revogar a autorização para atos futuros, observada a conservação de registros necessária à comprovação de operações já realizadas.

Ao assinar eletronicamente, o titular declara ciência e concordância com os termos acima.`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminClient, user } = await requireStaff(request)
    const body = await request.json()
    const caseId = String(body.caseId || '')
    const documentType = String(body.documentType || 'representation_authorization')
    const action = String(body.action || 'create')

    if (!caseId) return NextResponse.json({ error: 'Caso não informado.' }, { status: 400 })
    if (documentType !== 'representation_authorization') {
      return NextResponse.json({ error: 'Este fluxo aceita somente autorização específica de representação do caso.' }, { status: 400 })
    }

    const { data: caseRow, error: caseError } = await adminClient
      .from('concierge_operational_cases')
      .select('*')
      .eq('id', caseId)
      .single()
    if (caseError || !caseRow) return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 })

    if (action === 'probe') {
      return NextResponse.json({
        ok: true,
        stage: 'case_ready',
        caseId: caseRow.id,
        patientId: caseRow.patient_id,
      })
    }

    const { data: membership } = await adminClient
      .from('concierge_memberships')
      .select('patient_id,metadata')
      .eq('patient_id', caseRow.patient_id)
      .maybeSingle()

    const { data: authUserData } = await adminClient.auth.admin.getUserById(caseRow.patient_id)
    const authUser = authUserData?.user
    const signerName = String(
      membership?.metadata?.patient_name
      || authUser?.user_metadata?.full_name
      || authUser?.user_metadata?.name
      || authUser?.email
      || 'Paciente'
    )
    const signerEmail = String(membership?.metadata?.patient_email || authUser?.email || '')

    if (!signerEmail) {
      return NextResponse.json({ error: 'O paciente precisa ter e-mail cadastrado para assinatura verificada por OTP.' }, { status: 400 })
    }

    if (action === 'sync') {
      const { data: authorization } = await adminClient
        .from('concierge_legal_authorizations')
        .select('*')
        .eq('patient_id', caseRow.patient_id)
        .eq('case_id', caseId)
        .eq('authorization_type', 'representation_authorization')
        .maybeSingle()

      if (!authorization?.docwallet_signature_request_id) {
        return NextResponse.json({ error: 'Ainda não há solicitação DocWallet para este caso.' }, { status: 404 })
      }

      const { baseUrl, key } = docwalletConfig()
      const syncController = new AbortController()
      const syncTimeout = setTimeout(() => syncController.abort(), 12000)

      let statusResponse: Response
      try {
        statusResponse = await fetch(
          `${baseUrl}/api/internal/mydatamed/concierge/signatures/${encodeURIComponent(authorization.docwallet_signature_request_id)}`,
          {
            signal: syncController.signal,
            headers: { 'X-MyDataMed-Key': key },
          },
        )
      } finally {
        clearTimeout(syncTimeout)
      }

      const statusResult = await statusResponse.json().catch(() => ({}))

      if (!statusResponse.ok || statusResult?.success === false) {
        return NextResponse.json(
          { error: statusResult?.error || 'Falha ao consultar assinatura no DocWallet.' },
          { status: statusResponse.status || 502 },
        )
      }

      const signatureRequest = statusResult.request || {}
      const signed = signatureRequest.status === 'completed'
      const legalStatus = signed ? 'signed' : 'signature_pending'

      const { error: authUpdateError } = await adminClient
        .from('concierge_legal_authorizations')
        .update({
          status: legalStatus,
          content_hash: signatureRequest.contentHash || authorization.content_hash || null,
          final_hash: signatureRequest.finalHash || authorization.final_hash || null,
          signed_at: signed ? (signatureRequest.completedAt || new Date().toISOString()) : null,
          metadata: {
            ...(authorization.metadata || {}),
            provider: 'docwallet',
            required_evidence: 'verified_evidence',
            case_scoped: true,
            last_synced_at: new Date().toISOString(),
          },
        })
        .eq('id', authorization.id)

      if (authUpdateError) throw authUpdateError

      await adminClient
        .from('concierge_case_documents')
        .update({
          status: legalStatus,
          content_hash: signatureRequest.contentHash || null,
          final_hash: signatureRequest.finalHash || null,
          signed_at: signed ? (signatureRequest.completedAt || new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('case_id', caseId)
        .eq('document_type', 'representation_authorization')

      return NextResponse.json({
        ok: true,
        signed,
        status: legalStatus,
        requestId: authorization.docwallet_signature_request_id,
      })
    }

    let subjectName = signerName
    let relationship: string | null = null
    if (caseRow.subject_family_member_id) {
      const { data: family } = await adminClient
        .from('family_members')
        .select('name,relationship')
        .eq('id', caseRow.subject_family_member_id)
        .maybeSingle()
      if (family?.name) subjectName = family.name
      relationship = family?.relationship || null
    }

    const template = templateFor({
      type: documentType,
      signerName,
      signerEmail,
      subjectName,
      relationship,
      insurerName: caseRow.insurer_name || null,
      caseTitle: caseRow.title,
    })

    const { baseUrl, key } = docwalletConfig()
    const idempotencyKey = `mydatamed:${caseId}:${documentType}:v1`

    const createController = new AbortController()
    const createTimeout = setTimeout(() => createController.abort(), 12000)

    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/internal/mydatamed/concierge/signatures`, {
        method: 'POST',
        signal: createController.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-MyDataMed-Key': key,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          documentType,
          externalReference: caseId,
          title: template.title,
          content: template.content,
          signer: {
            name: signerName,
            email: signerEmail,
          },
        }),
      })
    } finally {
      clearTimeout(createTimeout)
    }

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result?.success === false) {
      return NextResponse.json({ error: result?.error || 'Falha ao gerar documento no DocWallet.' }, { status: response.status || 502 })
    }

    const signatureRequest = result.request || {}
    const party = signatureRequest.parties?.[0] || {}

    const legalAuthorizationRow = {
      patient_id: caseRow.patient_id,
      case_id: caseId,
      authorization_type: 'representation_authorization',
      status: signatureRequest.status === 'completed' ? 'signed' : 'signature_pending',
      purpose: `Representação administrativa limitada ao caso: ${caseRow.title}`,
      recipient: caseRow.insurer_name || null,
      authorization_scope: {
        case_id: caseId,
        case_type: caseRow.case_type,
        insurer_name: caseRow.insurer_name || null,
        actions: [
          'request_information',
          'follow_protocol',
          'submit_case_documents',
          'request_reanalysis',
          'administrative_complaint_when_allowed',
        ],
        excludes: [
          'financial_transactions',
          'plan_changes',
          'rights_waiver',
          'password_sharing',
          'medical_decisions',
          'judicial_representation',
        ],
      },
      docwallet_signature_request_id: signatureRequest.id || null,
      content_hash: signatureRequest.contentHash || null,
      final_hash: signatureRequest.finalHash || null,
      signed_at: signatureRequest.completedAt || null,
      metadata: {
        provider: 'docwallet',
        required_evidence: 'verified_evidence',
        template_version: 'case_v1',
        case_scoped: true,
        source: 'mydatamed_navigation_cockpit',
        patient_sign_url: party.signUrl || null,
        patient_sign_url_created_at: party.signUrl ? new Date().toISOString() : null,
      },
    }

    const { data: existingAuthorization } = await adminClient
      .from('concierge_legal_authorizations')
      .select('id')
      .eq('patient_id', caseRow.patient_id)
      .eq('case_id', caseId)
      .eq('authorization_type', 'representation_authorization')
      .maybeSingle()

    const authorizationResult = existingAuthorization?.id
      ? await adminClient
          .from('concierge_legal_authorizations')
          .update(legalAuthorizationRow)
          .eq('id', existingAuthorization.id)
      : await adminClient
          .from('concierge_legal_authorizations')
          .insert(legalAuthorizationRow)

    if (authorizationResult.error) throw authorizationResult.error

    const legalDocumentRow = {
      case_id: caseId,
      patient_id: caseRow.patient_id,
      document_type: documentType,
      label: template.title,
      status: signatureRequest.status === 'completed' ? 'signed' : 'signature_pending',
      docwallet_signature_request_id: signatureRequest.id || null,
      content_hash: signatureRequest.contentHash || null,
      final_hash: signatureRequest.finalHash || null,
      uploaded_by: user.id,
      signed_at: signatureRequest.completedAt || null,
      metadata: {
        provider: 'docwallet',
        required_evidence: 'verified_evidence',
        template_version: 'case_v1',
        case_scoped: true,
        patient_sign_url: party.signUrl || null,
      },
    }

    const { data: existingLegalDoc } = await adminClient
      .from('concierge_case_documents')
      .select('id')
      .eq('case_id', caseId)
      .eq('document_type', documentType)
      .maybeSingle()

    const legalDocResult = existingLegalDoc?.id
      ? await adminClient.from('concierge_case_documents').update(legalDocumentRow).eq('id', existingLegalDoc.id)
      : await adminClient.from('concierge_case_documents').insert(legalDocumentRow)

    if (legalDocResult.error) throw legalDocResult.error

    await adminClient.from('concierge_case_events').insert({
      case_id: caseId,
      patient_id: caseRow.patient_id,
      actor_user_id: user.id,
      actor_role: 'concierge',
      event_type: 'legal_document_created',
      visibility: 'patient',
      message: 'Autorização específica deste caso enviada para assinatura.',
      payload: {
        document_type: documentType,
        signature_request_id: signatureRequest.id || null,
      },
    })

    return NextResponse.json({
      ok: true,
      requestId: signatureRequest.id || null,
      status: signatureRequest.status || 'pending',
      signUrl: party.signUrl || null,
      requiredEvidence: result.requiredEvidence || 'verified_evidence',
      title: template.title,
    })
  } catch (error: any) {
    const message = String(error?.message || error || '')
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Acesso restrito à equipe Concierge.' }, { status: 403 })
    if (message === 'DOCWALLET_NOT_CONFIGURED') return NextResponse.json({ error: 'Integração DocWallet ainda não configurada neste ambiente.' }, { status: 503 })
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'O DocWallet demorou para responder. O ambiente de homologação pode estar iniciando; tente novamente em alguns segundos.', stage: 'docwallet_timeout' },
        { status: 504 },
      )
    }
    console.error('Concierge legal document API error:', error)
    return NextResponse.json({ error: 'Não foi possível gerar o documento.' }, { status: 500 })
  }
}
