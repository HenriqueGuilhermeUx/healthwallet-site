/**
 * POST /api/prescriptions/[id]/send
 *
 * 1) Carrega a receita + itens + dados do médico e paciente (do Supabase)
 * 2) Gera o PDF via @react-pdf/renderer
 * 3) Cria documento + signatário + lista na Clicksign (auth: digital_certificate)
 * 4) Salva os IDs Clicksign + sign_url na receita
 * 5) Retorna a sign_url para o front-end abrir o widget
 *
 * Pré-condição: receita.medico_id == profissional logado e status = 'rascunho'
 *
 * Se o médico não tiver CRM verificado, bloqueia (exige validação via /api/crm/validate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';
import { sendDocumentForSignature } from '@/lib/clicksign';
import { renderReceitaPdf, bufferToDataUriBase64 } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: receitaIdParam } = await params;
    const receitaId = Number(receitaIdParam);
    if (!Number.isFinite(receitaId)) {
      return NextResponse.json({ error: 'ID de receita inválido' }, { status: 400 });
    }

    const professional = await getProfessionalFromSession();
    if (!professional) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (professional.professional_type !== 'medico') {
      return NextResponse.json(
        { error: 'Apenas médicos podem emitir receitas digitais no momento.' },
        { status: 403 },
      );
    }
    if (!professional.crm_verified_at) {
      return NextResponse.json(
        {
          error: 'CRM não validado. Chame POST /api/crm/validate antes de enviar receitas.',
        },
        { status: 409 },
      );
    }

    const admin = getSupabaseAdmin();

    // 1) Carregar receita
    const { data: receita, error: receitaError } = await admin
      .from('receitas')
      .select(`
        id, medico_id, paciente_id, tipo, data_emissao, texto_cabecalho, texto_rodape, status,
        cid_principal_id, cid_secundario_id,
        receita_itens (
          id, posologia, quantidade, duracao_dias, via_administracao, observacoes, ordem, medicamento_id,
          medicamento:medicamentos (
            registro_ms, nome_comercial, concentracao, tarja, tipo_receita,
            principio_ativo:principios_ativos ( nome ),
            laboratorio:laboratorios ( nome ),
            forma_farmaceutica:formas_farmaceuticas ( descricao )
          )
        ),
        cid_principal:cids!receitas_cid_principal_id_fkey ( codigo, descricao )
      `)
      .eq('id', receitaId)
      .eq('medico_id', professional.id)
      .single();

    if (receitaError || !receita) {
      return NextResponse.json(
        { error: 'Receita não encontrada ou não pertence a este profissional' },
        { status: 404 },
      );
    }
    if (receita.status !== 'rascunho') {
      return NextResponse.json(
        { error: `Receita não está em rascunho (status atual: ${receita.status})` },
        { status: 409 },
      );
    }
    if (!receita.receita_itens || receita.receita_itens.length === 0) {
      return NextResponse.json(
        { error: 'Receita sem itens — adicione ao menos um medicamento antes de enviar.' },
        { status: 400 },
      );
    }

    // 2) Carregar dados do paciente (auth.users + profile)
    const { data: pacienteProfile } = await admin
      .from('profiles')
      .select('full_name, cpf, birth_date, email')
      .eq('id', receita.paciente_id)
      .single();
    const { data: pacienteAuth } = await admin.auth.admin.getUserById(receita.paciente_id);

    const paciente = {
      full_name: pacienteProfile?.full_name || pacienteAuth?.user?.email?.split('@')[0] || 'Paciente',
      cpf: pacienteProfile?.cpf || null,
      birth_date: pacienteProfile?.birth_date || null,
    };

    // 3) Montar payload para o PDF
    const itensNormalizados = (receita.receita_itens as any[])
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((it: any) => ({
        posologia: it.posologia,
        quantidade: it.quantidade,
        duracao_dias: it.duracao_dias,
        via_administracao: it.via_administracao,
        observacoes: it.observacoes,
        medicamento: {
          nome_comercial: it.medicamento?.nome_comercial || 'Medicamento',
          principio_ativo: it.medicamento?.principio_ativo?.nome || null,
          concentracao: it.medicamento?.concentracao || null,
          forma_farmaceutica: it.medicamento?.forma_farmaceutica?.descricao || null,
          laboratorio: it.medicamento?.laboratorio?.nome || null,
          tarja: it.medicamento?.tarja || null,
          registro_ms: it.medicamento?.registro_ms || null,
        },
      }));

    const pdfBuffer = await renderReceitaPdf({
      id: receita.id,
      tipo: receita.tipo,
      data_emissao: receita.data_emissao,
      texto_cabecalho: receita.texto_cabecalho,
      texto_rodape: receita.texto_rodape,
      cid_principal: receita.cid_principal
        ? { codigo: (receita.cid_principal as any).codigo, descricao: (receita.cid_principal as any).descricao }
        : null,
      profissional: {
        full_name: professional.full_name,
        professional_register: professional.professional_register,
        register_state: professional.register_state,
        specialty: professional.specialty,
        crm_verified_data: (professional as any).crm_verified_data,
      },
      paciente,
      itens: itensNormalizados,
    });

    // 4) Enviar para Clicksign
    const { documentKey, signerKey, signUrl } = await sendDocumentForSignature({
      pdfBase64: bufferToDataUriBase64(pdfBuffer),
      documentPath: `/receitas/${receita.paciente_id}/receita_${receita.id}.pdf`,
      signer: {
        name: professional.full_name,
        email: pacienteAuth?.user?.email || professional.full_name.replace(/\s+/g, '.').toLowerCase() + '@healthwallet.pro',
        cpf: professional.cpf,
        auths: ['digital_certificate'],
        hasDocumentation: true,
        customFields: {
          receita_id: String(receita.id),
          paciente_id: receita.paciente_id,
        },
      },
    });

    // 5) Persistir na receita
    const { error: updateError } = await admin
      .from('receitas')
      .update({
        status: 'aguardando_assinatura',
        clicksign_document_key: documentKey,
        clicksign_signer_key: signerKey,
        clicksign_sign_url: signUrl,
      })
      .eq('id', receita.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Falha ao atualizar receita: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      receitaId: receita.id,
      status: 'aguardando_assinatura',
      signUrl,
      documentKey,
      signerKey,
    });
  } catch (err) {
    console.error('[prescriptions/send]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
