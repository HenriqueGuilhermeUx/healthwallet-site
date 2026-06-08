/**
 * Cliente Supabase SERVER-SIDE com service role.
 *
 * Use SOMENTE em Route Handlers (route.ts) — NUNCA em componentes client.
 * O service role bypassa RLS, então a rota é responsável por checar a auth
 * do usuário via session cookie.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL não definido');
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não definido — sem isso, webhook e operações admin falham');
  }
  _admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

/**
 * Recupera o usuário logado a partir do cookie de sessão do Supabase.
 * Retorna null se não houver sessão válida.
 */
export async function getUserFromSession(): Promise<{ id: string; email: string | null } | null> {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const sessionName = `sb-${projectRef}-auth-token`;

    const chunks: Array<{ name: string; value: string }> = [];
    for (const c of cookieStore.getAll()) {
      if (c.name === sessionName || c.name.startsWith(sessionName + '.')) {
        chunks.push({ name: c.name, value: c.value });
      }
    }
    if (chunks.length === 0) return null;

    const numbered = chunks
      .filter((c) => /-\d+$/.test(c.name))
      .sort((a, b) => {
        const ai = Number(a.name.split('.').pop() ?? '0');
        const bi = Number(b.name.split('.').pop() ?? '0');
        return ai - bi;
      });
    const main = chunks.find((c) => !/-\d+$/.test(c.name));
    const ordered: Array<{ name: string; value: string }> = [...numbered, ...(main ? [main] : [])];
    const joined = ordered.map((c) => c.value).join('');

    const parsed = JSON.parse(joined) as { access_token?: string };
    if (!parsed.access_token) return null;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(parsed.access_token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * Busca o registro de professional (tabela public.professionals) do user logado.
 */
export async function getProfessionalFromSession() {
  const user = await getUserFromSession();
  if (!user) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('professionals')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (error) return null;
  return data as {
    id: string;
    user_id: string;
    full_name: string;
    cpf: string;
    professional_register: string;
    register_state: string;
    professional_type: string;
    specialty: string | null;
    has_digital_certificate: boolean;
    crm_verified_at: string | null;
  } | null;
}
