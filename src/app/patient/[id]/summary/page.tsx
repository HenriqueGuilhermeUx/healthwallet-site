import { supabase } from '@/lib/supabase'

export default async function PatientSummaryPage({
  params,
}: {
  params: { id: string }
}) {
  const patientId = params.id

  const [summaryRes, scoreRes, recordsRes, medsRes, timelineRes] =
    await Promise.all([
      supabase
        .from('health_summaries')
        .select('*')
        .eq('user_id', patientId)
        .maybeSingle(),

      supabase
        .from('health_scores')
        .select('*')
        .eq('user_id', patientId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('medical_records')
        .select('*')
        .eq('user_id', patientId)
        .limit(10),

      supabase
        .from('medications')
        .select('*')
        .eq('user_id', patientId),

      supabase
        .from('medical_events')
        .select('*')
        .eq('user_id', patientId)
        .order('event_date', { ascending: false })
        .limit(10),
    ])

  return (
    <main className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div>
        <p className="text-sm text-emerald-700 font-medium">
          MyDataMed
        </p>

        <h1 className="text-2xl font-bold">
          Patient Snapshot
        </h1>

        <p className="text-sm text-gray-500">
          Resumo compartilhado pelo paciente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Health Score" value={scoreRes.data?.score || '—'} />
        <Card title="Exames" value={recordsRes.data?.length || 0} />
        <Card title="Medicamentos" value={medsRes.data?.length || 0} />
      </div>

      <section className="bg-white rounded-xl border p-4">
        <h2 className="font-bold mb-2">Resumo IA</h2>
        <pre className="whitespace-pre-wrap text-sm text-gray-700">
          {summaryRes.data?.professional_summary ||
            summaryRes.data?.summary ||
            'Resumo ainda não disponível.'}
        </pre>
      </section>

      <section className="bg-white rounded-xl border p-4">
        <h2 className="font-bold mb-3">Últimos exames</h2>

        {recordsRes.data && recordsRes.data.length > 0 ? (
          recordsRes.data.map((record: any) => (
            <div key={record.id} className="border-b py-2">
              <p className="font-medium text-sm">
                {record.title || record.name || record.exam_name || 'Exame'}
              </p>
              <p className="text-xs text-gray-500">
                {record.created_at || record.exam_date || ''}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">
            Nenhum exame compartilhado.
          </p>
        )}
      </section>

      <section className="bg-white rounded-xl border p-4">
        <h2 className="font-bold mb-3">Medicamentos</h2>

        {medsRes.data && medsRes.data.length > 0 ? (
          medsRes.data.map((med: any) => (
            <div key={med.id} className="border-b py-2">
              <p className="font-medium text-sm">
                {med.name || med.medication_name || 'Medicamento'}
              </p>
              <p className="text-xs text-gray-500">
                {med.dosage || med.frequency || ''}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">
            Nenhum medicamento compartilhado.
          </p>
        )}
      </section>

      <section className="bg-white rounded-xl border p-4">
        <h2 className="font-bold mb-3">Timeline Clínica</h2>

        {timelineRes.data && timelineRes.data.length > 0 ? (
          timelineRes.data.map((event: any) => (
            <div
              key={event.id}
              className="border-l-4 border-emerald-500 pl-3 mb-3"
            >
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-gray-600">{event.description}</p>
              <p className="text-xs text-gray-400">{event.event_date}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">
            Nenhum evento clínico compartilhado.
          </p>
        )}
      </section>
    </main>
  )
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
