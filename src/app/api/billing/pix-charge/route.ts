import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

function onlyDigits(value: any) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeText(value: any) {
  return String(value || '').trim()
}

function extractChargePayload(data: any) {
  const charge = data?.charge || data?.data?.charge || data?.data || data || {}
  return {
    providerChargeId: charge?.identifier || charge?.id || charge?.txid || charge?.correlationID || null,
    status: String(charge?.status || data?.status || 'created').toLowerCase(),
    pixCopyPaste: charge?.brCode || charge?.pixCopyPaste || charge?.payload || charge?.qrCode || data?.brCode || data?.pixCopyPaste || null,
    pixQrCodeUrl: charge?.qrCodeImage || charge?.qrCodeImageUrl || charge?.pixQrCodeUrl || data?.qrCodeImage || null,
    paymentUrl: charge?.paymentLinkUrl || charge?.paymentLinkID || charge?.checkoutUrl || charge?.url || data?.paymentLinkUrl || null,
  }
}

function mapStatus(status: string) {
  const lower = String(status || '').toLowerCase()
  if (lower.includes('completed') || lower.includes('paid')) return 'paid'
  if (lower.includes('expired')) return 'expired'
  if (lower.includes('cancel')) return 'cancelled'
  if (lower.includes('fail') || lower.includes('error')) return 'failed'
  return 'pending'
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authUser, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser?.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json()
    const financialEntryId = normalizeText(body.financial_entry_id || body.entry_id)
    if (!financialEntryId) return NextResponse.json({ error: 'Lançamento financeiro ausente.' }, { status: 400 })

    const { data: entry, error: entryError } = await supabase
      .from('professional_financial_entries')
      .select('*')
      .eq('id', financialEntryId)
      .eq('professional_user_id', authUser.user.id)
      .maybeSingle()

    if (entryError || !entry) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 })
    if (entry.entry_type !== 'receivable') return NextResponse.json({ error: 'Só é possível cobrar contas a receber.' }, { status: 400 })
    if (Number(entry.amount_cents || 0) <= 0) return NextResponse.json({ error: 'Valor inválido para cobrança.' }, { status: 400 })

    const appId = process.env.MYDATAMED_PIX_APP_ID || process.env.WOOVI_APP_ID || process.env.OPENPIX_APP_ID
    const endpoint = process.env.MYDATAMED_PIX_CHARGE_URL || process.env.WOOVI_CHARGE_URL || 'https://api.woovi.com/api/openpix/v1/charge'
    if (!appId) return NextResponse.json({ error: 'Configure MYDATAMED_PIX_APP_ID no ambiente do servidor.' }, { status: 500 })

    const correlationID = `mydatamed-${financialEntryId}-${Date.now()}`
    const customer = {
      name: normalizeText(entry.patient_name) || 'Paciente MyDataMed',
      email: normalizeText(entry.patient_email) || undefined,
      phone: onlyDigits(entry.patient_phone) || undefined,
      taxID: normalizeText(body.customer_tax_id || entry.customer_tax_id) || undefined,
    }

    const payload = {
      correlationID,
      value: Number(entry.amount_cents || 0),
      comment: normalizeText(entry.description) || 'Cobrança MyDataMed',
      customer,
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: appId,
      },
      body: JSON.stringify(payload),
    })

    const raw = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ error: raw?.error || raw?.message || 'Erro ao criar cobrança Pix.', details: raw }, { status: response.status })
    }

    const parsed = extractChargePayload(raw)
    const mappedStatus = mapStatus(parsed.status)

    const { data: charge, error: chargeError } = await supabase
      .from('professional_payment_charges')
      .insert({
        professional_id: entry.professional_id || null,
        professional_user_id: authUser.user.id,
        financial_entry_id: entry.id,
        provider: 'pix_provider',
        provider_charge_id: parsed.providerChargeId,
        correlation_id: correlationID,
        status: mappedStatus,
        amount_cents: Number(entry.amount_cents || 0),
        description: entry.description,
        customer_name: customer.name,
        customer_email: customer.email || null,
        customer_phone: customer.phone || null,
        customer_tax_id: customer.taxID || null,
        pix_copy_paste: parsed.pixCopyPaste,
        pix_qr_code_url: parsed.pixQrCodeUrl,
        payment_url: parsed.paymentUrl,
        raw_response: raw,
        metadata: { source: 'backoffice_pix_charge', endpoint: endpoint.replace(/https?:\/\//, '').split('/')[0] },
      })
      .select('*')
      .single()

    if (chargeError) throw chargeError

    await supabase
      .from('professional_financial_entries')
      .update({
        charge_id: charge.id,
        external_reference: correlationID,
        payment_method: 'platform_pix',
        payment_url: parsed.paymentUrl,
        pix_copy_paste: parsed.pixCopyPaste,
        pix_qr_code_url: parsed.pixQrCodeUrl,
        customer_tax_id: customer.taxID || null,
        metadata: {
          ...(entry.metadata || {}),
          charge_status: mappedStatus,
          charge_id: charge.id,
          pix_charge_created_at: new Date().toISOString(),
        },
      })
      .eq('id', entry.id)
      .eq('professional_user_id', authUser.user.id)

    return NextResponse.json({ success: true, charge })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar cobrança Pix.' }, { status: 500 })
  }
}
