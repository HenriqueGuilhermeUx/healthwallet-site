'use client';

/**
 * Botão "Enviar por email" + modal.
 * Usado em:
 *   - /prescriptions/[id] (receitas)
 *   - /exam-requests/[id] (pedidos de exame)
 *
 * Chama POST /api/deliveries/send e mostra o audit ID pro médico.
 */

import { useState } from 'react';
import { Mail, Loader2, X, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export type EmailDeliveryButtonProps = {
  documentType: 'receita' | 'exame';
  documentId: number;
  /** Email do paciente (do auth.users), pré-preenchido no input */
  defaultEmail?: string | null;
  /** Label customizado do botão (default: "Enviar por email") */
  label?: string;
};

export function EmailDeliveryButton({
  documentType,
  documentId,
  defaultEmail,
  label,
}: EmailDeliveryButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || '');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    mode: 'sent' | 'dry_run' | 'failed';
    deliveryId: number;
    verifyUrl: string;
    recipient: string;
    error?: string;
  } | null>(null);

  async function handleSend() {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Informe um email válido');
      return;
    }
    setSending(true);
    try {
      const r = await fetch('/api/deliveries/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentType,
          document_id: documentId,
          recipient_email: email.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        throw new Error(j.error || 'Erro ao enviar');
      }
      setResult(j);
      if (j.mode === 'sent') {
        toast.success(`Email enviado para ${j.recipient}`);
      } else if (j.mode === 'dry_run') {
        toast.info('Modo dry-run: email salvo no outbox (RESEND_API_KEY não configurada)');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSending(false);
    }
  }

  function copyLink() {
    if (result?.verifyUrl) {
      navigator.clipboard.writeText(result.verifyUrl);
      toast.success('Link copiado!');
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setResult(null); }}
        className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700"
      >
        <Mail className="w-4 h-4" />
        {label || 'Enviar por email'}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {result ? 'Email enviado' : `Enviar ${documentType === 'receita' ? 'receita' : 'pedido'} por email`}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!result ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  O sistema envia o PDF anexado com um link de confirmação pro destinatário.
                  A entrega fica registrada no audit trail com hash SHA-256 do documento.
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email do destinatário</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="paciente@email.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-sky-500 outline-none text-sm"
                  autoFocus
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm disabled:opacity-50 flex items-center gap-1"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {sending ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg p-3">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    {result.mode === 'sent' && 'Email enviado!'}
                    {result.mode === 'dry_run' && 'Email salvo no outbox (modo dry-run)'}
                    {result.mode === 'failed' && 'Falhou — email salvo no outbox'}
                  </span>
                </div>

                <div className="text-sm space-y-2 bg-slate-50 p-3 rounded">
                  <div>
                    <span className="text-slate-500">Para:</span>{' '}
                    <span className="font-mono text-slate-900">{result.recipient}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ID da entrega:</span>{' '}
                    <span className="font-mono text-slate-900">#{result.deliveryId}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Link de verificação (audit trail público)</label>
                  <div className="flex gap-1">
                    <input
                      readOnly
                      value={result.verifyUrl}
                      className="flex-1 px-2 py-1.5 rounded border border-slate-200 text-xs font-mono bg-slate-50"
                    />
                    <button
                      onClick={copyLink}
                      className="px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Envie esse link por WhatsApp/IM se quiser que o destinatário confirme a leitura separadamente.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
