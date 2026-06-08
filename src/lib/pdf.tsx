/**
 * Gerador de PDF de Receita Médica
 * Usa @react-pdf/renderer — funciona no Node runtime (não Edge).
 *
 * O PDF é gerado server-side, convertido para base64 e enviado para a Clicksign.
 * O layout segue o padrão exigido por farmácias brasileiras:
 *   - cabeçalho com identificação do profissional
 *   - corpo com identificação do paciente + lista de medicamentos
 *   - rodapé com área reservada para o carimbo/assinatura visual da ICP-Brasil
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

const COLORS = {
  primary: '#059669',
  text: '#111827',
  muted: '#6b7280',
  border: '#d1d5db',
  warn: '#b91c1c',
  light: '#f9fafb',
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: COLORS.text,
    lineHeight: 1.4,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerName: { fontSize: 14, fontWeight: 700, color: COLORS.primary },
  headerSub: { fontSize: 9, color: COLORS.muted, marginTop: 2 },
  title: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 80, color: COLORS.muted, fontSize: 9 },
  value: { flex: 1, fontSize: 10 },
  receitaNumero: {
    textAlign: 'right',
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 6,
  },
  cidBox: {
    backgroundColor: COLORS.light,
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  cidText: { fontSize: 9 },
  medsBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },
  medItem: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  medName: { fontSize: 10, fontWeight: 700, color: COLORS.text },
  medMeta: { fontSize: 8, color: COLORS.muted, marginTop: 1 },
  medPosologia: { fontSize: 9, marginTop: 3, color: COLORS.text, lineHeight: 1.5 },
  medObs: { fontSize: 8, fontStyle: 'italic', color: COLORS.muted, marginTop: 2 },
  controlledBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
    padding: 6,
    borderRadius: 3,
    marginBottom: 10,
    textAlign: 'center',
  },
  controlledText: { fontSize: 9, fontWeight: 700, color: COLORS.warn },
  signatureArea: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  signatureLine: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: COLORS.text,
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 8,
    color: COLORS.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
});

type Profissional = {
  full_name: string;
  professional_type?: string;
  professional_register: string;
  register_state: string;
  specialty: string | null;
  crm_verified_data?: { fullName?: string } | null;
};

type Paciente = {
  full_name: string;
  cpf?: string | null;
  birth_date?: string | null;
};

type Medicamento = {
  nome_comercial: string;
  principio_ativo?: string | null;
  concentracao?: string | null;
  forma_farmaceutica?: string | null;
  laboratorio?: string | null;
  tarja?: string | null;
  registro_ms?: string | null;
};

type ItemReceita = {
  posologia: string;
  quantidade?: number | null;
  duracao_dias?: number | null;
  via_administracao?: string | null;
  observacoes?: string | null;
  medicamento: Medicamento;
};

type ReceitaForPdf = {
  id: number;
  tipo: string;
  data_emissao: string;
  texto_cabecalho?: string | null;
  texto_rodape?: string | null;
  cid_principal?: { codigo: string; descricao: string } | null;
  profissional: Profissional;
  paciente: Paciente;
  itens: ItemReceita[];
};

const TIPO_LABEL: Record<string, string> = {
  simples: 'Receita Médica',
  controle_especial_branca: 'Receita de Controle Especial (Notificação de Receita B - 2 vias)',
  azul_b1b2: 'Notificação de Receita B (Psicotrópicos) - 2 vias',
  amarela_a1a2: 'Notificação de Receita A (Entorpecentes) - 2 vias',
};

const TIPO_BANNER: Record<string, string | null> = {
  simples: null,
  controle_especial_branca: '⚠️ RECEITA DE CONTROLE ESPECIAL — VÁLIDA EM TODO O TERRITÓRIO NACIONAL',
  azul_b1b2: '⚠️ NOTIFICAÇÃO DE RECEITA B — VÁLIDA POR 30 DIAS — 2 VIAS',
  amarela_a1a2: '⚠️ NOTIFICAÇÃO DE RECEITA A — VÁLIDA POR 30 DIAS — 2 VIAS',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCpf(cpf?: string | null): string {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function ReceitaDocument({ receita }: { receita: ReceitaForPdf }) {
  const prof = receita.profissional;
  const pac = receita.paciente;
  const cid = receita.cid_principal;
  const tipoLabel = TIPO_LABEL[receita.tipo] || 'Receita Médica';
  const banner = TIPO_BANNER[receita.tipo];

  return (
    <Page size="A4" style={styles.page}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerName}>{prof.full_name}</Text>
        <Text style={styles.headerSub}>
          {prof.specialty ? `${prof.specialty} • ` : ''}
          {prof.professional_type === 'medico' ? 'Médico' : 'Profissional de Saúde'} •
          {' '}CRM/{prof.register_state} {prof.professional_register}
        </Text>
        <Text style={styles.headerSub}>
          HealthWallet Pro • Plataforma de Prescrição Digital
        </Text>
      </View>

      {/* Título + número */}
      <Text style={styles.title}>{tipoLabel}</Text>
      <Text style={styles.receitaNumero}>Receita Nº {String(receita.id).padStart(6, '0')} • Emitida em {formatDate(receita.data_emissao)}</Text>

      {/* Banner de receita controlada */}
      {banner && (
        <View style={styles.controlledBanner}>
          <Text style={styles.controlledText}>{banner}</Text>
        </View>
      )}

      {/* Paciente */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paciente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nome:</Text>
          <Text style={styles.value}>{pac.full_name}</Text>
        </View>
        {pac.cpf && (
          <View style={styles.row}>
            <Text style={styles.label}>CPF:</Text>
            <Text style={styles.value}>{formatCpf(pac.cpf)}</Text>
          </View>
        )}
        {pac.birth_date && (
          <View style={styles.row}>
            <Text style={styles.label}>Nascimento:</Text>
            <Text style={styles.value}>{new Date(pac.birth_date).toLocaleDateString('pt-BR')}</Text>
          </View>
        )}
      </View>

      {/* CID */}
      {cid && (
        <View style={styles.cidBox}>
          <Text style={styles.sectionTitle}>Hipótese Diagnóstica (CID)</Text>
          <Text style={styles.cidText}>
            <Text style={{ fontWeight: 700 }}>{cid.codigo}</Text> — {cid.descricao}
          </Text>
        </View>
      )}

      {/* Texto cabeçalho livre */}
      {receita.texto_cabecalho && (
        <View style={styles.section}>
          <Text style={styles.value}>{receita.texto_cabecalho}</Text>
        </View>
      )}

      {/* Medicamentos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prescrição Médica</Text>
        <View style={styles.medsBox}>
          {receita.itens.map((item, idx) => {
            const m = item.medicamento;
            const parts: string[] = [];
            if (m.nome_comercial) parts.push(m.nome_comercial);
            if (m.concentracao) parts.push(m.concentracao);
            const headline = parts.join(' ');
            return (
              <View key={idx} style={styles.medItem} wrap={false}>
                <Text style={styles.medName}>
                  {idx + 1}. {headline || 'Medicamento'}
                </Text>
                {(m.principio_ativo || m.laboratorio || m.forma_farmaceutica) && (
                  <Text style={styles.medMeta}>
                    {m.principio_ativo ? `Princípio ativo: ${m.principio_ativo}` : ''}
                    {m.forma_farmaceutica ? ` • ${m.forma_farmaceutica}` : ''}
                    {m.laboratorio ? ` • ${m.laboratorio}` : ''}
                    {m.registro_ms ? ` • MS: ${m.registro_ms}` : ''}
                  </Text>
                )}
                <Text style={styles.medPosologia}>
                  <Text style={{ fontWeight: 700 }}>Posologia: </Text>
                  {item.posologia}
                </Text>
                {(item.quantidade || item.duracao_dias || item.via_administracao) && (
                  <Text style={styles.medMeta}>
                    {item.quantidade ? `Qtd: ${item.quantidade}` : ''}
                    {item.duracao_dias ? ` • Duração: ${item.duracao_dias} dias` : ''}
                    {item.via_administracao ? ` • Via: ${item.via_administracao}` : ''}
                  </Text>
                )}
                {item.observacoes && <Text style={styles.medObs}>Obs: {item.observacoes}</Text>}
              </View>
            );
          })}
        </View>
      </View>

      {/* Texto rodapé livre */}
      {receita.texto_rodape && (
        <View style={styles.section}>
          <Text style={styles.value}>{receita.texto_rodape}</Text>
        </View>
      )}

      {/* Área de assinatura (carimbo visual da ICP-Brasil vai aqui) */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureLine}>
          <Text>{prof.full_name}</Text>
          <Text>CRM/{prof.register_state} {prof.professional_register}</Text>
          <Text>Assinado digitalmente via ICP-Brasil (Clicksign)</Text>
        </View>
      </View>

      <Text style={styles.footer} fixed>
        Documento gerado eletronicamente em {formatDate(new Date().toISOString())} • HealthWallet Pro • Validade conforme legislação vigente
      </Text>
    </Page>
  );
}

