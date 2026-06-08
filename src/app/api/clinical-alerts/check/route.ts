/**
 * /api/clinical-alerts/check
 *   POST { paciente_id, medicamento_ids: number[] }
 *   → chama check_clinical_alerts_for_items() e devolve a lista
 *
 * Usado pela tela de Nova Receita para alertar o médico em tempo real
 * sobre alergias, duplicatas e medicamentos já em uso.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { paciente_id, medicamento_ids } = body;

    if (!paciente_id) {
      return NextResponse.json({ error: 'paciente_id obrigatório' }, { status: 400 });
    }
    if (!Array.isArray(medicamento_ids)) {
      return NextResponse.json({ error: 'medicamento_ids deve ser array' }, { status: 400 });
    }

    // Verifica que o médico tem access_code ativo para o paciente
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

    // Filtra IDs nulos/inválidos
    const ids = medicamento_ids.filter((x): x is number => typeof x === 'number' && x > 0);
    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await admin.rpc('check_clinical_alerts_for_items', {
      p_paciente_id: paciente_id,
      p_medicamento_ids: ids,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
