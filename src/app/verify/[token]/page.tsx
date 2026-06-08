'use client';

/**
 * /verify/[token]
 * Página PÚBLICA (sem auth) que o paciente acessa via link do email.
 * Mostra o audit trail do documento e permite confirmar leitura.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, FileText, Loader2, Shield } from 'lucide-react';

type Delivery = {
  ok: boolean;
  delivery: {
    id: number;
    document_type: 'receita' | 'exame';
    document_id: number;
    recipient_email: string;
    document_hash: string;
    confirmation_status: 'pendente' | 'confirmada' | 'expirada';
    confirmed_at: string | null;
    medico: {
      full_name: string;
      professional_register: string;
      register_state: string;
      specialty: string | null;
    };
  };
};

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!token) return;
    // Já busca o delivery pra mostrar o audit trail
    fetch(`/api/deliveries/confirm?token=${token}`)
      .then(async (r) => {
        if (r.status === 404) {
          throw new Error('Link inválido ou expirado. Solicite um novo envio ao seu médico.');
        }
        if (!r.ok) throw new Error('Erro ao verificar');
        const j = await r.json();
        setData(j);
        if (j.delivery?.confirmation_status === 'confirmada') {
          setConfirmed(true);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const r = await fetch(`/api/deliveries/confirm?token=${token}`);
      if (!r.ok) throw new Error('Erro ao confirmar');
      const j = await r.json();
      setData(j);
      setConfirmed(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Link inválido</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const d = data.delivery;
  const docLabel = d.document_type === 'receita' ? 'Receita Digital' : 'Pedido de Exame';
  const shortHash = d.document_hash.slice(0, 16) + '…' + d.document_hash.slice(-8);
  const isConfirmed = confirmed || d.confirmation_status === 'confirmada';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-3">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verificação de Documento</h1>
          <p className="text-sm text-slate-500 mt-1">HealthWallet Pro • Audit trail</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Status badge */}
          <div className={`p-4 ${isConfirmed ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            {isConfirmed ? (
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold text-sm">Leitura confirmada</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold text-sm">Aguardando confirmação de leitura</span>
              </div>
            )}
            {d.confirmed_at && (
              <p className="text-xs text-emerald-700 mt-1">
                Confirmado em {new Date(d.confirmed_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          {/* Detalhes */}
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Documento</p>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-slate-900">{docLabel}</span>
                <span className="text-xs text-slate-500">#{d.document_id}</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Emitido por</p>
              <p className="font-semibold text-slate-900">{d.medico.full_name}</p>
              <p className="text-sm text-slate-600">
                {d.medico.professional_register}/{d.medico.register_state}
                {d.medico.specialty ? ` • ${d.medico.specialty}` : ''}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Enviado para</p>
              <p className="text-sm text-slate-700 font-mono">{d.recipient_email}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">ID da entrega</p>
              <p className="text-sm text-slate-700 font-mono">#{d.id}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Hash SHA-256 do PDF</p>
              <p className="text-xs text-slate-600 font-mono break-all bg-slate-50 p-2 rounded border border-slate-200">
                {shortHash}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Este hash garante a integridade do documento. Qualquer alteração no PDF gera um hash diferente.
              </p>
            </div>
          </div>

          {/* Action */}
          {!isConfirmed && (
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {confirming ? 'Confirmando…' : 'Confirmo que recebi e li o documento'}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Sua confirmação registra data, hora e IP, completando o audit trail com validade jurídica.
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-xs text-slate-500">
          <Link href="/" className="hover:underline">HealthWallet Pro</Link>
          {' • '}
          <span>Sistema de assinatura digital própria conforme Lei 14.063/2020</span>
        </div>
      </div>
    </div>
  );
}
