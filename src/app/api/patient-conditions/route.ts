/**
 * /api/patient-conditions
 *   GET    ?paciente_id=... → lista condições ativas do paciente
 *   POST   → cria condição (médico que tem acesso)
 *   DELETE ?id=...         → remove
 *
 * Obs: regras RLS já protegem — médico só vê se tem access_code com o paciente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function checkAccess(pacienteId: string): Promise<boolean> {
  const professional = await getProfessionalFromSession();
  if (!professional) return false;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('access_codes')
    .select('id')
    .eq('professional_id', professional.id)
    .eq('patient_id', pacienteId)
    .not('used_at', 'is', null)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function GET(request: NextRequest) {
  const pacienteId = request.nextUrl.searchParams.get('paciente_id');
  if (!pacienteId) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });
  if (!(await checkAccess(pacienteId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('patient_conditions')
    .select(`
      id, paciente_id, cid_id, descricao_livre, data_inicio, notas, ativa, created_at,
      cid:cids ( id, codigo, descricao )
    `)
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paciente_id, cid_id, descricao_livre, data_inicio, notas } = body;
    if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });
    if (!cid_id && !descricao_livre) {
      return NextResponse.json({ error: 'Informe cid_id ou descricao_livre' }, { status: 400 });
    }
    if (!(await checkAccess(paciente_id))) {
      return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('patient_conditions')
      .insert({
        paciente_id,
        cid_id: cid_id || null,
        descricao_livre: descricao_livre || null,
        data_inicio: data_inicio || null,
        notas: notas || null,
        ativa: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  const admin = getSupabaseAdmin();
  // Verifica ownership via RLS-friendly query
  const { data: existing } = await admin
    .from('patient_conditions')
    .select('paciente_id')
    .eq('id', Number(id))
    .single();
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });
  if (!(await checkAccess(existing.paciente_id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }
  const { error } = await admin.from('patient_conditions').delete().eq('id', Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
