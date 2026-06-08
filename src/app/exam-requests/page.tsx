'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileSearch, Plus, Loader2, FileText, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, type PedidoExame } from '@/lib/api';

export default function ExamRequestsListPage() {
  const { professional, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PedidoExame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !professional) router.push('/login');
  }, [professional, authLoading, router]);

  useEffect(() => {
    if (!professional) return;
    api.listExamRequests()
      .then(setItems)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [professional]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-sky-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 text-sm">← Dashboard</Link>
          <h1 className="font-semibold text-slate-900 flex-1">Pedidos de Exame</h1>
          <Link
            href="/exam-requests/new"
            className="px-3 py-1.5 rounded bg-sky-600 text-white text-sm hover:bg-sky-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Novo pedido
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded p-3 text-sm mb-4">{err}</div>}

        {items.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <FileSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">Nenhum pedido de exame ainda.</p>
            <Link
              href="/exam-requests/new"
              className="inline-block px-4 py-2 rounded bg-sky-600 text-white text-sm hover:bg-sky-700"
            >
              Criar primeiro pedido
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/exam-requests/${p.id}`}
                className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-sky-300 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span className="font-medium text-slate-900">
                        Pedido #{p.id}
                        {p.cid_principal && (
                          <span className="ml-2 text-xs text-slate-500">
                            CID {p.cid_principal.codigo}
                          </span>
                        )}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.data_emissao).toLocaleString('pt-BR')}
                    </p>
                    {p.pedido_exame_itens && p.pedido_exame_itens.length > 0 && (
                      <p className="text-sm text-slate-600 mt-1">
                        {p.pedido_exame_itens.length} exame{p.pedido_exame_itens.length > 1 ? 's' : ''}
                        {p.pedido_exame_itens[0]?.exame?.descricao && (
                          <span className="text-slate-400"> • {p.pedido_exame_itens[0].exame.descricao}{p.pedido_exame_itens.length > 1 ? '…' : ''}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
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
