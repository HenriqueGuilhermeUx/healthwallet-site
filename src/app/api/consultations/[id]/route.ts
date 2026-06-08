/**
 * /api/consultations/[id]
 *   GET    → detalhe
 *   PUT    → atualiza (anamnese, diagnóstico, conduta, etc)
 *   DELETE → remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT_FULL = `
  id, medico_id, paciente_id, data_consulta,
  anamnese, exame_fisico, hipotese_diagnostica,
  cid_principal_id, cid_secundario_id, conduta, notas,
  status, created_at, updated_at,
  cid_principal:cids!consultations_cid_principal_id_fkey ( id, codigo, descricao )
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
      .from('consultations')
      .select(SELECT_FULL)
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
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

    // Verifica que a consulta pertence ao médico
    const { data: existing } = await admin
      .from('consultations')
      .select('id, status')
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if ('data_consulta' in body) updates.data_consulta = body.data_consulta;
    if ('anamnese' in body) updates.anamnese = body.anamnese;
    if ('exame_fisico' in body) updates.exame_fisico = body.exame_fisico;
    if ('hipotese_diagnostica' in body) updates.hipotese_diagnostica = body.hipotese_diagnostica;
    if ('cid_principal_id' in body) updates.cid_principal_id = body.cid_principal_id;
    if ('cid_secundario_id' in body) updates.cid_secundario_id = body.cid_secundario_id;
    if ('conduta' in body) updates.conduta = body.conduta;
    if ('notas' in body) updates.notas = body.notas;
    if ('status' in body) updates.status = body.status;

    if (Object.keys(updates).length > 0) {
      const { error } = await admin.from('consultations').update(updates).eq('id', Number(id));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = await admin
      .from('consultations')
      .select(SELECT_FULL)
      .eq('id', Number(id))
      .single();
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
      .from('consultations')
      .select('id, paciente_id')
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();
    if (!existing) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    const { error } = await admin.from('consultations').delete().eq('id', Number(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
