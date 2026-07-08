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

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Webhook não autorizado' }, { status: 401 })
    }

    const payload = await readJsonSafely(req)

    // Alguns provedores fazem validação do webhook com POST vazio.
    // Nesse caso, precisa responder 200 para permitir o cadastro do endpoint.
    if (!payload) {
      return okResponse({ validation: true, received: false })
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
      const query = supabase
        .from('professional_payment_charges')
        .select('*')
        .eq(fields.correlationId ? 'correlation_id' : 'provider_charge_id', fields.correlationId || fields.providerChargeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { data: charge } = await query

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

        await supabase.rpc('activate_mydatamed_pro_after_payment', {
          p_professional_user_id: charge.professional_user_id,
          p_professional_id: charge.professional_id || null,
          p_charge_id: charge.id,
        })

        processed = true
      } else if (charge) {
        await supabase
          .from('professional_payment_charges')
          .update({
            status: fields.status?.toLowerCase()?.includes('expired') ? 'expired' : charge.status,
            provider_payload: payload,
          })
          .eq('id', charge.id)

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

    // Mesmo quando não encontra cobrança local, respondemos 200 para a Woovi não desabilitar o webhook.
    return okResponse({ processed, error })
  } catch (error: any) {
    // Nunca derrubar cadastro/entrega do webhook por exceção interna.
    return okResponse({ processed: false, error: error?.message || 'Erro inesperado' })
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Webhook não autorizado' }, { status: 401 })
  }

  return okResponse({ validation: true })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

export async function OPTIONS() {
  return new Response(null, { status: 200 })
}
