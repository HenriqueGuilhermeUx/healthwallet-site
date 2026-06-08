/**
 * GET /api/deliveries/confirm?token=...
 *   → registra confirmação de leitura do paciente
 *   → atualiza confirmation_status='confirmada' com IP e timestamp
 *
 * Chamado pela página /verify/[token] quando o paciente clica em "Confirmar".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const { data, error } = await admin
    .from('document_deliveries')
    .update({
      confirmation_status: 'confirmada',
      confirmed_at: new Date().toISOString(),
      confirmed_ip: ip,
      confirmed_user_agent: userAgent,
    })
    .eq('confirm_token', token)
    .select(`
      id, document_type, document_id, recipient_email, document_hash,
      confirmation_status, confirmed_at,
      medico:professionals ( full_name, professional_register, register_state, specialty )
    `)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    delivery: data,
  });
}
