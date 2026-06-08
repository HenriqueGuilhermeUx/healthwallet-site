'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ExameTUSS, type PedidoExameItem, type Cid } from '@/lib/api';

type ItemDraft = {
  exame_id: number | null;
  exame_label: string;
  exame_codigo: string;
  exame_categoria: string | null;
  observacoes: string;
  ordem: number;
};

function ExamAutocomplete({
  value, onChange, placeholder,
}: {
  value: ItemDraft;
  onChange: (it: ItemDraft) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ExameTUSS[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const handle = setTimeout(() => {
      setLoading(true);
      api.searchExames(q)
        .then((r) => { setResults(r); setOpen(true); })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  if (value.exame_id) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sky-200 bg-sky-50">
        <FileText className="w-4 h-4 text-sky-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-sky-900">{value.exame_label}</div>
          <div className="text-xs text-sky-700">
            TUSS {value.exame_codigo}
            {value.exame_categoria ? ` • ${value.exame_categoria}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, exame_id: null, exame_label: '', exame_codigo: '', exame_categoria: null })}
          className="text-sky-700 hover:text-sky-900"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder || 'Buscar exame (mín. 2 letras)…'}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none text-sm"
        />
        {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...value,
                    exame_id: r.id,
                    exame_label: r.descricao,
                    exame_codigo: r.codigo_tuss,
                    exame_categoria: r.categoria,
                  });
                  setQ('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-sky-50 border-b border-slate-100 last:border-0"
              >
                <div className="text-sm font-medium text-slate-900">{r.descricao}</div>
                <div className="text-xs text-slate-500">
                  TUSS {r.codigo_tuss}
                  {r.categoria ? ` • ${r.categoria}` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CidAutocomplete({
  value, onChange,
}: {
  value: Cid | null;
  onChange: (c: Cid | null) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Cid[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const handle = setTimeout(() => {
      setLoading(true);
      api.searchCids(q)
        .then((r) => { setResults(r); setOpen(true); })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-emerald-900">
            {value.codigo} — {value.descricao}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-emerald-700 hover:text-emerald-900"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Buscar CID (ex: I10 hipertensão)…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm"
        />
        {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onChange(c); setQ(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 last:border-0"
              >
                <div className="text-sm font-medium text-slate-900">{c.codigo} — {c.descricao}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewExamInner() {
  const { professional, loading: authLoading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const presetPatient = search?.get('patientId') || null;

  const [patients, setPatients] = useState<Array<{ id: string; label: string }>>([]);
  const [pacienteId, setPacienteId] = useState<string>(presetPatient || '');
  const [cidPrincipal, setCidPrincipal] = useState<Cid | null>(null);
  const [textoClinico, setTextoClinico] = useState('');
  const [itens, setItens] = useState<ItemDraft[]>([{
    exame_id: null, exame_label: '', exame_codigo: '', exame_categoria: null,
    observacoes: '', ordem: 0,
  }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !professional) router.push('/login');
  }, [professional, authLoading, router]);

  // Carrega pacientes (reaproveitando lista via access_codes)
  useEffect(() => {
    if (!professional) return;
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('access_codes')
        .select('patient_id, permissions')
        .eq('professional_id', professional.id)
        .not('used_at', 'is', null);
      if (data) {
        // Deduplica por paciente_id
        const unique = new Map<string, { id: string; label: string }>();
        for (const ac of data) {
          if (!unique.has(ac.patient_id)) {
            unique.set(ac.patient_id, { id: ac.patient_id, label: ac.patient_id.slice(0, 8) });
          }
        }
        setPatients(Array.from(unique.values()));
      }
    })();
  }, [professional]);

  function addItem() {
    setItens([...itens, {
      exame_id: null, exame_label: '', exame_codigo: '', exame_categoria: null,
      observacoes: '', ordem: itens.length,
    }]);
  }
  function removeItem(idx: number) {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i })));
  }
  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItens(itens.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function submit() {
    if (!pacienteId) { toast.error('Selecione um paciente'); return; }
    if (itens.some((it) => !it.exame_id)) { toast.error('Selecione todos os exames'); return; }
    setSubmitting(true);
    try {
      const created = await api.createExamRequest({
        paciente_id: pacienteId,
        cid_principal_id: cidPrincipal?.id || null,
        texto_clinico: textoClinico || undefined,
        itens: itens.map((it) => ({ exame_id: it.exame_id!, observacoes: it.observacoes || undefined })),
      });
      toast.success('Pedido criado!');
      router.push(`/exam-requests/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-sky-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/exam-requests" className="text-slate-500 hover:text-slate-900 text-sm">← Pedidos</Link>
          <h1 className="font-semibold text-slate-900 flex-1">Novo Pedido de Exame</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Paciente */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Paciente</label>
          <select
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none text-sm"
            disabled={!!presetPatient}
          >
            <option value="">Selecione um paciente</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {presetPatient && (
            <p className="text-xs text-slate-500 mt-1">Paciente pré-selecionado pelo contexto</p>
          )}
        </div>

        {/* Indicação clínica */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Indicação clínica</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CID principal (opcional)</label>
              <CidAutocomplete value={cidPrincipal} onChange={setCidPrincipal} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Texto clínico (opcional)</label>
              <textarea
                value={textoClinico}
                onChange={(e) => setTextoClinico(e.target.value)}
                rows={3}
                placeholder="Ex: Paciente com queixa de cansaço aos esforços, investigar anemia e função tireoidiana"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-500 outline-none text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Exames */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Exames</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-sm text-sky-700 hover:text-sky-800 font-medium"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
          <div className="space-y-3">
            {itens.map((it, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30 relative">
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Exame</label>
                    <ExamAutocomplete value={it} onChange={(v) => updateItem(idx, v)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Observações (opcional)</label>
                    <input
                      type="text"
                      value={it.observacoes}
                      onChange={(e) => updateItem(idx, { observacoes: e.target.value })}
                      placeholder="Ex: em jejum, 12h antes"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/exam-requests"
            className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
          >
            Cancelar
          </Link>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm disabled:opacity-50 flex items-center gap-1"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Salvando…' : 'Criar pedido'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function NewExamRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
      </div>
    }>
      <NewExamInner />
    </Suspense>
  )
}
