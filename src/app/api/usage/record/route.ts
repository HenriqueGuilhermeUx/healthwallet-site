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

const allowedTypes = new Set(['assisted_visit', 'modo_credit', 'ai_action', 'transcription_minute', 'crm_message', 'storage_upload', 'other'])

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: authUser, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser?.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json()
    const eventType = String(body.event_type || 'other')
    if (!allowedTypes.has(eventType)) return NextResponse.json({ error: 'Tipo de uso inválido.' }, { status: 400 })

    const quantity = Math.max(1, Number(body.quantity || 1))
    const referenceId = body.reference_id || null

    const { data, error } = await supabase.rpc('record_mydatamed_usage', {
      p_professional_user_id: authUser.user.id,
      p_event_type: eventType,
      p_quantity: quantity,
      p_source: body.source || null,
      p_reference_id: referenceId,
      p_description: body.description || null,
      p_metadata: body.metadata || {},
    })

    if (error) throw error

    const { data: subscription } = await supabase
      .from('professional_commercial_subscriptions')
      .select('*')
      .eq('professional_user_id', authUser.user.id)
      .maybeSingle()

    return NextResponse.json({ success: true, usageEventId: data, subscription })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao registrar uso.' }, { status: 500 })
  }
}
