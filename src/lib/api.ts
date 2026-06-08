/**
 * API client (browser) — wrappers tipados pros endpoints do médico
 */

export type Medicamento = {
  id: number;
  registro_ms: string;
  nome_comercial: string;
  concentracao: string | null;
  principio_ativo: string | null;
  dcb: string | null;
  laboratorio: string | null;
  forma_farmaceutica: string | null;
  tarja: string | null;
  tipo_receita: string | null;
  regime_controlado: boolean;
};

export type Cid = {
  id: number;
  codigo: string;
  descricao: string;
  versao: string;
};

export type ReceitaItem = {
  id?: number;
  medicamento_id: number | null;
  medicamento_label: string;       // exibido se medicamento_id for null
  posologia: string;
  quantidade: number | null;
  duracao_dias: number | null;
  via_administracao: string | null;
  observacoes: string | null;
  ordem: number;
};

export type Receita = {
  id: number;
  medico_id: string;
  paciente_id: string;
  paciente_nome?: string;
  paciente_cpf?: string;
  tipo: string;
  cid_principal_id: number | null;
  cid_principal?: { id: number; codigo: string; descricao: string } | null;
  cid_secundario_id: number | null;
  data_emissao: string;
  texto_cabecalho: string | null;
  texto_rodape: string | null;
  status: string;
  clicksign_document_key: string | null;
  clicksign_sign_url: string | null;
  pdf_assinado_url: string | null;
  pdf_final_path: string | null;
  assinado_em: string | null;
  enviado_paciente_em: string | null;
  created_at: string;
  updated_at: string;
  receita_itens?: ReceitaItem[];
  itens?: ReceitaItem[];
};

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error || text;
    } catch { /* noop */ }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  searchMedications: (q: string, limit = 20): Promise<Medicamento[]> => {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return http<Medicamento[]>(`/api/medications/search?${qs}`);
  },
  searchCids: (q: string, limit = 20): Promise<Cid[]> => {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return http<Cid[]>(`/api/cids/search?${qs}`);
  },
  listPrescriptions: (status?: string): Promise<Receita[]> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return http<Receita[]>(`/api/prescriptions${qs}`);
  },
  getPrescription: (id: number): Promise<Receita> =>
    http<Receita>(`/api/prescriptions/${id}`),
  createPrescription: (data: {
    paciente_id: string;
    tipo: string;
    cid_principal_id?: number | null;
    cid_secundario_id?: number | null;
    texto_cabecalho?: string | null;
    texto_rodape?: string | null;
    itens: Array<Omit<ReceitaItem, 'id'>>;
  }): Promise<Receita> =>
    http<Receita>('/api/prescriptions', { method: 'POST', body: JSON.stringify(data) }),
  updatePrescription: (id: number, data: Partial<{
    tipo: string;
    cid_principal_id: number | null;
    cid_secundario_id: number | null;
    texto_cabecalho: string | null;
    texto_rodape: string | null;
    itens: Array<Omit<ReceitaItem, 'id'>>;
  }>): Promise<Receita> =>
    http<Receita>(`/api/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrescription: (id: number): Promise<{ ok: true }> =>
    http<{ ok: true }>(`/api/prescriptions/${id}`, { method: 'DELETE' }),
  sendPrescription: (id: number): Promise<{
    ok: true;
    receitaId: number;
    status: string;
    signUrl: string;
    documentKey: string;
    signerKey: string;
  }> =>
    http(`/api/prescriptions/${id}/send`, { method: 'POST' }),
  validateCrm: (): Promise<{
    ok: boolean;
    active?: boolean;
    situation?: string | null;
    fullName?: string | null;
    specialty?: string | null;
    verifiedAt?: string | null;
    nextCheckAt?: string | null;
    error?: string;
  }> =>
    http('/api/crm/validate', { method: 'POST', body: JSON.stringify({}) }),
};

// ===== Prontuário Eletrônico =====

export type Consultation = {
  id: number;
  medico_id: string;
  paciente_id: string;
  data_consulta: string;
  anamnese: Record<string, string>;
  exame_fisico: string | null;
  hipotese_diagnostica: string | null;
  cid_principal_id: number | null;
  cid_principal?: { id: number; codigo: string; descricao: string } | null;
  cid_secundario_id: number | null;
  conduta: string | null;
  notas: string | null;
  status: 'em_andamento' | 'realizada';
  created_at: string;
  updated_at: string;
};

export type PatientCondition = {
  id: number;
  paciente_id: string;
  cid_id: number | null;
  descricao_livre: string | null;
  data_inicio: string | null;
  notas: string | null;
  ativa: boolean;
  created_at: string;
  cid?: { id: number; codigo: string; descricao: string } | null;
};

export type MedicationUse = {
  id: number;
  paciente_id: string;
  medicamento_id: number | null;
  medicamento_label: string | null;
  dose: string | null;
  frequencia: string | null;
  via: string | null;
  posologia_completa: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
  medicamento?: { id: number; nome_comercial: string; concentracao: string | null; tarja: string | null } | null;
};

// Re-atribui adicionando os métodos de prontuário ao objeto `api`.
// (Feito por patching para preservar o objeto original `export const api = { ... }`.)
Object.assign(api, {
  listConsultations: (pacienteId?: string): Promise<Consultation[]> => {
    const qs = pacienteId ? `?paciente_id=${encodeURIComponent(pacienteId)}` : '';
    return http<Consultation[]>(`/api/consultations${qs}`);
  },
  getConsultation: (id: number): Promise<Consultation> =>
    http<Consultation>(`/api/consultations/${id}`),
  createConsultation: (data: {
    paciente_id: string;
    data_consulta?: string;
    anamnese?: Record<string, string>;
    exame_fisico?: string;
    hipotese_diagnostica?: string;
    cid_principal_id?: number | null;
    cid_secundario_id?: number | null;
    conduta?: string;
    notas?: string;
    status?: 'em_andamento' | 'realizada';
  }): Promise<Consultation> =>
    http<Consultation>('/api/consultations', { method: 'POST', body: JSON.stringify(data) }),
  updateConsultation: (id: number, data: Partial<{
    anamnese: Record<string, string>;
    exame_fisico: string;
    hipotese_diagnostica: string;
    cid_principal_id: number | null;
    cid_secundario_id: number | null;
    conduta: string;
    notas: string;
    status: 'em_andamento' | 'realizada';
  }>): Promise<Consultation> =>
    http<Consultation>(`/api/consultations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteConsultation: (id: number): Promise<{ ok: true }> =>
    http<{ ok: true }>(`/api/consultations/${id}`, { method: 'DELETE' }),

  listPatientConditions: (pacienteId: string): Promise<PatientCondition[]> =>
    http<PatientCondition[]>(`/api/patient-conditions?paciente_id=${encodeURIComponent(pacienteId)}`),
  createPatientCondition: (data: {
    paciente_id: string;
    cid_id?: number | null;
    descricao_livre?: string;
    data_inicio?: string;
    notas?: string;
  }): Promise<PatientCondition> =>
    http<PatientCondition>('/api/patient-conditions', { method: 'POST', body: JSON.stringify(data) }),
  deletePatientCondition: (id: number): Promise<{ ok: true }> =>
    http<{ ok: true }>(`/api/patient-conditions?id=${id}`, { method: 'DELETE' }),

  listMedicationUses: (pacienteId: string): Promise<MedicationUse[]> =>
    http<MedicationUse[]>(`/api/medication-uses?paciente_id=${encodeURIComponent(pacienteId)}`),
  createMedicationUse: (data: {
    paciente_id: string;
    medicamento_id?: number | null;
    medicamento_label?: string;
    dose?: string;
    frequencia?: string;
    via?: string;
    posologia_completa?: string;
    data_inicio?: string;
  }): Promise<MedicationUse> =>
    http<MedicationUse>('/api/medication-uses', { method: 'POST', body: JSON.stringify(data) }),
  deleteMedicationUse: (id: number): Promise<{ ok: true }> =>
    http<{ ok: true }>(`/api/medication-uses?id=${id}`, { method: 'DELETE' }),
});
