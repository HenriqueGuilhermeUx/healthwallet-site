/**
 * /api/consultations
 *   GET  → lista consultas do médico logado (filtro opcional por paciente_id)
 *   POST → cria consulta em rascunho ou finalizada
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
      .from('consultations')
      .select(`
        id, medico_id, paciente_id, data_consulta,
        anamnese, exame_fisico, hipotese_diagnostica,
        cid_principal_id, cid_secundario_id, conduta, notas,
        status, created_at, updated_at,
        cid_principal:cids!consultations_cid_principal_id_fkey ( id, codigo, descricao )
      `)
      .eq('medico_id', professional.id)
      .order('data_consulta', { ascending: false })
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
    const {
      paciente_id,
      data_consulta,
      anamnese,
      exame_fisico,
      hipotese_diagnostica,
      cid_principal_id,
      cid_secundario_id,
      conduta,
      notas,
      status,
    } = body;

    if (!paciente_id) return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });

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
      return NextResponse.json(
        { error: 'Você não tem acesso a este paciente.' },
        { status: 403 },
      );
    }

    const { data, error } = await admin
      .from('consultations')
      .insert({
        medico_id: professional.id,
        paciente_id,
        data_consulta: data_consulta || new Date().toISOString(),
        anamnese: anamnese || {},
        exame_fisico: exame_fisico || null,
        hipotese_diagnostica: hipotese_diagnostica || null,
        cid_principal_id: cid_principal_id || null,
        cid_secundario_id: cid_secundario_id || null,
        conduta: conduta || null,
        notas: notas || null,
        status: status === 'em_andamento' ? 'em_andamento' : 'realizada',
      })
      .select()
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Erro ao criar consulta' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
