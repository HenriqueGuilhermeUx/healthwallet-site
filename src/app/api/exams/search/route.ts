/**
 * /api/exams/search?q=hemograma&limit=20
 *   → busca TUSS (catálogo público de exames) por descrição ou código
 *
 * Catálogo é público (não precisa auth) — igual à busca de CID/medicamentos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20));

  if (q.length < 2) return NextResponse.json([]);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('exames_tuss')
    .select('id, codigo_tuss, descricao, categoria, ativo')
    .eq('ativo', true)
    .or(`descricao.ilike.%${q}%,codigo_tuss.ilike.%${q}%`)
    .order('descricao')
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
