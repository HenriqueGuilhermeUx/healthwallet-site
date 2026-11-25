import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isValidHash } from '@/lib/server/supabaseAdmin'

function maskIp(ip: string | null | undefined) {
  if (!ip || ip === 'unknown') return null
  if (ip.includes('.')) return ip.split('.').slice(0, 2).join('.') + '.*.*'
  if (ip.includes(':')) return ip.split(':').slice(0, 2).join(':') + ':*'
  return null
}

// Public validation of a signed document by its exact SHA-256 hash.
// Never returns the full CPF, e-mail or full IP address.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const hash = String(body.hash || '').trim().toLowerCase()

    if (!isValidHash(hash)) {
      return NextResponse.json({ error: 'Assinatura não encontrada ou inválida.' }, { status: 404 })
    }

    const supabase = getSupabaseAdmin()
    const { data: signature, error } = await supabase
      .from('signatures')
      .select('signer_name, signer_role, signer_cpf, signed_at, document_hash, document_snapshot, ip_address, user_agent, audit_trail, status')
      .eq('document_hash', hash)
      .eq('status', 'valid')
      .maybeSingle()

    if (error || !signature) {
      return NextResponse.json({ error: 'Assinatura não encontrada ou inválida.' }, { status: 404 })
    }

    const snapshot = (signature.document_snapshot || {}) as Record<string, any>
    const audit = (signature.audit_trail || {}) as Record<string, any>

    return NextResponse.json({
      signature: {
        signer_name: signature.signer_name,
        signer_role: signature.signer_role,
        signer_cpf_last2: String(signature.signer_cpf || '').slice(-2) || null,
        signed_at: signature.signed_at,
        document_hash: signature.document_hash,
        ip_address: maskIp(signature.ip_address || audit.ip_address),
        user_agent: signature.user_agent || audit.user_agent || null,
        document_snapshot: {
          title: snapshot.title,
          document_type: snapshot.document_type,
          body: snapshot.body,
          created_at: snapshot.created_at,
        },
        audit_trail: { steps: Array.isArray(audit.steps) ? audit.steps : [] },
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao validar a assinatura.' }, { status: 500 })
  }
}
