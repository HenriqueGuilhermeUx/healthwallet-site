/**
 * /api/prescriptions/[id]
 *   GET    → detalhe
 *   PUT    → atualiza (só permitido em rascunho)
 *   DELETE → remove (só permitido em rascunho)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT_FULL = `
  id, medico_id, paciente_id, tipo, data_emissao, status,
  cid_principal_id, cid_secundario_id, texto_cabecalho, texto_rodape,
  clicksign_document_key, clicksign_sign_url, pdf_assinado_url, pdf_final_path,
  assinado_em, enviado_paciente_em, created_at, updated_at,
  receita_itens ( id, posologia, quantidade, duracao_dias, via_administracao, observacoes, ordem, medicamento_id ),
  cid_principal:cids!receitas_cid_principal_id_fkey ( id, codigo, descricao )
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
      .from('receitas')
      .select(SELECT_FULL)
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
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

    // Carrega pra checar status
    const { data: atual } = await admin
      .from('receitas')
      .select('id, status')
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (!atual) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
    if (atual.status !== 'rascunho') {
      return NextResponse.json(
        { error: `Não é possível editar uma receita com status '${atual.status}'` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.tipo) updates.tipo = body.tipo;
    if ('cid_principal_id' in body) updates.cid_principal_id = body.cid_principal_id;
    if ('cid_secundario_id' in body) updates.cid_secundario_id = body.cid_secundario_id;
    if ('texto_cabecalho' in body) updates.texto_cabecalho = body.texto_cabecalho;
    if ('texto_rodape' in body) updates.texto_rodape = body.texto_rodape;

    if (Object.keys(updates).length > 0) {
      const { error: uErr } = await admin.from('receitas').update(updates).eq('id', Number(id));
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    if (Array.isArray(body.itens)) {
      // estratégia simples: deleta todos e reinsere (só rascunho, ok)
      await admin.from('receita_itens').delete().eq('receita_id', Number(id));
      const itensToInsert = body.itens.map((it: any, idx: number) => ({
        receita_id: Number(id),
        medicamento_id: it.medicamento_id || null,
        posologia: it.posologia,
        quantidade: it.quantidade || null,
        duracao_dias: it.duracao_dias || null,
        via_administracao: it.via_administracao || null,
        observacoes: it.observacoes || null,
        ordem: it.ordem ?? idx,
      }));
      const { error: iErr } = await admin.from('receita_itens').insert(itensToInsert);
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
    }

    const { data: final } = await admin
      .from('receitas')
      .select(SELECT_FULL)
      .eq('id', Number(id))
      .single();
    return NextResponse.json(final);
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
    const { data: atual } = await admin
      .from('receitas')
      .select('id, status')
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (!atual) return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
    if (atual.status !== 'rascunho') {
      return NextResponse.json(
        { error: 'Só é possível deletar receita em rascunho' },
        { status: 409 },
      );
    }
    await admin.from('receita_itens').delete().eq('receita_id', Number(id));
    const { error } = await admin.from('receitas').delete().eq('id', Number(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
