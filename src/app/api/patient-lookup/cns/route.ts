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

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function mask(value?: string | null, visible = 4) {
  const raw = String(value || '')
  if (!raw) return null
  if (raw.includes('@')) {
    const [name, domain] = raw.split('@')
    return `${name.slice(0, 2)}***@${domain || '***'}`
  }
  const digits = onlyDigits(raw)
  if (!digits) return raw.slice(0, 2) + '***'
  return `${'*'.repeat(Math.max(0, digits.length - visible))}${digits.slice(-visible)}`
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const rawQuery = String(body.query || '').trim()
    const digits = onlyDigits(rawQuery)

    if (!digits || digits.length < 6) {
      return NextResponse.json({ error: 'Informe CPF ou CNS/Cartão SUS válido.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const { data: professional } = await supabase
      .from('professionals')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!professional) return NextResponse.json({ error: 'Cadastro profissional não encontrado' }, { status: 404 })

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, cpf, cns_number, sus_card_number, sus_municipality, sus_ubs_reference')
      .or(`cpf.eq.${digits},cns_number.eq.${digits},sus_card_number.eq.${digits}`)
      .limit(5)

    if (profileError) {
      return NextResponse.json({ error: `${profileError.message}. Rode SQL_CNS_CARTAO_SUS_V1.sql.` }, { status: 500 })
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, found: false, message: 'Nenhum paciente encontrado por CPF/CNS nos dados cadastrados.' })
    }

    const results = []

    for (const profile of profiles) {
      const { data: access } = await supabase
        .from('access_codes')
        .select('*')
        .eq('patient_id', profile.id)
        .eq('professional_id', professional.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      results.push({
        patient_id: access ? profile.id : null,
        access_code_id: access?.id || null,
        authorized: Boolean(access),
        needs_authorization: !access,
        cpf_masked: mask(profile.cpf),
        cns_masked: mask(profile.cns_number || profile.sus_card_number),
        sus_municipality: profile.sus_municipality || null,
        sus_ubs_reference: profile.sus_ubs_reference || null,
        last_authorized_at: access?.used_at || access?.created_at || null,
        message: access
          ? 'Paciente encontrado em seus acessos autorizados.'
          : 'Paciente localizado, mas ainda sem autorização para este profissional. Solicite código ao paciente/cidadão.',
      })
    }

    return NextResponse.json({ ok: true, found: true, results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
