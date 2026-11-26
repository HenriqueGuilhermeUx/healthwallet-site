import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

// Carrega um link público de pré-consulta pelo token exato.
// A tabela não tem policy para anon, então a página pública precisa desta rota:
// antes ela consultava o banco direto do navegador e sempre via "link não encontrado".
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body.token || '').trim()
    if (!/^[a-f0-9]{16,128}$/i.test(token)) {
      return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })
    }

    const supabase = getSupabaseAdmin()
    const { data: link, error } = await supabase
      .from('patient_precheck_links')
      .select('id, professional_user_id, public_token, title, clinic_name, specialty, default_reason, landing_message, status, expires_at, max_submissions, submission_count, require_cpf, require_health_plan, allow_plan_data, allow_companion_data')
      .eq('public_token', token)
      .maybeSingle()

    if (error || !link) {
      return NextResponse.json({ error: 'Link indisponível.' }, { status: 404 })
    }

    await supabase.from('patient_precheck_events').insert({
      link_id: link.id,
      professional_user_id: link.professional_user_id,
      event_type: 'public_form_opened',
      description: 'Formulário público de pré-consulta aberto.',
      metadata: { user_agent: req.headers.get('user-agent') || null },
    }).then(() => undefined, () => undefined)

    const { id, professional_user_id, ...publicLink } = link
    return NextResponse.json({ link: publicLink })
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar o link.' }, { status: 500 })
  }
}
