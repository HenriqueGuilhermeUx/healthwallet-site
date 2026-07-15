import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function cents(value: any) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

function nextChargeDate(interval: string) {
  const now = new Date()
  const next = new Date(now)
  if (interval === 'weekly') next.setDate(next.getDate() + 7)
  else if (interval === 'quarterly') next.setMonth(next.getMonth() + 3)
  else if (interval === 'yearly') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

function getWooviConfig() {
  const apiKey = process.env.WOOVI_API_KEY || process.env.OPENPIX_APP_ID
  const baseUrl = (process.env.WOOVI_API_BASE_URL || 'https://api.woovi.com/api/v1').replace(/\/$/, '')
  return { apiKey, baseUrl }
}

function extractChargeFields(payload: any) {
  const charge = payload?.charge || payload?.data?.charge || payload?.data || payload || {}
  const paymentMethods = charge?.paymentMethods || charge?.payment_methods || {}
  const pix = paymentMethods?.pix || {}

  return {
    providerChargeId: charge.identifier || charge.id || charge.chargeId || charge.transactionID || charge.transactionId || payload?.id || null,
    pixCopyPaste: charge.brCode || charge.pixCopyPaste || charge.pix_copy_paste || pix.brCode || pix.copyPaste || null,
    pixQrCode: charge.qrCode || charge.qr_code || pix.qrCode || null,
    qrCodeImage: charge.qrCodeImage || charge.qrCodeImageURL || charge.qr_code_image || pix.qrCodeImage || null,
    paymentUrl: charge.paymentLinkUrl || charge.paymentUrl || charge.payment_url || charge.link || pix.paymentUrl || null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authData.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const user = authData.user
    const body = await req.json().catch(() => ({}))
    const amountCents = cents(body.amount)

    if (!amountCents || amountCents < 100) return NextResponse.json({ error: 'Informe valor válido para o plano' }, { status: 400 })

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const interval = body.interval || 'monthly'
    const planName = body.plan_name || 'Plano mensal de acompanhamento'
    const description = body.description || ''
    const patientName = body.patient_name || null
    const patientEmail = body.patient_email || null
    const correlationId = `nextgen-patient-plan-${professional.id}-${randomUUID()}`

    const { data: billingPlan, error: billingPlanError } = await supabase
      .from('professional_billing_plans')
      .insert({
        professional_user_id: user.id,
        professional_id: professional.id,
        name: planName,
        description,
        amount_cents: amountCents,
        currency: 'BRL',
        interval,
        status: 'active',
        product_key: 'mydatamed-patient-plan',
        features: {
          follow_up: true,
          smartbots_crm: true,
          teleorientation: true,
          documents: true,
        },
        metadata: {
          source: 'patient-plan-page',
          powered_by: 'NextGen',
          patient_id: body.patient_id || null,
          patient_name: patientName,
        },
      })
      .select('*')
      .single()

    if (billingPlanError || !billingPlan) {
      return NextResponse.json({ error: `${billingPlanError?.message || 'Erro ao criar plano'}. Rode SQL_NEXTGEN_FINANCEIRO_V1.sql.` }, { status: 500 })
    }

    const { data: patientPlan, error: patientPlanError } = await supabase
      .from('professional_patient_plans')
      .insert({
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: body.patient_id || null,
        patient_name: patientName,
        patient_email: patientEmail,
        plan_id: billingPlan.id,
        plan_name: planName,
        description,
        amount_cents: amountCents,
        currency: 'BRL',
        interval,
        status: 'active',
        next_charge_at: nextChargeDate(interval),
        metadata: {
          powered_by: 'NextGen',
          smartbots: 'follow-up, lembretes e relacionamento',
          staff: 'agenda e apoio administrativo',
          docwallet: 'documentos e arquivos',
          patient_cpf: onlyDigits(body.patient_cpf || ''),
        },
      })
      .select('*')
      .single()

    if (patientPlanError || !patientPlan) {
      return NextResponse.json({ error: `${patientPlanError?.message || 'Erro ao criar plano do paciente'}. Rode SQL_NEXTGEN_PLANOS_PACIENTE_V1.sql.` }, { status: 500 })
    }

    const { data: localCharge, error: chargeError } = await supabase
      .from('professional_payment_charges')
      .insert({
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: body.patient_id || null,
        patient_email: patientEmail,
        charge_type: 'monthly_plan',
        title: `${planName} - primeira cobrança`,
        description,
        plan_id: billingPlan.id,
        patient_plan_id: patientPlan.id,
        amount_cents: amountCents,
        platform_fee_cents: Math.round(amountCents * 0.1),
        professional_net_cents: Math.max(0, amountCents - Math.round(amountCents * 0.1)),
        currency: 'BRL',
        status: 'draft',
        provider: 'nextgen_woovi',
        correlation_id: correlationId,
        recurrence_interval: interval,
        product_key: 'mydatamed-patient-plan-initial-charge',
        billing_context: 'patient_plan',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          source: 'patient-plan-page',
          powered_by: 'NextGen',
          professional_name: professional.full_name,
          professional_email: user.email,
          patient_name: patientName,
          patient_plan_id: patientPlan.id,
        },
      })
      .select('*')
      .single()

    if (chargeError || !localCharge) {
      return NextResponse.json({ error: `${chargeError?.message || 'Erro ao criar cobrança inicial'}. Rode SQL_NEXTGEN_PLANOS_PACIENTE_V1.sql.` }, { status: 500 })
    }

    await supabase
      .from('professional_patient_plans')
      .update({ last_charge_id: localCharge.id, last_charge_status: 'draft', last_charged_at: new Date().toISOString() })
      .eq('id', patientPlan.id)

    const { apiKey, baseUrl } = getWooviConfig()

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        patient_plan: patientPlan,
        billing_plan: billingPlan,
        charge: localCharge,
        mode: 'draft_only',
        message: 'Plano criado e cobrança inicial em rascunho. Configure WOOVI_API_KEY para gerar Pix.',
      })
    }

    const wooviPayload = {
      correlationID: correlationId,
      value: amountCents,
      comment: `${planName} - MyDataMed`,
      expiresIn: 86400,
      customer: {
        name: patientName || professional.full_name,
        email: patientEmail || user.email,
        taxID: onlyDigits(body.patient_cpf || professional.cpf),
      },
      additionalInfo: [
        { key: 'Produto', value: 'MyDataMed / NextGen' },
        { key: 'Tipo', value: 'Plano de acompanhamento' },
        { key: 'Profissional', value: professional.full_name },
      ],
    }

    const response = await fetch(`${baseUrl}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify(wooviPayload),
    })

    const providerPayload = await response.json().catch(() => ({}))

    if (!response.ok) {
      await supabase.from('professional_payment_charges').update({ status: 'draft', provider_payload: providerPayload }).eq('id', localCharge.id)
      return NextResponse.json({ ok: true, patient_plan: patientPlan, billing_plan: billingPlan, charge: localCharge, mode: 'draft_only', warning: providerPayload?.message || providerPayload?.error || 'Plano criado, Pix não gerado.' })
    }

    const fields = extractChargeFields(providerPayload)
    const nextStatus = fields.pixCopyPaste || fields.paymentUrl ? 'pix_generated' : 'waiting_payment'

    const { data: updatedCharge } = await supabase
      .from('professional_payment_charges')
      .update({
        status: nextStatus,
        provider_charge_id: fields.providerChargeId,
        pix_qr_code: fields.pixQrCode,
        pix_copy_paste: fields.pixCopyPaste,
        qr_code_image: fields.qrCodeImage,
        payment_url: fields.paymentUrl,
        provider_payload: providerPayload,
      })
      .eq('id', localCharge.id)
      .select('*')
      .single()

    await supabase
      .from('professional_patient_plans')
      .update({ last_charge_id: localCharge.id, last_charge_status: nextStatus, last_charged_at: new Date().toISOString() })
      .eq('id', patientPlan.id)

    return NextResponse.json({
      ok: true,
      patient_plan: patientPlan,
      billing_plan: billingPlan,
      charge: updatedCharge || localCharge,
      payment_url: fields.paymentUrl,
      pix_copy_paste: fields.pixCopyPaste,
      qr_code_image: fields.qrCodeImage,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
