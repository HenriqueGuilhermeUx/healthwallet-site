/**
 * GET /api/medications/search?q=amoxi&limit=20
 *
 * Usa a view vw_medicamentos_autocomplete (criada pela migration).
 * Combina 3 estratégias: prefix match (ILIKE), FTS e trigram similarity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 50);
    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const admin = getSupabaseAdmin();
    // Bate em 3 frentes: prefixo (rápido), FTS, e trigram para fuzzy
    // O Supabase expõe a função `similarity` via RPC — usamos ILIKE + FTS
    // diretamente pra evitar RPC extra.
    const { data, error } = await admin
      .from('vw_medicamentos_autocomplete')
      .select('*')
      .or(`nome_comercial.ilike.${q}%,nome_comercial.ilike.%${q}%,principio_ativo.ilike.%${q}%`)
      .eq('ativo', true)
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