export async function renderReceitaPdf(receita: ReceitaForPdf): Promise<Buffer> {
  // O TS do projeto usa jsx: "react-jsx" — este arquivo .tsx é o único que precisa
  // do pragma React.createElement implícito via jsx-runtime.
  const buffer = await renderToBuffer(<ReceitaDocument receita={receita} />);
  return buffer;
}

export function bufferToDataUriBase64(buf: Buffer): string {
  return `data:application/pdf;base64,${buf.toString('base64')}`;
}

// =====================================================================
// PEDIDO DE EXAME
// =====================================================================

type PedidoExameItemForPdf = {
  id: number;
  exame_id: number;
  observacoes: string | null;
  exame: { codigo_tuss: string; descricao: string; categoria: string | null } | null;
};

type PedidoExameForPdf = {
  id: number;
  cid_principal?: { codigo: string; descricao: string } | null;
  cid_secundario?: { codigo: string; descricao: string } | null;
  texto_clinico: string | null;
  data_emissao: string;
  status: string;
};

function PedidoExameDocument({
  pedido, itens, paciente, medico,
}: {
  pedido: PedidoExameForPdf;
  itens: PedidoExameItemForPdf[];
  paciente: { full_name: string; birth_date: string | null; gender: string | null; blood_type: string | null };
  medico: { full_name: string; professional_register: string; register_state: string; professional_type: string; specialty: string | null };
}) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerName}>{medico.full_name}</Text>
        <Text style={styles.headerSub}>
          {medico.professional_type.toUpperCase()} • {medico.professional_register}/{medico.register_state}
          {medico.specialty ? ` • ${medico.specialty}` : ''}
        </Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: '#0284c7', borderBottomColor: '#0284c7' }]}>
        PEDIDO DE EXAMES
      </Text>

      {/* Paciente */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paciente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nome:</Text>
          <Text style={styles.value}>{paciente.full_name}</Text>
        </View>
        {paciente.birth_date && (
          <View style={styles.row}>
            <Text style={styles.label}>Nascimento:</Text>
            <Text style={styles.value}>{formatDate(paciente.birth_date)}</Text>
          </View>
        )}
        {paciente.gender && (
          <View style={styles.row}>
            <Text style={styles.label}>Sexo:</Text>
            <Text style={styles.value}>{paciente.gender}</Text>
          </View>
        )}
        {paciente.blood_type && (
          <View style={styles.row}>
            <Text style={styles.label}>Tipo sanguíneo:</Text>
            <Text style={styles.value}>{paciente.blood_type}</Text>
          </View>
        )}
      </View>

      {/* Indicação clínica */}
      {(pedido.cid_principal || pedido.texto_clinico) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicação Clínica</Text>
          {pedido.cid_principal && (
            <Text style={styles.value}>
              <Text style={{ fontWeight: 700 }}>CID: </Text>
              {pedido.cid_principal.codigo} — {pedido.cid_principal.descricao}
            </Text>
          )}
          {pedido.texto_clinico && (
            <Text style={[styles.value, { marginTop: 4 }]}>{pedido.texto_clinico}</Text>
          )}
        </View>
      )}

      {/* Exames */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exames Solicitados</Text>
        {itens.length === 0 ? (
          <Text style={styles.value}>Nenhum exame solicitado.</Text>
        ) : (
          itens.map((it, i) => (
            <View key={it.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[styles.value, { fontWeight: 700, width: 24 }]}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.value, { fontWeight: 700 }]}>
                    {it.exame?.descricao || 'Exame'}
                  </Text>
                  <Text style={styles.headerSub}>
                    TUSS {it.exame?.codigo_tuss}
                    {it.exame?.categoria ? ` • ${it.exame.categoria}` : ''}
                  </Text>
                  {it.observacoes && (
                    <Text style={[styles.value, { fontSize: 9, marginTop: 3, color: COLORS.muted }]}>
                      Obs: {it.observacoes}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Assinatura */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureLine}>
          <Text>{medico.full_name}</Text>
          <Text>CRM/{medico.register_state} {medico.professional_register}</Text>
          {pedido.status === 'rascunho' ? (
            <Text>Rascunho — sem assinatura digital</Text>
          ) : (
            <Text>Assinado digitalmente</Text>
          )}
        </View>
      </View>

      <Text style={styles.footer} fixed>
        Documento gerado eletronicamente em {formatDate(new Date().toISOString())} • HealthWallet Pro
      </Text>
    </Page>
  );
}

export async function renderPedidoExamePdf(args: {
  pedido: PedidoExameForPdf;
  itens: PedidoExameItemForPdf[];
  paciente: { full_name: string; birth_date: string | null; gender: string | null; blood_type: string | null };
  medico: { full_name: string; professional_register: string; register_state: string; professional_type: string; specialty: string | null };
}): Promise<Buffer> {
  return renderToBuffer(
    <PedidoExameDocument
      pedido={args.pedido}
      itens={args.itens}
      paciente={args.paciente}
      medico={args.medico}
    />,
  );
}
