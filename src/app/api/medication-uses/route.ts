/**
 * /api/medication-uses
 *   GET    ?paciente_id=... → medicações ativas do paciente
 *   POST   → adiciona medicação ao histórico
 *   DELETE ?id=...         → remove (ou marca ativo=false)
 *
 * Obs: regras RLS já protegem.
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
    .from('medication_uses')
    .select(`
      id, paciente_id, medicamento_id, medicamento_label, dose, frequencia, via,
      posologia_completa, data_inicio, data_fim, ativo, prescrito_por, created_at,
      medicamento:medicamentos ( id, nome_comercial, concentracao, tarja )
    `)
    .eq('paciente_id', pacienteId)
    .eq('ativo', true)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const {
      paciente_id, medicamento_id, medicamento_label,
      dose, frequencia, via, posologia_completa,
      data_inicio, data_fim,
    } = body;

    if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });
    if (!medicamento_id && !medicamento_label) {
      return NextResponse.json({ error: 'Informe medicamento_id ou medicamento_label' }, { status: 400 });
    }
    if (!(await checkAccess(paciente_id))) {
      return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('medication_uses')
      .insert({
        paciente_id,
        medicamento_id: medicamento_id || null,
        medicamento_label: medicamento_label || null,
        dose: dose || null,
        frequencia: frequencia || null,
        via: via || null,
        posologia_completa: posologia_completa || null,
        data_inicio: data_inicio || null,
        data_fim: data_fim || null,
        ativo: true,
        prescrito_por: professional.id,
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
  const { data: existing } = await admin
    .from('medication_uses')
    .select('paciente_id')
    .eq('id', Number(id))
    .single();
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });
  if (!(await checkAccess(existing.paciente_id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }
  // Marca como inativo em vez de deletar (histórico)
  const { error } = await admin
    .from('medication_uses')
    .update({ ativo: false, data_fim: new Date().toISOString().split('T')[0] })
    .eq('id', Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
