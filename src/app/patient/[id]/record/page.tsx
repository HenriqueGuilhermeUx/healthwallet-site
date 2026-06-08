'use client';

/**
 * /patient/[id]/record
 *
 * Prontuário Eletrônico.
 * - [id] = access_code.id (mesmo padrão do /patient/[id])
 * - Sidebar: contexto clínico do paciente (alergias, condições, medicações, exames)
 * - Main: tabs Visão Geral | Histórico de Consultas | Nova Consulta | Nova Receita
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { api, type Consultation, type PatientCondition, type MedicationUse } from '@/lib/api';

type PatientInfo = {
  id: string;
  birth_date: string | null;
  gender: string | null;
  blood_type: string | null;
  phone: string | null;
};

type Alergia = {
  id: number;
  nome: string;
  tipo: string;
  gravidade: string;
};

type ExameRecente = {
  id: number;
  nome: string;
  valor: string | null;
  unidade: string | null;
  data_exame: string;
  flag: string | null;
};

type Tab = 'overview' | 'history' | 'new' | 'prescriptions';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'overview',    label: 'Visão Geral',           icon: '👤' },
  { key: 'history',     label: 'Histórico de Consultas', icon: '📋' },
  { key: 'new',         label: 'Nova Consulta',         icon: '✏️' },
  { key: 'prescriptions', label: 'Receitas',            icon: '📄' },
];

function calcAge(birth: string | null): string {
  if (!birth) return '—';
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return `${age} anos`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function ProntuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: accessCodeId } = use(params);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('overview');
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [accessCode, setAccessCode] = useState<{ id: string; patient_id: string } | null>(null);
  const [alergias, setAlergias] = useState<Alergia[]>([]);
  const [conditions, setConditions] = useState<PatientCondition[]>([]);
  const [meds, setMeds] = useState<MedicationUse[]>([]);
  const [exames, setExames] = useState<ExameRecente[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll(pacienteId: string) {
    setLoading(true);
    setError(null);
    try {
      const [cond, ms, cs] = await Promise.all([
        api.listPatientConditions(pacienteId),
        api.listMedicationUses(pacienteId),
        api.listConsultations(pacienteId),
      ]);
      setConditions(cond);
      setMeds(ms);
      setConsultations(cs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  // Carrega access_code + patient info via supabase client
  useEffect(() => {
    (async () => {
      try {
        const { data: access, error: accessErr } = await supabase
          .from('access_codes')
          .select('id, patient_id, permissions, expires_at, used_at')
          .eq('id', accessCodeId)
          .single();
        if (accessErr || !access) throw new Error('Acesso não encontrado');
        if (access.expires_at && new Date(access.expires_at) < new Date()) {
          throw new Error('Este acesso expirou');
        }
        setAccessCode({ id: access.id, patient_id: access.patient_id });

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, birth_date, gender, blood_type, phone')
          .eq('id', access.patient_id)
          .single();
        if (profErr) throw new Error('Não foi possível carregar o perfil do paciente');
        setPatient(profile as PatientInfo);

        await loadAll(access.patient_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCodeId]);

  if (loading && !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Carregando prontuário…</div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="text-rose-600 mb-4">{error}</div>
          <Link href="/dashboard" className="text-sky-600 hover:underline">← Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push(`/patient/${accessCodeId}`)}
            className="text-slate-500 hover:text-slate-900 text-sm"
          >
            ← Voltar ao paciente
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-slate-900">
              Prontuário · Paciente
            </h1>
            <p className="text-xs text-slate-500">
              {calcAge(patient?.birth_date)} · {patient?.gender || '—'} · {patient?.blood_type ? `Tipo sanguíneo: ${patient.blood_type}` : ''}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                tab === t.key
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar — contexto clínico */}
        <ClinicalContextSidebar
          patient={patient}
          alergias={alergias}
          conditions={conditions}
          meds={meds}
          exames={exames}
          onAddCondition={() => {/* TODO: modal */}}
          onAddMed={() => {/* TODO: modal */}}
          onDeleteCondition={async (id) => {
            try {
              await api.deletePatientCondition(id);
              setConditions(conditions.filter((c) => c.id !== id));
            } catch (e) { alert(e instanceof Error ? e.message : 'Erro'); }
          }}
          onDeleteMed={async (id) => {
            try {
              await api.deleteMedicationUse(id);
              setMeds(meds.filter((m) => m.id !== id));
            } catch (e) { alert(e instanceof Error ? e.message : 'Erro'); }
          }}
        />

        {/* Main */}
        <main>
          {tab === 'overview' && (
            <OverviewTab
              conditions={conditions}
              meds={meds}
              consultations={consultations}
            />
          )}
          {tab === 'history' && (
            <HistoryTab
              consultations={consultations}
              onDelete={async (id) => {
                if (!confirm('Excluir esta consulta?')) return;
                try {
                  await api.deleteConsultation(id);
                  setConsultations(consultations.filter((c) => c.id !== id));
                } catch (e) { alert(e instanceof Error ? e.message : 'Erro'); }
              }}
            />
          )}
          {tab === 'new' && patient && (
            <NewConsultationTab
              pacienteId={patient.id}
              onCreated={(c) => {
                setConsultations([c, ...consultations]);
                setTab('history');
              }}
            />
          )}
          {tab === 'prescriptions' && patient && (
            <PrescriptionsTab
              accessCodeId={accessCodeId}
              pacienteId={patient.id}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* ============================================================ */
/* =============== COMPONENTES AUXILIARES ===================== */
/* ============================================================ */

function ClinicalContextSidebar({
  patient, alergias, conditions, meds, exames,
  onAddCondition, onAddMed, onDeleteCondition, onDeleteMed,
}: {
  patient: PatientInfo | null;
  alergias: Alergia[];
  conditions: PatientCondition[];
  meds: MedicationUse[];
  exames: ExameRecente[];
  onAddCondition: () => void;
  onAddMed: () => void;
  onDeleteCondition: (id: number) => void;
  onDeleteMed: (id: number) => void;
}) {
  return (
    <aside className="space-y-4">
      {/* Alergias — alerta vermelho */}
      <SidebarCard
        title="Alergias"
        color="red"
        empty="Nenhuma alergia registrada"
        items={alergias.map((a) => ({
          id: a.id,
          label: a.nome,
          sub: a.gravidade || undefined,
        }))}
      />

      {/* Condições */}
      <SidebarCard
        title="Condições / Comorbidades"
        color="amber"
        empty="Nenhuma condição registrada"
        onAdd={onAddCondition}
        items={conditions.map((c) => ({
          id: c.id,
          label: c.cid ? `${c.cid.codigo} — ${c.cid.descricao}` : c.descricao_livre || '—',
          sub: c.data_inicio ? `desde ${fmtDate(c.data_inicio)}` : undefined,
          onRemove: () => onDeleteCondition(c.id),
        }))}
      />

      {/* Medicações em uso */}
      <SidebarCard
        title="Medicações em uso"
        color="sky"
        empty="Nenhuma medicação em uso"
        onAdd={onAddMed}
        items={meds.map((m) => ({
          id: m.id,
          label: m.medicamento?.nome_comercial || m.medicamento_label || '—',
          sub: [m.dose, m.frequencia, m.via].filter(Boolean).join(' · ') || undefined,
          onRemove: () => onDeleteMed(m.id),
        }))}
      />

      {/* Exames recentes — placeholder */}
      <SidebarCard
        title="Exames recentes"
        color="slate"
        empty="Sem exames registrados no portal"
        items={exames.map((e) => ({
          id: e.id,
          label: e.nome,
          sub: [e.valor, e.unidade].filter(Boolean).join(' ') + (e.data_exame ? ` · ${fmtDate(e.data_exame)}` : ''),
        }))}
      />
    </aside>
  );
}

function SidebarCard({
  title, color, empty, items, onAdd,
}: {
  title: string;
  color: 'red' | 'amber' | 'sky' | 'slate';
  empty: string;
  items: Array<{ id: number; label: string; sub?: string; onRemove?: () => void }>;
  onAdd?: () => void;
}) {
  const colorMap = {
    red:   { bg: 'bg-rose-50',  border: 'border-rose-200',  title: 'text-rose-700',  badge: 'bg-rose-100 text-rose-800' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    sky:   { bg: 'bg-sky-50',   border: 'border-sky-200',   title: 'text-sky-700',   badge: 'bg-sky-100 text-sky-800' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', title: 'text-slate-700', badge: 'bg-slate-100 text-slate-800' },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-sm font-semibold ${c.title}`}>{title}</h3>
        {onAdd && (
          <button
            onClick={onAdd}
            className="text-xs px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-50"
            title="Adicionar"
          >
            + Adicionar
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className={`text-xs ${c.badge} rounded px-2 py-1 flex items-start justify-between gap-2`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium break-words">{it.label}</div>
                {it.sub && <div className="opacity-75 text-[10px]">{it.sub}</div>}
              </div>
              {it.onRemove && (
                <button
                  onClick={it.onRemove}
                  className="opacity-50 hover:opacity-100 text-[10px]"
                  title="Remover"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------ Visão Geral ------------------ */
function OverviewTab({
  conditions, meds, consultations,
}: {
  conditions: PatientCondition[];
  meds: MedicationUse[];
  consultations: Consultation[];
}) {
  const last = consultations[0];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Consultas registradas" value={consultations.length} icon="📋" />
        <StatCard label="Condições ativas" value={conditions.filter((c) => c.ativa).length} icon="⚠️" />
        <StatCard label="Medicações em uso" value={meds.filter((m) => m.ativo).length} icon="💊" />
      </div>

      {last && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-2">Última consulta</h3>
          <p className="text-sm text-slate-500 mb-2">{fmtDateTime(last.data_consulta)}</p>
          {last.hipotese_diagnostica && (
            <p className="text-sm"><strong>Hipótese:</strong> {last.hipotese_diagnostica}</p>
          )}
          {last.cid_principal && (
            <p className="text-sm"><strong>CID:</strong> {last.cid_principal.codigo} — {last.cid_principal.descricao}</p>
          )}
          {last.conduta && (
            <p className="text-sm mt-2 whitespace-pre-line">{last.conduta}</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

/* ------------------ Histórico ------------------ */
function HistoryTab({
  consultations, onDelete,
}: {
  consultations: Consultation[];
  onDelete: (id: number) => void;
}) {
  if (consultations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-500">Nenhuma consulta registrada para este paciente.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {consultations.map((c) => (
        <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold text-slate-900">{fmtDateTime(c.data_consulta)}</p>
              <p className="text-xs text-slate-500">
                {c.status === 'em_andamento' ? '✏️ Rascunho' : '✅ Finalizada'}
              </p>
            </div>
            <button
              onClick={() => onDelete(c.id)}
              className="text-xs text-rose-600 hover:underline"
            >
              Excluir
            </button>
          </div>

          {c.hipotese_diagnostica && (
            <p className="text-sm mb-1"><strong>Hipótese:</strong> {c.hipotese_diagnostica}</p>
          )}
          {c.cid_principal && (
            <p className="text-sm mb-1">
              <strong>CID:</strong> {c.cid_principal.codigo} — {c.cid_principal.descricao}
            </p>
          )}
          {c.exame_fisico && (
            <details className="mt-2">
              <summary className="text-xs text-sky-600 cursor-pointer">Exame físico</summary>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{c.exame_fisico}</p>
            </details>
          )}
          {c.conduta && (
            <details className="mt-2">
              <summary className="text-xs text-sky-600 cursor-pointer">Conduta</summary>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{c.conduta}</p>
            </details>
          )}
          {c.notas && (
            <details className="mt-2">
              <summary className="text-xs text-sky-600 cursor-pointer">Notas</summary>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{c.notas}</p>
            </details>
          )}
          {c.anamnese && Object.keys(c.anamnese).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-sky-600 cursor-pointer">Anamnese</summary>
              <dl className="text-sm text-slate-700 mt-1 space-y-1">
                {Object.entries(c.anamnese).map(([k, v]) => v ? (
                  <div key={k}>
                    <dt className="font-medium capitalize">{k.replace(/_/g, ' ')}</dt>
                    <dd className="whitespace-pre-line ml-2">{v}</dd>
                  </div>
                ) : null)}
              </dl>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------ Nova Consulta ------------------ */
function NewConsultationTab({
  pacienteId, onCreated,
}: {
  pacienteId: string;
  onCreated: (c: Consultation) => void;
}) {
  const [anamnese, setAnamnese] = useState({
    queixa_principal: '',
    hda: '',
    antecedentes_pessoais: '',
    antecedentes_familiares: '',
    habitos: '',
    alergias_relevantes: '',
  });
  const [exameFisico, setExameFisico] = useState('');
  const [hipotese, setHipotese] = useState('');
  const [conduta, setConduta] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(asDraft: boolean) {
    setSubmitting(true);
    setErr(null);
    try {
      const created = await api.createConsultation({
        paciente_id: pacienteId,
        anamnese,
        exame_fisico: exameFisico || undefined,
        hipotese_diagnostica: hipotese || undefined,
        conduta: conduta || undefined,
        notas: notas || undefined,
        status: asDraft ? 'em_andamento' : 'realizada',
      });
      onCreated(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none";

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="font-semibold text-slate-900">Nova Consulta</h2>

      <Section title="Anamnese">
        <Field label="Queixa principal">
          <textarea
            className={inputCls} rows={2}
            value={anamnese.queixa_principal}
            onChange={(e) => setAnamnese({ ...anamnese, queixa_principal: e.target.value })}
          />
        </Field>
        <Field label="História da Doença Atual (HDA)">
          <textarea
            className={inputCls} rows={4}
            value={anamnese.hda}
            onChange={(e) => setAnamnese({ ...anamnese, hda: e.target.value })}
          />
        </Field>
        <Field label="Antecedentes pessoais">
          <textarea
            className={inputCls} rows={2}
            value={anamnese.antecedentes_pessoais}
            onChange={(e) => setAnamnese({ ...anamnese, antecedentes_pessoais: e.target.value })}
          />
        </Field>
        <Field label="Antecedentes familiares">
          <textarea
            className={inputCls} rows={2}
            value={anamnese.antecedentes_familiares}
            onChange={(e) => setAnamnese({ ...anamnese, antecedentes_familiares: e.target.value })}
          />
        </Field>
        <Field label="Hábitos (tabagismo, etilismo, atividade física)">
          <textarea
            className={inputCls} rows={2}
            value={anamnese.habitos}
            onChange={(e) => setAnamnese({ ...anamnese, habitos: e.target.value })}
          />
        </Field>
        <Field label="Alergias relevantes">
          <textarea
            className={inputCls} rows={2}
            value={anamnese.alergias_relevantes}
            onChange={(e) => setAnamnese({ ...anamnese, alergias_relevantes: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Exame Físico">
        <textarea
          className={inputCls} rows={4}
          value={exameFisico}
          onChange={(e) => setExameFisico(e.target.value)}
          placeholder="Sinais vitais, inspeção, palpação, ausculta…"
        />
      </Section>

      <Section title="Hipótese Diagnóstica">
        <textarea
          className={inputCls} rows={3}
          value={hipotese}
          onChange={(e) => setHipotese(e.target.value)}
          placeholder="Ex: Hipertensão arterial essencial"
        />
      </Section>

      <Section title="Conduta">
        <textarea
          className={inputCls} rows={4}
          value={conduta}
          onChange={(e) => setConduta(e.target.value)}
          placeholder="Medicação, exames solicitados, retorno…"
        />
      </Section>

      <Section title="Notas adicionais (opcional)">
        <textarea
          className={inputCls} rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Section>

      {err && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{err}</div>}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => submit(true)}
          disabled={submitting}
          className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm disabled:opacity-50"
        >
          {submitting ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm disabled:opacity-50"
        >
          {submitting ? 'Salvando…' : 'Finalizar consulta'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-600 block mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ------------------ Receitas ------------------ */
function PrescriptionsTab({ accessCodeId, pacienteId }: { accessCodeId: string; pacienteId: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
      <p className="text-slate-500 mb-4">
        Crie uma nova receita digital para este paciente ou veja o histórico.
      </p>
      <div className="flex justify-center gap-3">
        <Link
          href={`/prescriptions/new?patient=${pacienteId}`}
          className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm"
        >
          + Nova Receita
        </Link>
        <Link
          href="/prescriptions"
          className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
        >
          Ver todas
        </Link>
      </div>
    </div>
  );
}
