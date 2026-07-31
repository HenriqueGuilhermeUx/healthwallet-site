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

function sanitizeEan(value: any) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.length >= 8 && digits.length <= 14 ? digits : ''
}

function normalizeText(value: any) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function buildPharmacySearchKey(item: any) {
  return [
    item.active_ingredient || item.medication_name,
    item.standardized_dosage || item.dosage,
    item.pharmaceutical_form,
    item.manufacturer,
  ].map(normalizeText).filter(Boolean).join(' | ')
}

function normalizePrescriptionItem(item: any) {
  const eanCode = sanitizeEan(item.ean_code || item.ean || item.gtin || item.barcode)
  const normalized = {
    medication_name: normalizeText(item.medication_name || item.name || item.product_name),
    ean_code: eanCode || null,
    active_ingredient: normalizeText(item.active_ingredient || item.substance || item.principio_ativo) || null,
    standardized_dosage: normalizeText(item.standardized_dosage || item.dosage || item.dose || item.concentration) || null,
    pharmaceutical_form: normalizeText(item.pharmaceutical_form || item.form || item.forma_farmaceutica) || null,
    manufacturer: normalizeText(item.manufacturer || item.laboratory || item.fabricante) || null,
    quantity: normalizeText(item.quantity || item.quantidade) || null,
    instructions: normalizeText(item.instructions || item.posology || item.posologia || item.orientacoes) || null,
    duration: normalizeText(item.duration || item.duracao) || null,
    substitution_allowed: Boolean(item.substitution_allowed || false),
  }

  return {
    ...normalized,
    lookup_strategy: eanCode ? 'ean' : buildPharmacySearchKey(normalized) ? 'substance_dosage_form' : 'manual_review',
    pharmacy_search_key: buildPharmacySearchKey(normalized) || null,
  }
}

async function emitAutomationEvent(supabase: ReturnType<typeof getSupabaseAdmin>, payload: any) {
  try {
    await supabase.from('automation_events').insert({
      event_type: payload.event_type,
      source_app: 'mydatamed',
      source_table: payload.source_table || 'telemedicine_prescription_items',
      source_id: payload.source_id || null,
      actor_user_id: payload.actor_user_id || null,
      actor_role: 'professional',
      patient_id: payload.patient_id || null,
      professional_id: payload.professional_id || null,
      appointment_id: payload.appointment_id || null,
      payload: payload.payload || {},
      metadata: {
        powered_by: 'MyDataMed + HealthWallet + n8n',
        n8n_ready: true,
        ...(payload.metadata || {}),
      },
      priority: payload.priority || 4,
      status: 'pending',
    })
  } catch {
    // Não trava o salvamento se a fila ainda não existir.
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
    const appointmentId = body.appointment_id
    const items = Array.isArray(body.items) ? body.items.map(normalizePrescriptionItem) : []

    if (!appointmentId) return NextResponse.json({ error: 'appointment_id obrigatório' }, { status: 400 })
    if (!items.length) return NextResponse.json({ error: 'Inclua ao menos um item de receita' }, { status: 400 })

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const { data: appointment, error: appointmentError } = await supabase
      .from('telemedicine_appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle()

    if (appointmentError || !appointment) return NextResponse.json({ error: 'Teleconsulta não encontrada' }, { status: 404 })
    if (appointment.professional_id && appointment.professional_id !== professional.id) return NextResponse.json({ error: 'Sem permissão para esta teleconsulta' }, { status: 403 })

    const rows = items.map((item: any) => ({
      appointment_id: appointmentId,
      patient_id: appointment.patient_id || appointment.user_id || null,
      professional_id: professional.id,
      professional_user_id: user.id,
      ...item,
      metadata: {
        source: 'mydatamed_teleconsultation',
        quote_ready: true,
        ean_first: Boolean(item.ean_code),
      },
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('telemedicine_prescription_items')
      .insert(rows)
      .select('*')

    if (insertError) {
      return NextResponse.json({ error: `${insertError.message}. Rode SQL_TELECONSULTA_RECEITA_FARMACIA_V1.sql.` }, { status: 500 })
    }

    const prescriptionMetadata = {
      source: 'mydatamed_teleconsultation',
      ean_first: true,
      fallback_strategy: 'active_ingredient_standardized_dosage_pharmaceutical_form',
      item_count: items.length,
      updated_at: new Date().toISOString(),
      partner_quote_ready: true,
    }

    const { error: updateError } = await supabase
      .from('telemedicine_appointments')
      .update({
        prescription_items: items,
        prescription_metadata: prescriptionMetadata,
        pharmacy_quote_ready: true,
        prescription_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)

    if (updateError) {
      return NextResponse.json({ error: `${updateError.message}. Rode SQL_TELECONSULTA_RECEITA_FARMACIA_V1.sql.` }, { status: 500 })
    }

    await supabase.from('telemedicine_events').insert({
      appointment_id: appointmentId,
      actor_user_id: user.id,
      professional_id: professional.id,
      patient_id: appointment.patient_id || appointment.user_id || null,
      type: 'structured_prescription_saved',
      description: 'Profissional salvou receita estruturada preparada para cofre e cotação com farmácia parceira.',
      metadata: prescriptionMetadata,
    }).catch(() => null)

    await emitAutomationEvent(supabase, {
      event_type: 'telemedicine_prescription_created',
      source_id: appointmentId,
      actor_user_id: user.id,
      patient_id: appointment.patient_id || appointment.user_id || null,
      professional_id: professional.id,
      appointment_id: appointmentId,
      priority: 4,
      payload: {
        appointment_id: appointmentId,
        patient_id: appointment.patient_id || appointment.user_id || null,
        patient_name: appointment.patient_name || null,
        professional_name: professional.full_name || null,
        prescription_items: items,
        quote_ready: true,
      },
    })

    return NextResponse.json({ ok: true, items: inserted, prescription_metadata: prescriptionMetadata })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
