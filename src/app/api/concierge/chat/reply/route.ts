import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const allowedRoles = new Set(['master','admin','care_coordinator','concierge_agent','nurse','doctor'])

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) throw new Error('SUPABASE_ENV_INCOMPLETE')

  return {
    auth: createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }),
  }
}

async function requireStaff(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new Error('UNAUTHORIZED')

  const { auth, admin } = clients()
  const { data: userData, error } = await auth.auth.getUser(token)
  if (error || !userData.user) throw new Error('UNAUTHORIZED')

  const userId = userData.user.id
  const [{ data: team }, { data: concierge }] = await Promise.all([
    admin.from('mydatamed_team_members').select('role,active').eq('user_id', userId).maybeSingle(),
    admin.from('concierge_staff').select('role,active').eq('user_id', userId).maybeSingle(),
  ])

  const role = concierge?.active ? concierge.role : team?.active ? team.role : null
  if (!role || !allowedRoles.has(role)) throw new Error('FORBIDDEN')

  return { user: userData.user, role }
}

function actorRole(role: string) {
  if (role === 'care_coordinator') return 'care_coordinator'
  if (role === 'nurse') return 'nurse'
  if (role === 'doctor') return 'doctor'
  if (role === 'master' || role === 'admin') return 'admin'
  return 'concierge'
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await requireStaff(request)
    const body = await request.json()
    const sessionId = String(body.sessionId || '')
    const content = String(body.content || '').trim()

    if (!sessionId || !content) {
      return NextResponse.json({ error: 'Sessão e mensagem são obrigatórias.' }, { status: 400 })
    }

    const baseUrl = String(
      process.env.HEALTHWALLET_CONCIERGE_API_URL
      || process.env.NEXT_PUBLIC_HEALTHWALLET_URL
      || 'https://healthwallet1.netlify.app'
    ).replace(/\/$/, '')
    const internalKey = String(process.env.CONCIERGE_INTERNAL_SERVICE_KEY || '')

    if (!internalKey) {
      return NextResponse.json({ error: 'Canal Concierge server-side ainda não configurado.' }, { status: 503 })
    }

    const response = await fetch(`${baseUrl}/.netlify/functions/concierge-channel-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Concierge-Internal-Key': internalKey,
      },
      body: JSON.stringify({
        sessionId,
        actorUserId: user.id,
        actorRole: actorRole(role),
        content,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({
        error: result?.error === 'session_not_owned_by_actor'
          ? 'Assuma a conversa antes de responder.'
          : result?.error === 'whatsapp_identity_missing'
            ? 'O número de WhatsApp vinculado não foi encontrado.'
            : 'Não foi possível entregar a mensagem.',
      }, { status: response.status || 502 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    const message = String(error?.message || error || '')
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Acesso restrito à equipe Concierge.' }, { status: 403 })
    console.error('Concierge reply proxy error:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
