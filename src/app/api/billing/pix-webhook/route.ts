import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function normalizeStatus(value: any) {
  const text = String(value || '').toLowerCase()
  if (text.includes('completed') || text.includes('paid') || text.includes('confirmed')) return 'paid'
  if (text.includes('expired')) return 'expired'
  if (text.includes('cancel')) return 'cancelled'
  if (text.includes('fail') || text.includes('error')) return 'failed'
  return 'pending'
}

function findCharge(body: any) {
  return body?.charge || body?.data?.charge || body?.data || body || {}
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MYDATAMED_PIX_WEBHOOK_SECRET
    if (secret) {
      const provided = req.headers.get('x-mydatamed-webhook-secret') || req.nextUrl.searchParams.get('secret') || ''
      if (provided !== secret) return NextResponse.json({ error: 'Webhook não autorizado.' }, { status: 401 })
    }

    const body = await req.json()
    const chargePayload = findCharge(body)
    const event = String(body?.event || body?.type || '')
    const correlationID = chargePayload?.correlationID || chargePayload?.correlationId || body?.correlationID || body?.correlationId
    const providerChargeId = chargePayload?.identifier || chargePayload?.id || chargePayload?.txid || null
    const status = normalizeStatus(chargePayload?.status || body?.status || event)

    if (!correlationID && !providerChargeId) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'missing_charge_identifier' })
    }

    const supabase = getSupabaseAdmin()
    let query = supabase.from('professional_payment_charges').select('*').limit(1)
    if (correlationID) query = query.eq('correlation_id', correlationID)
    else query = query.eq('provider_charge_id', providerChargeId)

    const { data: charges } = await query
    const charge = charges?.[0]
    if (!charge) return NextResponse.json({ ok: true, ignored: true, reason: 'charge_not_found' })

    await supabase
      .from('professional_payment_charges')
      .update({
        status,
        paid_at: status === 'paid' ? new Date().toISOString() : charge.paid_at,
        raw_response: { ...(charge.raw_response || {}), webhook: body },
        metadata: { ...(charge.metadata || {}), last_webhook_event: event || null, last_webhook_at: new Date().toISOString() },
      })
      .eq('id', charge.id)

    if (charge.financial_entry_id) {
      await supabase
        .from('professional_financial_entries')
        .update({
          status: status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : 'open',
          paid_at: status === 'paid' ? new Date().toISOString() : null,
          metadata: { charge_status: status, last_pix_webhook_at: new Date().toISOString(), charge_id: charge.id },
        })
        .eq('id', charge.financial_entry_id)
    }

    return NextResponse.json({ ok: true, status, chargeId: charge.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro no webhook Pix.' }, { status: 500 })
  }
}
