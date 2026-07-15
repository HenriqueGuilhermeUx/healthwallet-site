import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function getWooviConfig() {
  const apiKey = process.env.WOOVI_API_KEY || process.env.OPENPIX_APP_ID
  const baseUrl = (process.env.WOOVI_API_BASE_URL || 'https://api.woovi.com/api/v1').replace(/\/$/, '')
  return { apiKey, baseUrl }
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function nextChargeDate(interval: string) {
  const next = new Date()
  if (interval === 'weekly') next.setDate(next.getDate() + 7)
  else if (interval === 'quarterly') next.setMonth(next.getMonth() + 3)
  else if (interval === 'yearly') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next.toISOString()
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
    const patientPlanId = body.patient_plan_id
    if (!patientPlanId) return NextResponse.json({ error: 'Informe patient_plan_id' }, { status: 400 })

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const { data: plan, error: planError } = await supabase
      .from('professional_patient_plans')
      .select('*')
      .eq('id', patientPlanId)
      .eq('professional_user_id', user.id)
      .maybeSingle()

    if (planError || !plan) return NextResponse.json({ error: 'Plano do paciente não encontrado' }, { status: 404 })
    if (plan.status !== 'active') return NextResponse.json({ error: 'Plano não está ativo' }, { status: 400 })

    const correlationId = `nextgen-patient-plan-charge-${professional.id}-${randomUUID()}`

    const { data: localCharge, error: chargeError } = await supabase
      .from('professional_payment_charges')
      .insert({
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: plan.patient_id || null,
        patient_email: plan.patient_email || null,
        charge_type: 'monthly_plan',
        title: `${plan.plan_name} - cobrança ${new Date().toLocaleDateString('pt-BR')}`,
        description: plan.description || 'Cobrança recorrente de acompanhamento MyDataMed',
        plan_id: plan.plan_id || null,
        patient_plan_id: plan.id,
        amount_cents: plan.amount_cents,
        platform_fee_cents: Math.round(plan.amount_cents * 0.1),
        professional_net_cents: Math.max(0, plan.amount_cents - Math.round(plan.amount_cents * 0.1)),
        currency: plan.currency || 'BRL',
        status: 'draft',
        provider: 'nextgen_woovi',
        correlation_id: correlationId,
        recurrence_interval: plan.interval,
        product_key: 'mydatamed-patient-plan-recurring-charge',
        billing_context: 'patient_plan',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          source: 'patient-plan-recurring-charge',
          powered_by: 'NextGen',
          patient_plan_id: plan.id,
          patient_name: plan.patient_name,
          professional_name: professional.full_name,
        },
      })
      .select('*')
      .single()

    if (chargeError || !localCharge) {
      return NextResponse.json({ error: chargeError?.message || 'Erro ao criar cobrança do plano' }, { status: 500 })
    }

    const { apiKey, baseUrl } = getWooviConfig()

    if (!apiKey) {
      await supabase.from('professional_patient_plans').update({ last_charge_id: localCharge.id, last_charge_status: 'draft', last_charged_at: new Date().toISOString() }).eq('id', plan.id)
      return NextResponse.json({ ok: true, charge: localCharge, mode: 'draft_only', message: 'Cobrança criada como rascunho. Configure WOOVI_API_KEY para gerar Pix.' })
    }

    const wooviPayload = {
      correlationID: correlationId,
      value: plan.amount_cents,
      comment: `${plan.plan_name} - MyDataMed`,
      expiresIn: 86400,
      customer: {
        name: plan.patient_name || professional.full_name,
        email: plan.patient_email || user.email,
        taxID: onlyDigits(plan.metadata?.patient_cpf || professional.cpf),
      },
      additionalInfo: [
        { key: 'Produto', value: 'MyDataMed / NextGen' },
        { key: 'Tipo', value: 'Cobrança recorrente' },
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
      await supabase.from('professional_patient_plans').update({ last_charge_id: localCharge.id, last_charge_status: 'draft', last_charged_at: new Date().toISOString() }).eq('id', plan.id)
      return NextResponse.json({ ok: true, charge: localCharge, mode: 'draft_only', warning: providerPayload?.message || providerPayload?.error || 'Cobrança local criada, Pix não gerado.' })
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
      .update({
        last_charge_id: localCharge.id,
        last_charge_status: nextStatus,
        last_charged_at: new Date().toISOString(),
        next_charge_at: nextChargeDate(plan.interval),
      })
      .eq('id', plan.id)

    return NextResponse.json({
      ok: true,
      charge: updatedCharge || localCharge,
      payment_url: fields.paymentUrl,
      pix_copy_paste: fields.pixCopyPaste,
      qr_code_image: fields.qrCodeImage,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
