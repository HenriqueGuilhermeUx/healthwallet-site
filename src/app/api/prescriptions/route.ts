/**
 * /api/prescriptions
 *   GET  → lista receitas do médico logado
 *   POST → cria receita em rascunho
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TIPOS = [
  'simples',
  'controle_especial_branca',
  'azul_b1b2',
  'amarela_a1a2',
];

// GET — lista
export async function GET(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    const admin = getSupabaseAdmin();
    let q = admin
      .from('receitas')
      .select(`
        id, medico_id, paciente_id, tipo, data_emissao, status,
        cid_principal_id, cid_secundario_id,
        texto_cabecalho, texto_rodape,
        clicksign_document_key, clicksign_sign_url, pdf_assinado_url, pdf_final_path,
        assinado_em, enviado_paciente_em, created_at, updated_at,
        receita_itens ( id, posologia, quantidade, duracao_dias, via_administracao, observacoes, ordem, medicamento_id )
      `)
      .eq('medico_id', professional.id)
      .order('data_emissao', { ascending: false })
      .limit(100);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

// POST — cria rascunho
export async function POST(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (professional.professional_type !== 'medico') {
      return NextResponse.json({ error: 'Apenas médicos podem criar receitas' }, { status: 403 });
    }

    const body = await request.json();
    const { paciente_id, tipo, cid_principal_id, cid_secundario_id, texto_cabecalho, texto_rodape, itens } = body;

    if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });
    if (!tipo || !VALID_TIPOS.includes(tipo)) {
      return NextResponse.json({ error: `tipo inválido. Use um de: ${VALID_TIPOS.join(', ')}` }, { status: 400 });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'A receita precisa ter ao menos 1 item' }, { status: 400 });
    }

    // Verifica que médico tem acesso ao paciente (access_code usado)
    const admin = getSupabaseAdmin();
    const { data: access } = await admin
      .from('access_codes')
      .select('id, permissions')
      .eq('professional_id', professional.id)
      .eq('patient_id', paciente_id)
      .not('used_at', 'is', null)
      .limit(1)
      .maybeSingle();

    if (!access) {
      return NextResponse.json(
        { error: 'Você não tem acesso a este paciente. Peça pra ele gerar um código de 6 dígitos.' },
        { status: 403 },
      );
    }

    // Insere receita
    const { data: receita, error: rErr } = await admin
      .from('receitas')
      .insert({
        medico_id: professional.id,
        paciente_id,
        tipo,
        cid_principal_id: cid_principal_id || null,
        cid_secundario_id: cid_secundario_id || null,
        texto_cabecalho: texto_cabecalho || null,
        texto_rodape: texto_rodape || null,
        status: 'rascunho',
      })
      .select()
      .single();
    if (rErr || !receita) {
      return NextResponse.json({ error: rErr?.message || 'Erro ao criar receita' }, { status: 500 });
    }

    // Insere itens
    const itensToInsert = itens.map((it: any, idx: number) => ({
      receita_id: receita.id,
      medicamento_id: it.medicamento_id || null,
      posologia: it.posologia,
      quantidade: it.quantidade || null,
      duracao_dias: it.duracao_dias || null,
      via_administracao: it.via_administracao || null,
      observacoes: it.observacoes || null,
      ordem: it.ordem ?? idx,
    }));
    const { error: iErr } = await admin.from('receita_itens').insert(itensToInsert);
    if (iErr) {
      // rollback manual
      await admin.from('receitas').delete().eq('id', receita.id);
      return NextResponse.json({ error: iErr.message }, { status: 500 });
    }

    return NextResponse.json({ ...receita, receita_itens: itensToInsert });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
