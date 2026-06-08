/**
 * /api/exam-requests/[id]
 *   GET    → detalhe
 *   PUT    → atualiza (texto clínico, CID, itens)
 *   DELETE → remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT_FULL = `
  id, medico_id, paciente_id, cid_principal_id, cid_secundario_id,
  texto_clinico, data_emissao, status, created_at, updated_at,
  cid_principal:cids!pedidos_exame_cid_principal_id_fkey ( id, codigo, descricao ),
  pedido_exame_itens ( id, exame_id, observacoes, ordem, exame:exames_tuss ( id, codigo_tuss, descricao, categoria ) )
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('pedidos_exame')
      .select(SELECT_FULL)
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from('pedidos_exame')
      .select('id, status')
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if ('texto_clinico' in body) updates.texto_clinico = body.texto_clinico;
    if ('cid_principal_id' in body) updates.cid_principal_id = body.cid_principal_id;
    if ('cid_secundario_id' in body) updates.cid_secundario_id = body.cid_secundario_id;
    if ('status' in body) updates.status = body.status;

    if (Object.keys(updates).length > 0) {
      const { error } = await admin.from('pedidos_exame').update(updates).eq('id', Number(id));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Atualiza itens (substituição completa)
    if (Array.isArray(body.itens)) {
      await admin.from('pedido_exame_itens').delete().eq('pedido_id', Number(id));
      const rows = body.itens
        .filter((it: { exame_id?: number }) => it.exame_id)
        .map((it: { exame_id: number; observacoes?: string; ordem?: number }, i: number) => ({
          pedido_id: Number(id),
          exame_id: it.exame_id,
          observacoes: it.observacoes || null,
          ordem: typeof it.ordem === 'number' ? it.ordem : i,
        }));
      if (rows.length > 0) {
        const { error: iErr } = await admin.from('pedido_exame_itens').insert(rows);
        if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
      }
    }

    const { data } = await admin.from('pedidos_exame').select(SELECT_FULL).eq('id', Number(id)).single();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('pedidos_exame')
      .select('id')
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    const { error } = await admin.from('pedidos_exame').delete().eq('id', Number(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
