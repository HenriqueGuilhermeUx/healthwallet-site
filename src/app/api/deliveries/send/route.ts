/**
 * POST /api/deliveries/send
 *   body: { document_type: 'receita' | 'exame', document_id: number, recipient_email?: string }
 *
 * Envia o PDF do documento por email com:
 *   - Audit trail em document_deliveries
 *   - Hash SHA-256 do PDF
 *   - Token de confirmação pro paciente
 *   - PDF anexado
 *
 * Substitui o "enviar via Clicksign" como provider padrão.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';
import { sendDeliveryEmail, sha256 } from '@/lib/email';
import { renderReceitaPdf, renderPedidoExamePdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const professional = await getProfessionalFromSession();
    if (!professional) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { document_type, document_id, recipient_email: overrideEmail } = body;

    if (!['receita', 'exame'].includes(document_type)) {
      return NextResponse.json({ error: 'document_type inválido' }, { status: 400 });
    }
    if (!document_id) {
      return NextResponse.json({ error: 'document_id obrigatório' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    let pacienteId: string;
    let pdfBuffer: Buffer;
    let subject: string;

    if (document_type === 'receita') {
      // 1) Carrega receita
      const { data: receita } = await admin
        .from('receitas')
        .select(`
          id, medico_id, paciente_id, tipo, data_emissao, status,
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
        .eq('id', Number(document_id))
        .eq('medico_id', professional.id)
        .single();

      if (!receita) {
        return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
      }
      pacienteId = receita.paciente_id;

      // 2) Paciente
      const { data: pacienteProfile } = await admin
        .from('profiles')
        .select('birth_date, gender, blood_type, phone')
        .eq('id', receita.paciente_id)
        .single();
      const { data: pacienteAuth } = await admin.auth.admin.getUserById(receita.paciente_id);
      const paciente = {
        full_name: pacienteAuth?.user?.user_metadata?.full_name || pacienteAuth?.user?.email?.split('@')[0] || 'Paciente',
        email: pacienteAuth?.user?.email || '',
        cpf: null as string | null,
        birth_date: pacienteProfile?.birth_date || null,
        gender: pacienteProfile?.gender || null,
        blood_type: pacienteProfile?.blood_type || null,
        phone: pacienteProfile?.phone || null,
      };
      if (!paciente.email && !overrideEmail) {
        return NextResponse.json({ error: 'Email do paciente não encontrado' }, { status: 400 });
      }

      // 3) Gera PDF
      pdfBuffer = await renderReceitaPdf({
        id: receita.id,
        tipo: receita.tipo,
        data_emissao: receita.data_emissao,
        texto_cabecalho: (receita as any).texto_cabecalho ?? null,
        texto_rodape: (receita as any).texto_rodape ?? null,
        cid_principal: (receita as any).cid_principal
          ? { codigo: (receita as any).cid_principal.codigo, descricao: (receita as any).cid_principal.descricao }
          : null,
        profissional: {
          full_name: professional.full_name,
          professional_register: professional.professional_register,
          register_state: professional.register_state,
          specialty: professional.specialty,
          crm_verified_data: (professional as any).crm_verified_data,
        },
        paciente: {
          full_name: paciente.full_name,
          cpf: paciente.cpf,
          birth_date: paciente.birth_date,
        },
        itens: ((receita.receita_itens as any[]) || [])
          .filter((ri: any) => !!ri.medicamento)
          .map((ri: any) => ({
            posologia: ri.posologia,
            quantidade: ri.quantidade,
            duracao_dias: ri.duracao_dias,
            via_administracao: ri.via_administracao,
            observacoes: ri.observacoes,
            medicamento: {
              registro_ms: ri.medicamento.registro_ms,
              nome_comercial: ri.medicamento.nome_comercial,
              concentracao: ri.medicamento.concentracao,
              tarja: ri.medicamento.tarja,
              principio_ativo: ri.medicamento.principio_ativo?.nome ?? null,
              laboratorio: ri.medicamento.laboratorio?.nome ?? null,
              forma_farmaceutica: ri.medicamento.forma_farmaceutica?.descricao ?? null,
            },
          })),
      });
      subject = `📄 Receita Digital — Dr(a). ${professional.full_name}`;
    } else {
      // exame
      const { data: pedido } = await admin
        .from('pedidos_exame')
        .select(`
          id, medico_id, paciente_id, cid_principal_id, cid_secundario_id,
          texto_clinico, data_emissao, status,
          cid_principal:cids!pedidos_exame_cid_principal_id_fkey ( codigo, descricao ),
          pedido_exame_itens ( id, exame_id, observacoes, exame:exames_tuss ( codigo_tuss, descricao, categoria ) )
        `)
        .eq('id', Number(document_id))
        .eq('medico_id', professional.id)
        .single();

      if (!pedido) {
        return NextResponse.json({ error: 'Pedido de exame não encontrado' }, { status: 404 });
      }
      pacienteId = pedido.paciente_id;

      const { data: pacienteProfile } = await admin
        .from('profiles')
        .select('birth_date, gender, blood_type, phone')
        .eq('id', pedido.paciente_id)
        .single();
      const { data: pacienteAuth } = await admin.auth.admin.getUserById(pedido.paciente_id);
      const paciente = {
        full_name: pacienteAuth?.user?.user_metadata?.full_name || pacienteAuth?.user?.email?.split('@')[0] || 'Paciente',
        email: pacienteAuth?.user?.email || '',
        birth_date: pacienteProfile?.birth_date || null,
        gender: pacienteProfile?.gender || null,
        blood_type: pacienteProfile?.blood_type || null,
      };
      if (!paciente.email && !overrideEmail) {
        return NextResponse.json({ error: 'Email do paciente não encontrado' }, { status: 400 });
      }

      pdfBuffer = await renderPedidoExamePdf({
        pedido: pedido as any,
        itens: (pedido.pedido_exame_itens as any[]) || [],
        paciente,
        medico: professional,
      });
      subject = `🔬 Pedido de Exame — Dr(a). ${professional.full_name}`;
    }

    // Pega email final (override ou do auth)
    const finalEmail = overrideEmail || (await admin.auth.admin.getUserById(pacienteId))?.data?.user?.email || '';
    if (!finalEmail) {
      return NextResponse.json({ error: 'Email do destinatário não disponível' }, { status: 400 });
    }

    // Envia via Resend (ou dry-run)
    const result = await sendDeliveryEmail({
      documentType: document_type,
      documentId: Number(document_id),
      medico: {
        id: professional.id,
        full_name: professional.full_name,
        professional_register: professional.professional_register,
        register_state: professional.register_state,
        specialty: professional.specialty,
      },
      paciente: {
        id: pacienteId,
        full_name: finalEmail.split('@')[0],
        email: finalEmail,
      },
      pdfBuffer,
      subject,
      documentHash: sha256(pdfBuffer),
    });

    return NextResponse.json({
      ok: result.ok,
      deliveryId: result.deliveryId,
      mode: result.mode,
      verifyUrl: result.verifyUrl,
      recipient: finalEmail,
      error: result.error,
    });
  } catch (err) {
    console.error('[deliveries/send]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao enviar' },
      { status: 500 },
    );
  }
}
