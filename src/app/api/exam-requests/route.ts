/**
 * /api/exam-requests
 *   GET  → lista pedidos do médico logado (filtro opcional por paciente_id)
 *   POST → cria pedido em rascunho
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const pacienteId = request.nextUrl.searchParams.get('paciente_id');
    const admin = getSupabaseAdmin();
    let q = admin
      .from('pedidos_exame')
      .select(`
        id, medico_id, paciente_id, cid_principal_id, cid_secundario_id,
        texto_clinico, data_emissao, status, assinado_em, enviado_paciente_em,
        created_at, updated_at,
        cid_principal:cids!pedidos_exame_cid_principal_id_fkey ( id, codigo, descricao ),
        pedido_exame_itens ( id, exame_id, observacoes, ordem, exame:exames_tuss ( id, codigo_tuss, descricao, categoria ) )
      `)
      .eq('medico_id', professional.id)
      .order('data_emissao', { ascending: false })
      .limit(200);
    if (pacienteId) q = q.eq('paciente_id', pacienteId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { paciente_id, cid_principal_id, cid_secundario_id, texto_clinico, itens } = body;

    if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });
    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Adicione ao menos um exame' }, { status: 400 });
    }

    // Verifica acesso médico-paciente
    const admin = getSupabaseAdmin();
    const { data: access } = await admin
      .from('access_codes')
      .select('id')
      .eq('professional_id', professional.id)
      .eq('patient_id', paciente_id)
      .not('used_at', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!access) {
      return NextResponse.json({ error: 'Você não tem acesso a este paciente.' }, { status: 403 });
    }

    // Cria o pedido
    const { data: pedido, error: pedError } = await admin
      .from('pedidos_exame')
      .insert({
        medico_id: professional.id,
        paciente_id,
        cid_principal_id: cid_principal_id || null,
        cid_secundario_id: cid_secundario_id || null,
        texto_clinico: texto_clinico || null,
        status: 'rascunho',
      })
      .select()
      .single();
    if (pedError || !pedido) {
      return NextResponse.json({ error: pedError?.message || 'Erro ao criar pedido' }, { status: 500 });
    }

    // Cria os itens
    const itensRows = itens
      .filter((it: { exame_id?: number }) => it.exame_id)
      .map((it: { exame_id: number; observacoes?: string; ordem?: number }, i: number) => ({
        pedido_id: pedido.id,
        exame_id: it.exame_id,
        observacoes: it.observacoes || null,
        ordem: typeof it.ordem === 'number' ? it.ordem : i,
      }));
    if (itensRows.length > 0) {
      const { error: itensErr } = await admin.from('pedido_exame_itens').insert(itensRows);
      if (itensErr) {
        // Rollback: deleta o pedido
        await admin.from('pedidos_exame').delete().eq('id', pedido.id);
        return NextResponse.json({ error: itensErr.message }, { status: 500 });
      }
    }

    // Retorna o pedido completo
    const { data: full } = await admin
      .from('pedidos_exame')
      .select(`
        id, medico_id, paciente_id, cid_principal_id, cid_secundario_id,
        texto_clinico, data_emissao, status, created_at, updated_at,
        cid_principal:cids!pedidos_exame_cid_principal_id_fkey ( id, codigo, descricao ),
        pedido_exame_itens ( id, exame_id, observacoes, ordem, exame:exames_tuss ( id, codigo_tuss, descricao, categoria ) )
      `)
      .eq('id', pedido.id)
      .single();
    return NextResponse.json(full);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
