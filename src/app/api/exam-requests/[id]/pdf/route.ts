/**
 * GET /api/exam-requests/[id]/pdf
 *   → gera o PDF do pedido de exame (sem Clicksign, só download direto)
 *
 * Esse endpoint destrava o uso em dev/teste sem precisar de assinatura
 * digital. Em produção, o médico pode usar o "Enviar p/ assinatura"
 * (mesma rota do send das receitas) pra ter validade jurídica.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getProfessionalFromSession } from '@/lib/supabase-server';
import { renderPedidoExamePdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const professional = await getProfessionalFromSession();
    if (!professional) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const admin = getSupabaseAdmin();

    const { data: pedido, error } = await admin
      .from('pedidos_exame')
      .select(`
        id, medico_id, paciente_id, cid_principal_id, cid_secundario_id,
        texto_clinico, data_emissao, status, created_at,
        cid_principal:cids!pedidos_exame_cid_principal_id_fkey ( codigo, descricao ),
        cid_secundario:cids!pedidos_exame_cid_secundario_id_fkey ( codigo, descricao ),
        pedido_exame_itens ( id, exame_id, observacoes, ordem, exame:exames_tuss ( codigo_tuss, descricao, categoria ) )
      `)
      .eq('id', Number(id))
      .eq('medico_id', professional.id)
      .single();

    if (error || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Dados do paciente
    const { data: pacienteProfile } = await admin
      .from('profiles')
      .select('birth_date, gender, blood_type, phone')
      .eq('id', pedido.paciente_id)
      .single();
    const { data: pacienteAuth } = await admin.auth.admin.getUserById(pedido.paciente_id);
    const paciente = {
      full_name: pacienteAuth?.user?.user_metadata?.full_name || pacienteAuth?.user?.email?.split('@')[0] || 'Paciente',
      email: pacienteAuth?.user?.email || null,
      cpf: null as string | null,
      birth_date: pacienteProfile?.birth_date || null,
      gender: pacienteProfile?.gender || null,
      blood_type: pacienteProfile?.blood_type || null,
      phone: pacienteProfile?.phone || null,
    };

    // Dados do médico
    const medico = {
      full_name: professional.full_name,
      cpf: professional.cpf,
      professional_register: professional.professional_register,
      register_state: professional.register_state,
      professional_type: professional.professional_type,
      specialty: professional.specialty,
    };

    const pdfBuffer = await renderPedidoExamePdf({
      pedido: pedido as any,
      itens: (pedido.pedido_exame_itens as any[]) || [],
      paciente,
      medico,
    });

    // NextResponse exige BodyInit — converter Buffer pra Uint8Array
    const body = new Uint8Array(pdfBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="pedido-exame-${pedido.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[exam-requests/pdf]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar PDF' },
      { status: 500 },
    );
  }
}
