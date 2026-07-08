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

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
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

    const { error: rpcError } = await supabase.rpc('start_mydatamed_pro_trial', {
      p_professional_user_id: user.id,
      p_professional_id: professional.id,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message || 'Erro ao iniciar trial. Rode o SQL_MODELO_COMERCIAL_MYDATAMED_PRO_V1.sql.' }, { status: 500 })
    }

    const { data: subscription } = await supabase
      .from('professional_subscriptions')
      .select('*')
      .eq('professional_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      subscription,
      message: 'Trial Pro de 15 dias ativado.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 })
  }
}
