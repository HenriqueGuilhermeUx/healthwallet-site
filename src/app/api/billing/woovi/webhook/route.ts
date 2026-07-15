import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

function extractWebhookFields(payload: any) {
  const charge = payload?.charge || payload?.data?.charge || payload?.data || payload || {}
  const eventType = payload?.event || payload?.eventType || payload?.type || payload?.name || null
  const status = charge?.status || payload?.status || eventType || null

  return {
    eventType,
    status,
    correlationId: charge?.correlationID || charge?.correlationId || payload?.correlationID || payload?.correlationId || null,
    providerChargeId: charge?.identifier || charge?.id || charge?.chargeId || charge?.transactionID || payload?.id || null,
  }
}

function isPaidEvent(status?: string | null, eventType?: string | null) {
  const value = `${status || ''} ${eventType || ''}`.toLowerCase()
  return value.includes('paid') || value.includes('completed') || value.includes('confirmed') || value.includes('pix-paid')
}

function isExpiredEvent(status?: string | null, eventType?: string | null) {
  const value = `${status || ''} ${eventType || ''}`.toLowerCase()
  return value.includes('expired') || value.includes('cancelled') || value.includes('canceled')
}

function isSubscriptionCharge(charge: any) {
  const type = String(charge?.charge_type || '').toLowerCase()
  const product = String(charge?.product_key || charge?.metadata?.product || '').toLowerCase()
  return type === 'subscription' || product.includes('mydatamed-pro')
}

function okResponse(extra: Record<string, any> = {}) {
  return NextResponse.json({ ok: true, service: 'woovi-webhook', ...extra }, { status: 200 })
}

async function readJsonSafely(req: NextRequest) {
  const text = await req.text()
  if (!text || !text.trim()) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isAuthorized(req: NextRequest) {
  const expectedSecret = process.env.WOOVI_WEBHOOK_SECRET
  if (!expectedSecret) return true

  const incomingSecret =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-woovi-secret') ||
    req.headers.get('x-openpix-secret') ||
    req.nextUrl.searchParams.get('secret')

  return incomingSecret === expectedSecret
}

async function updateAppointmentFromCharge(supabase: any, charge: any, status: string, payload: any) {
  if (!charge?.appointment_id) return

  await supabase
    .from('telemedicine_appointments')
    .update({
      payment_status: status,
      payment_paid_at: status === 'paid' ? new Date().toISOString() : null,
      billing_metadata: {
        ...(charge.billing_metadata || {}),
        webhook_confirmed: status === 'paid',
        provider_payload: payload,
        charge_id: charge.id,
        correlation_id: charge.correlation_id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', charge.appointment_id)
}

async function updatePatientPlanFromCharge(supabase: any, charge: any, status: string) {
  if (!charge?.patient_plan_id) return

  await supabase
    .from('professional_patient_plans')
    .update({
      last_charge_id: charge.id,
      last_charge_status: status,
      last_charged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', charge.patient_plan_id)
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readJsonSafely(req)

    if (!payload) {
      return okResponse({ validation: true, received: false })
    }

    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Webhook não autorizado' }, { status: 401 })
    }

    const fields = extractWebhookFields(payload)
    const supabase = getSupabaseAdmin()

    const { data: webhookEvent } = await supabase
      .from('woovi_webhook_events')
      .insert({
        event_type: fields.eventType,
        correlation_id: fields.correlationId,
        provider_charge_id: fields.providerChargeId,
        status: fields.status,
        payload,
        processed: false,
      })
      .select('*')
      .single()

    let processed = false
    let error: string | null = null

    if (fields.correlationId || fields.providerChargeId) {
      const { data: charge } = await supabase
        .from('professional_payment_charges')
        .select('*')
        .eq(fields.correlationId ? 'correlation_id' : 'provider_charge_id', fields.correlationId || fields.providerChargeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (charge && isPaidEvent(fields.status, fields.eventType)) {
        await supabase
          .from('professional_payment_charges')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            webhook_confirmed_at: new Date().toISOString(),
            provider_payload: payload,
          })
          .eq('id', charge.id)

        await updateAppointmentFromCharge(supabase, charge, 'paid', payload)
        await updatePatientPlanFromCharge(supabase, charge, 'paid')

        if (isSubscriptionCharge(charge)) {
          await supabase.rpc('activate_mydatamed_pro_after_payment', {
            p_professional_user_id: charge.professional_user_id,
            p_professional_id: charge.professional_id || null,
            p_charge_id: charge.id,
          })
        }

        processed = true
      } else if (charge) {
        const nextStatus = isExpiredEvent(fields.status, fields.eventType) ? 'expired' : charge.status

        await supabase
          .from('professional_payment_charges')
          .update({
            status: nextStatus,
            provider_payload: payload,
          })
          .eq('id', charge.id)

        if (nextStatus === 'expired') {
          await updateAppointmentFromCharge(supabase, charge, 'expired', payload)
          await updatePatientPlanFromCharge(supabase, charge, 'expired')
        }

        processed = true
      } else {
        error = 'Cobrança local não encontrada para correlation/provider id.'
      }
    } else {
      error = 'Webhook sem correlationID ou provider charge id.'
    }

    if (webhookEvent?.id) {
      await supabase
        .from('woovi_webhook_events')
        .update({
          processed,
          processed_at: processed ? new Date().toISOString() : null,
          error,
        })
        .eq('id', webhookEvent.id)
    }

    return okResponse({ processed, error })
  } catch (error: any) {
    return okResponse({ processed: false, error: error?.message || 'Erro inesperado' })
  }
}

export async function GET() {
  return okResponse({ validation: true })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

export async function OPTIONS() {
  return new Response(null, { status: 200 })
}
