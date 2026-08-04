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

function normalizeText(value: any) {
  return String(value || '').trim().replace(/\s+/g, ' ')
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
    const visitId = body.visit_id
    const text = normalizeText(body.text)

    if (!visitId) return NextResponse.json({ error: 'visit_id obrigatório' }, { status: 400 })
    if (!text) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })

    const { data: visit, error: visitError } = await supabase
      .from('clinical_visits')
      .select('*')
      .eq('id', visitId)
      .eq('professional_user_id', user.id)
      .maybeSingle()

    if (visitError || !visit) return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })

    const { count } = await supabase
      .from('clinical_transcripts')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', visitId)
      .eq('professional_user_id', user.id)

    const segmentIndex = Number(count || 0) + 1
    const { data: segment, error: insertError } = await supabase
      .from('clinical_transcripts')
      .insert({
        visit_id: visitId,
        professional_user_id: user.id,
        speaker: body.speaker || 'unknown',
        text,
        segment_index: segmentIndex,
        confidence: typeof body.confidence === 'number' ? body.confidence : null,
        timestamp_start: typeof body.timestamp_start === 'number' ? body.timestamp_start : null,
        timestamp_end: typeof body.timestamp_end === 'number' ? body.timestamp_end : null,
        source: body.source || 'browser_speech_recognition',
        metadata: {
          browser: body.browser || null,
          language: body.language || 'pt-BR',
          audio_not_stored_in_mvp: true,
        },
      })
      .select('*')
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    const previous = normalizeText(visit.transcript_text || '')
    const nextTranscript = [previous, text].filter(Boolean).join('\n')

    await supabase
      .from('clinical_visits')
      .update({
        transcript_text: nextTranscript,
        status: visit.status === 'draft' ? 'in_progress' : visit.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visitId)

    return NextResponse.json({ ok: true, segment, transcript_text: nextTranscript })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
