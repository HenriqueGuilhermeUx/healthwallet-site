/**
 * POST /api/crm/validate
 *
 * Valida o CRM do profissional logado contra a base do CFM (Listamedicos).
 * Se sucesso, atualiza `professionals.crm_verified_at` e `crm_verified_data`.
 *
 * Body (opcional):
 *   { crm?: string, uf?: string }  — se não informado, usa o registro do profissional logado
 *
 * Resposta:
 *   {
 *     ok: true,
 *     active: boolean,
 *     situation: string | null,
 *     fullName: string | null,
 *     specialty: string | null,
 *     verifiedAt: string,
 *     nextCheckAt: string,
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';
import { validateCRM } from '@/lib/cfm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVALIDATION_DAYS = 30; // revalidar todo mês

export async function POST(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (professional.professional_type !== 'medico') {
      return NextResponse.json(
        { error: 'Validação CFM só se aplica a médicos. Outros conselhos têm endpoints próprios.' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const crm = (body.crm as string) || professional.professional_register;
    const uf = (body.uf as string) || professional.register_state;

    if (!crm || !uf) {
      return NextResponse.json({ error: 'CRM e UF são obrigatórios' }, { status: 400 });
    }

    let result;
    try {
      result = await validateCRM({ crm, uf });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      // Se a chave CFM não estiver configurada, retornamos 503 com instrução clara
      if (msg.includes('CFM_ACCESS_KEY')) {
        return NextResponse.json(
          { error: 'Validação automática indisponível. Configure CFM_ACCESS_KEY ou marque verificação manual.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: `Falha na consulta CFM: ${msg}` }, { status: 502 });
    }

    const now = new Date();
    const nextCheck = new Date(now.getTime() + REVALIDATION_DAYS * 24 * 60 * 60 * 1000);

    if (!result.found) {
      return NextResponse.json(
        { ok: false, error: 'CRM não encontrado na base do CFM', verifiedAt: null },
        { status: 404 },
      );
    }

    if (!result.active) {
      // CRM existe mas está irregular — não atualiza `crm_verified_at`
      return NextResponse.json(
        {
          ok: false,
          error: 'CRM encontrado, mas situação irregular',
          situation: result.situation,
          active: false,
        },
        { status: 200 },
      );
    }

    // CRM ativo — persiste a validação
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from('professionals')
      .update({
        crm_verified_at: now.toISOString(),
        crm_check_due_at: nextCheck.toISOString(),
        crm_verification_source: 'CFM_LISTAMEDICOS',
        crm_verified_data: {
          fullName: result.fullName,
          crm: result.crm,
          uf: result.uf,
          specialty: result.specialty,
          situation: result.situation,
        },
        // Se vier especialidade oficial do CFM e o médico não preencheu, usa o do CFM
        specialty: result.specialty || professional.specialty,
      })
      .eq('id', professional.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Falha ao salvar validação: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      active: true,
      situation: result.situation,
      fullName: result.fullName,
      specialty: result.specialty,
      verifiedAt: now.toISOString(),
      nextCheckAt: nextCheck.toISOString(),
    });
  } catch (err) {
    console.error('[crm/validate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
