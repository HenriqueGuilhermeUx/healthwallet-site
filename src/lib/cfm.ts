/**
 * Cliente CFM — Listamedicos (Web Service SOAP/XML)
 *
 * Documentação: https://crmvirtual.cfm.org.br (acesso requer cadastro)
 *
 * ENV vars:
 *   CFM_LISTAMEDICOS_URL  — endpoint SOAP (padrão de produção)
 *   CFM_ACCESS_KEY        — chave de acesso obtida no CFM Virtual
 *
 * O CFM retorna dados públicos do médico (status, nome, especialidade).
 * O body da resposta é XML — usamos xml2js pra parsear de forma segura.
 *
 * Se a chave não estiver configurada, `validateCRM()` lança um erro
 * instruindo o usuário a configurar. As rotas podem optar por um fallback
 * "manual" (aceitar CRM e marcar como `crm_verified_at = null` para revisão).
 */

import { parseStringPromise } from 'xml2js';

const DEFAULT_CFM_URL = 'https://ws.cfm.org.br/listamedicos/ws/Listamedicos';

export type CfmValidationResult = {
  found: boolean;
  active: boolean;
  fullName: string | null;
  crm: string | null;
  uf: string | null;
  specialty: string | null;
  situation: string | null;          // 'ATIVO' | 'SUSPENSO' | etc.
  raw: unknown;
};

function isCfmConfigured(): boolean {
  return !!process.env.CFM_ACCESS_KEY;
}

function buildSoapEnvelope(crm: string, uf: string, accessKey: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://tempuri.org/">
  <soap:Body>
    <ns:Listamedicos>
      <ns:chave>${escapeXml(accessKey)}</ns:chave>
      <ns:crm>${escapeXml(crm)}</ns:crm>
      <ns:uf>${escapeXml(uf)}</ns:uf>
    </ns:Listamedicos>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractFromResult(parsed: unknown): CfmValidationResult {
  // Estrutura típica da resposta (varia conforme versão do serviço):
  // <soap:Body><ListamedicosResponse><ListamedicosResult>...</ListamedicosResult></ListamedicosResponse></soap:Body>
  // O conteúdo de ListamedicosResult pode ser:
  //   a) XML-string com <Medico>...<Nome>...</Nome><CRM>...</CRM>...</Medico>
  //   b) String com "0" / "1" (registros encontrados)
  //   c) JSON serializado (versões mais novas)
  const result = getByPath(parsed, ['soap:Envelope', 'soap:Body', 'ListamedicosResponse', 'ListamedicosResult'])
    ?? getByPath(parsed, ['Envelope', 'Body', 'ListamedicosResponse', 'ListamedicosResult']);

  if (result == null) {
    return { found: false, active: false, fullName: null, crm: null, uf: null, specialty: null, situation: null, raw: parsed };
  }

  if (typeof result === 'string') {
    // Tenta parsear como XML aninhado
    if (result.trim().startsWith('<')) {
      return parseInnerXml(result);
    }
    // Pode ser um JSON serializado (escapado dentro de XML)
    try {
      const inner = JSON.parse(result.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      return extractFromResult(inner);
    } catch {
      // Pode ser só "0" (não encontrado) ou "1" (encontrado)
      if (result.trim() === '0') {
        return { found: false, active: false, fullName: null, crm: null, uf: null, specialty: null, situation: null, raw: parsed };
      }
      return { found: true, active: false, fullName: null, crm: null, uf: null, specialty: null, situation: null, raw: parsed };
    }
  }

  return { found: false, active: false, fullName: null, crm: null, uf: null, specialty: null, situation: null, raw: parsed };
}

function parseInnerXml(xmlString: string): CfmValidationResult {
  // Parse simples via regex — o XML do CFM é bem estruturado
  const get = (tag: string): string | null => {
    const m = xmlString.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : null;
  };
  const nome = get('Nome') || get('nome');
  const crm = get('CRM') || get('crm');
  const uf = get('UF') || get('uf') || get('Estado') || get('estado');
  const especialidade = get('Especialidade') || get('especialidade') || get('RQE');
  const situacao = get('Situacao') || get('situacao') || get('Status') || get('status');

  const active = !!situacao && /ATIVO|REGULAR/i.test(situacao);
  return {
    found: !!crm || !!nome,
    active,
    fullName: nome,
    crm,
    uf,
    specialty: especialidade,
    situation: situacao,
    raw: xmlString,
  };
}

function getByPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Consulta o CFM pelo CRM + UF.
 *
 * Lança erro se a chave CFM não estiver configurada.
 * Retorna found=false se o CRM não existir / estiver irregular.
 */
export async function validateCRM(input: { crm: string; uf: string }): Promise<CfmValidationResult> {
  if (!isCfmConfigured()) {
    throw new Error(
      'CFM_ACCESS_KEY não configurada. Obtenha a chave em https://crmvirtual.cfm.org.br e defina a env var.',
    );
  }
  const url = process.env.CFM_LISTAMEDICOS_URL || DEFAULT_CFM_URL;
  const accessKey = process.env.CFM_ACCESS_KEY!;
  const envelope = buildSoapEnvelope(input.crm, input.uf, accessKey);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://tempuri.org/Listamedicos"',
    },
    body: envelope,
  });
  if (!res.ok) {
    throw new Error(`CFM respondeu ${res.status}: ${await res.text()}`);
  }
  const xmlText = await res.text();
  const parsed = await parseStringPromise(xmlText, { explicitArray: false, ignoreAttrs: true, trim: true });
  return extractFromResult(parsed);
}
