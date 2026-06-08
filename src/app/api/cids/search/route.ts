/**
 * GET /api/cids/search?q=diabete&limit=20
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
    const { data, error } = await admin
      .from('cids')
      .select('id, codigo, descricao, versao')
      .or(`codigo.ilike.${q}%,codigo.ilike.%${q}%,descricao.ilike.%${q}%`)
      .eq('ativo', true)
      .order('codigo')
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
