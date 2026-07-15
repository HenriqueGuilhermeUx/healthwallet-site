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
    rawCharge: charge,
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

    if (!amountCents || amountCents < 100) {
      return NextResponse.json({ error: 'Informe valor válido para cobrança' }, { status: 400 })
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const chargeType = body.charge_type || 'custom'
    const recurrenceInterval = body.recurrence_interval || null
    const title = body.title || defaultTitle(chargeType)
    const description = body.description || ''
    const patientEmail = body.patient_email || null
    const dueAt = body.due_at ? new Date(body.due_at) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    const correlationId = `nextgen-${chargeType}-${professional.id}-${randomUUID()}`
    let planId = body.plan_id || null

    if (['recurring_plan', 'monthly_plan', 'subscription'].includes(chargeType) && !planId) {
      const { data: plan } = await supabase
        .from('professional_billing_plans')
        .insert({
          professional_user_id: user.id,
          professional_id: professional.id,
          name: title,
          description,
          amount_cents: amountCents,
          currency: 'BRL',
          interval: recurrenceInterval || 'monthly',
          status: 'active',
          product_key: 'mydatamed-nextgen-plan',
          metadata: {
            source: 'financeiro-page',
            created_by: 'nextgen',
            charge_type: chargeType,
          },
        })
        .select('*')
        .single()
      planId = plan?.id || null
    }

    const { data: localCharge, error: localError } = await supabase
      .from('professional_payment_charges')
      .insert({
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: body.patient_id || null,
        patient_email: patientEmail,
        charge_type: chargeType,
        title,
        description,
        plan_id: planId,
        appointment_id: body.appointment_id || null,
        amount_cents: amountCents,
        platform_fee_cents: Math.round(amountCents * 0.1),
        professional_net_cents: Math.max(0, amountCents - Math.round(amountCents * 0.1)),
        currency: 'BRL',
        status: 'draft',
        provider: 'nextgen_woovi',
        correlation_id: correlationId,
        recurrence_interval: recurrenceInterval,
        product_key: body.product_key || 'mydatamed-nextgen-charge',
        billing_context: body.billing_context || 'professional',
        due_at: dueAt.toISOString(),
        metadata: {
          source: 'mydatamed-financeiro',
          powered_by: 'NextGen',
          professional_name: professional.full_name,
          professional_email: user.email,
          patient_name: body.patient_name || null,
          ...body.metadata,
        },
      })
      .select('*')
      .single()

    if (localError || !localCharge) {
      return NextResponse.json({ error: `${localError?.message || 'Erro ao criar cobrança local'}. Rode SQL_NEXTGEN_FINANCEIRO_V1.sql.` }, { status: 500 })
    }

    const { apiKey, baseUrl } = getWooviConfig()

    if (!apiKey) {
      return NextResponse.json({ ok: true, charge: localCharge, mode: 'draft_only', message: 'Cobrança criada como rascunho. Configure WOOVI_API_KEY para gerar Pix.' })
    }

    const wooviPayload = {
      correlationID: correlationId,
      value: amountCents,
      comment: title,
      expiresIn: 86400,
      customer: {
        name: body.patient_name || professional.full_name,
        email: patientEmail || user.email,
        taxID: onlyDigits(body.patient_cpf || professional.cpf),
      },
      additionalInfo: [
        { key: 'Produto', value: 'MyDataMed / NextGen' },
        { key: 'Tipo', value: chargeType },
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
      return NextResponse.json({ ok: true, charge: localCharge, mode: 'draft_only', warning: providerPayload?.message || providerPayload?.error || 'Cobrança local criada, Pix não gerado.' })
    }

    const fields = extractChargeFields(providerPayload)

    const { data: updatedCharge } = await supabase
      .from('professional_payment_charges')
      .update({
        status: fields.pixCopyPaste || fields.paymentUrl ? 'pix_generated' : 'waiting_payment',
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

    return NextResponse.json({
      ok: true,
      charge: updatedCharge || localCharge,
      correlation_id: correlationId,
      provider_charge_id: fields.providerChargeId,
      pix_copy_paste: fields.pixCopyPaste,
      qr_code_image: fields.qrCodeImage,
      payment_url: fields.paymentUrl,
      plan_id: planId,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}

function defaultTitle(type: string) {
  const map: Record<string, string> = {
    teleconsultation: 'Teleconsulta MyDataMed',
    consultation: 'Consulta profissional',
    subscription: 'Assinatura mensal',
    recurring_plan: 'Plano recorrente',
    monthly_plan: 'Plano mensal de acompanhamento',
    custom: 'Cobrança profissional',
  }
  return map[type] || 'Cobrança profissional'
}
