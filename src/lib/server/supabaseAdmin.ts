import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client. Requires the service role key: the public
// signing and validation flows no longer have anon RLS policies, so the anon
// key must never be used as a fallback here.
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function isValidSignToken(token: string) {
  return /^[A-Za-z0-9_-]{16,200}$/.test(token)
}

export function isValidHash(hash: string) {
  return /^[a-f0-9]{64}$/i.test(hash)
}
