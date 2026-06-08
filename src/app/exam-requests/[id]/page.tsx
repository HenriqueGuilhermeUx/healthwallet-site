'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2, FileText, Trash2, AlertCircle, Send } from 'lucide-react'
import { EmailDeliveryButton } from '@/components/EmailDeliveryButton';
import { useAuth } from '@/contexts/AuthContext';
import { api, type PedidoExame } from '@/lib/api';

export default function ExamRequestDetailPage() {
  const { professional, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);

  const [pedido, setPedido] = useState<PedidoExame | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !professional) router.push('/login');
  }, [professional, authLoading, router]);

  useEffect(() => {
    if (!id || !professional) return;
    api.getExamRequest(id)
      .then(setPedido)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [id, professional]);

  async function handleDelete() {
    if (!confirm('Excluir este pedido?')) return;
    setDeleting(true);
    try {
      await api.deleteExamRequest(id);
      router.push('/exam-requests');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
      setDeleting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-sky-600" /></div>;
  }

  if (err || !pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <p className="text-slate-700 mb-4">{err || 'Pedido não encontrado'}</p>
          <Link href="/exam-requests" className="text-sky-600 hover:underline">← Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/exam-requests" className="text-slate-500 hover:text-slate-900 text-sm">← Pedidos</Link>
          <h1 className="font-semibold text-slate-900 flex-1">
            Pedido de Exame #{pedido.id}
          </h1>
          <a
            href={api.examRequestPdfUrl(pedido.id)}
            target="_blank"
            rel="noopener"
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1"
            title="Baixar PDF"
          >
            <Download className="w-4 h-4" />
          </a>
          <EmailDeliveryButton
            documentType="exame"
            documentId={pedido.id}
            defaultEmail={null}
            label=""
          />
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
            <StatusBadge status={pedido.status} />
          </div>
          <p className="text-sm text-slate-600">
            Emitido em {new Date(pedido.data_emissao).toLocaleString('pt-BR')}
          </p>
          {pedido.cid_principal && (
            <p className="text-sm text-slate-700 mt-2">
              <strong>CID:</strong> {pedido.cid_principal.codigo} — {pedido.cid_principal.descricao}
            </p>
          )}
        </div>

        {pedido.texto_clinico && (
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Indicação clínica</h3>
            <p className="text-sm text-slate-700 whitespace-pre-line">{pedido.texto_clinico}</p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Exames solicitados ({pedido.pedido_exame_itens?.length || 0})
          </h3>
          <ul className="divide-y divide-slate-100">
            {pedido.pedido_exame_itens?.map((it, i) => (
              <li key={it.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-semibold text-slate-400 w-6">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {it.exame?.descricao || 'Exame'}
                    </p>
                    <p className="text-xs text-slate-500">
                      TUSS {it.exame?.codigo_tuss}
                      {it.exame?.categoria ? ` • ${it.exame.categoria}` : ''}
                    </p>
                    {it.observacoes && (
                      <p className="text-xs text-slate-600 mt-1 italic">Obs: {it.observacoes}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center text-xs text-slate-500 italic">
          Pedido gerado eletronicamente pelo HealthWallet Pro.
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    rascunho:            { bg: 'bg-slate-100',  text: 'text-slate-700',  label: 'Rascunho' },
    aguardando_assinatura: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Aguardando assinatura' },
    assinado:            { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Assinado' },
    enviado_paciente:    { bg: 'bg-sky-100',    text: 'text-sky-800',    label: 'Enviado ao paciente' },
  };
  const s = map[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
  return <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${s.bg} ${s.text}`}>{s.label}</span>;
}
