import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const allowedRoles = new Set([
  'master',
  'admin',
  'care_coordinator',
  'concierge_agent',
  'nurse',
  'doctor',
  'professional',
])

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anon || !service) {
    throw new Error('Supabase server environment is incomplete')
  }

  return {
    authClient: createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    adminClient: createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function requireMaster(request: NextRequest) {
  const token = bearerToken(request)
  if (!token) throw new Error('UNAUTHORIZED')

  const { authClient, adminClient } = getClients()
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) throw new Error('UNAUTHORIZED')

  const { data: member, error: memberError } = await adminClient
    .from('mydatamed_team_members')
    .select('user_id,role,active,email,display_name')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (memberError || !member || member.role !== 'master' || !member.active) {
    throw new Error('FORBIDDEN')
  }

  return { adminClient, caller: userData.user, member }
}

async function findAuthUserByEmail(adminClient: any, email: string) {
  const normalized = email.trim().toLowerCase()
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users || []
    const found = users.find((user: any) => String(user.email || '').toLowerCase() === normalized)
    if (found) return found
    if (users.length < 200) break
  }
  return null
}

function httpError(error: any) {
  const message = String(error?.message || error || '')
  if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Acesso restrito ao MASTER.' }, { status: 403 })
  console.error('Master team API error:', error)
  return NextResponse.json({ error: message || 'Erro interno.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const { adminClient } = await requireMaster(request)

    const { data: team, error } = await adminClient
      .from('mydatamed_team_members')
      .select('*')
      .order('role', { ascending: true })
      .order('display_name', { ascending: true })

    if (error) throw error

    const { data: concierge } = await adminClient
      .from('concierge_staff')
      .select('*')
      .order('display_name', { ascending: true })

    return NextResponse.json({ team: team || [], concierge: concierge || [] })
  } catch (error) {
    return httpError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminClient, caller } = await requireMaster(request)
    const body = await request.json()

    const email = String(body.email || '').trim().toLowerCase()
    const displayName = String(body.displayName || '').trim()
    const role = String(body.role || '').trim()
    const specialty = String(body.specialty || '').trim() || null

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }
    if (!displayName) {
      return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
    }
    if (!allowedRoles.has(role)) {
      return NextResponse.json({ error: 'Função inválida.' }, { status: 400 })
    }

    let authUser = await findAuthUserByEmail(adminClient, email)
    let invited = false

    if (!authUser) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: displayName,
          invited_by: 'mydatamed_master',
          intended_role: role,
        },
      })
      if (error) throw error
      authUser = data.user
      invited = true
    }

    if (!authUser?.id) throw new Error('Não foi possível localizar/criar o usuário.')

    const { error: teamError } = await adminClient
      .from('mydatamed_team_members')
      .upsert({
        user_id: authUser.id,
        email,
        display_name: displayName,
        role,
        active: true,
        created_by: caller.id,
        activated_at: new Date().toISOString(),
        deactivated_at: null,
        metadata: {
          source: 'master_console',
          specialty,
          professional_type: body.professionalType || null,
          invited: invited,
        },
      }, { onConflict: 'user_id' })

    if (teamError) throw teamError

    const clinicalRole = ['admin', 'care_coordinator', 'nurse', 'doctor'].includes(role)
    if (clinicalRole) {
      const { error: conciergeError } = await adminClient
        .from('concierge_staff')
        .upsert({
          user_id: authUser.id,
          role,
          display_name: displayName,
          professional_registration: body.professionalRegister || null,
          specialty,
          active: true,
          metadata: {
            source: 'master_console',
            managed_by: caller.id,
          },
        }, { onConflict: 'user_id' })

      if (conciergeError) throw conciergeError
    }

    let professionalProfileCreated = false
    const shouldCreateProfessional = ['doctor', 'nurse', 'professional'].includes(role)
      && body.cpf
      && body.professionalRegister
      && body.registerState

    if (shouldCreateProfessional) {
      const professionalType = role === 'doctor'
        ? 'medico'
        : role === 'nurse'
          ? 'enfermeiro'
          : String(body.professionalType || 'outro')

      const { data: existingProfessional } = await adminClient
        .from('professionals')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle()

      const professionalPayload = {
        user_id: authUser.id,
        full_name: displayName,
        cpf: String(body.cpf || '').replace(/\D/g, ''),
        professional_register: String(body.professionalRegister || '').trim(),
        register_state: String(body.registerState || '').trim().toUpperCase(),
        professional_type: professionalType,
        specialty,
        verification_status: body.verificationStatus || 'pending',
        onboarding_completed: true,
      }

      const profileResult = existingProfessional?.id
        ? await adminClient.from('professionals').update(professionalPayload).eq('id', existingProfessional.id)
        : await adminClient.from('professionals').insert(professionalPayload)

      if (profileResult.error) throw profileResult.error
      professionalProfileCreated = true
    }

    return NextResponse.json({
      ok: true,
      userId: authUser.id,
      invited,
      professionalProfileCreated,
    })
  } catch (error) {
    return httpError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { adminClient, caller } = await requireMaster(request)
    const body = await request.json()
    const userId = String(body.userId || '')
    const role = body.role ? String(body.role) : undefined

    if (!userId) return NextResponse.json({ error: 'Usuário não informado.' }, { status: 400 })
    if (role && !allowedRoles.has(role)) {
      return NextResponse.json({ error: 'Função inválida.' }, { status: 400 })
    }

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
      metadata: {
        source: 'master_console_update',
        managed_by: caller.id,
      },
    }
    if (role) patch.role = role
    if (typeof body.active === 'boolean') {
      patch.active = body.active
      patch.deactivated_at = body.active ? null : new Date().toISOString()
      if (body.active) patch.activated_at = new Date().toISOString()
    }
    if (body.displayName !== undefined) patch.display_name = String(body.displayName || '').trim()

    const { data, error } = await adminClient
      .from('mydatamed_team_members')
      .update(patch)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw error

    if (['admin', 'care_coordinator', 'nurse', 'doctor'].includes(data.role)) {
      await adminClient
        .from('concierge_staff')
        .upsert({
          user_id: userId,
          role: data.role,
          display_name: data.display_name,
          active: data.active,
          metadata: { source: 'master_console_update', managed_by: caller.id },
        }, { onConflict: 'user_id' })
    } else {
      await adminClient
        .from('concierge_staff')
        .update({ active: false })
        .eq('user_id', userId)
    }

    return NextResponse.json({ ok: true, member: data })
  } catch (error) {
    return httpError(error)
  }
}
