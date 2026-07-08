import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const PRO_PRICE_CENTS = 7990

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role env vars missing')
  }

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

function getWooviConfig() {
  const apiKey = process.env.WOOVI_API_KEY || process.env.OPENPIX_APP_ID
  const baseUrl = (process.env.WOOVI_API_BASE_URL || 'https://api.woovi.com/api/v1').replace(/\/$/, '')

  if (!apiKey) {
    throw new Error('WOOVI_API_KEY não configurada no Netlify')
  }

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
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const user = authData.user

    const { data: professional, error: professionalError } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (professionalError || !professional) {
      return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })
    }

    const { apiKey, baseUrl } = getWooviConfig()
    const now = new Date()
    const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const correlationId = `mydatamed-pro-${professional.id}-${randomUUID()}`

    const { data: subscription } = await supabase
      .from('professional_subscriptions')
      .select('*')
      .eq('professional_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: localCharge, error: localChargeError } = await supabase
      .from('professional_payment_charges')
      .insert({
        subscription_id: subscription?.id || null,
        professional_user_id: user.id,
        professional_id: professional.id,
        patient_id: null,
        patient_email: user.email,
        charge_type: 'subscription',
        amount_cents: PRO_PRICE_CENTS,
        platform_fee_cents: PRO_PRICE_CENTS,
        professional_net_cents: 0,
        currency: 'BRL',
        status: 'draft',
        provider: 'woovi',
        correlation_id: correlationId,
        due_at: dueAt.toISOString(),
        metadata: {
          product: 'mydatamed-pro',
          plan: 'MyDataMed Pro',
          professional_id: professional.id,
          professional_name: professional.full_name,
          professional_email: user.email,
        },
      })
      .select('*')
      .single()

    if (localChargeError || !localCharge) {
      return NextResponse.json({ error: localChargeError?.message || 'Erro ao criar cobrança local' }, { status: 500 })
    }

    const wooviPayload = {
      correlationID: correlationId,
      value: PRO_PRICE_CENTS,
      comment: 'MyDataMed Pro - assinatura mensal',
      expiresIn: 86400,
      customer: {
        name: professional.full_name,
        email: user.email,
        taxID: onlyDigits(professional.cpf),
      },
      additionalInfo: [
        { key: 'Produto', value: 'MyDataMed Pro' },
        { key: 'Profissional', value: professional.full_name },
        { key: 'Plano', value: 'R$ 79,90/mês' },
      ],
    }

    const response = await fetch(`${baseUrl}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(wooviPayload),
    })

    const wooviResponse = await response.json().catch(() => ({}))

    if (!response.ok) {
      await supabase
        .from('professional_payment_charges')
        .update({
          status: 'cancelled',
          provider_payload: wooviResponse,
          metadata: {
            ...localCharge.metadata,
            woovi_error: wooviResponse,
          },
        })
        .eq('id', localCharge.id)

      return NextResponse.json({ error: wooviResponse?.error || wooviResponse?.message || 'Erro ao gerar Pix na Woovi', details: wooviResponse }, { status: 502 })
    }

    const fields = extractChargeFields(wooviResponse)

    const { data: updatedCharge } = await supabase
      .from('professional_payment_charges')
      .update({
        status: fields.pixCopyPaste || fields.paymentUrl ? 'pix_generated' : 'waiting_payment',
        provider_charge_id: fields.providerChargeId,
        pix_qr_code: fields.pixQrCode,
        pix_copy_paste: fields.pixCopyPaste,
        qr_code_image: fields.qrCodeImage,
        payment_url: fields.paymentUrl,
        provider_payload: wooviResponse,
      })
      .eq('id', localCharge.id)
      .select('*')
      .single()

    return NextResponse.json({
      ok: true,
      charge: updatedCharge,
      correlation_id: correlationId,
      provider_charge_id: fields.providerChargeId,
      pix_copy_paste: fields.pixCopyPaste,
      qr_code_image: fields.qrCodeImage,
      payment_url: fields.paymentUrl,
      raw: wooviResponse,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
