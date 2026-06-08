/**
 * Cliente Clicksign — API v1
 * https://developers.clicksign.com/docs
 *
 * Env vars:
 *   CLICKSIGN_ACCESS_TOKEN  — token Bearer (sandbox ou produção)
 *   CLICKSIGN_API_URL       — https://app.clicksign.com (prod) ou https://sandbox.clicksign.com
 */

type CreateDocumentInput = {
  path: string;
  contentBase64: string;
  autoClose?: boolean;
  message?: string;
};

type CreateDocumentOutput = { documentKey: string };

type CreateSignerInput = {
  name: string;
  email: string;
  cpf?: string;
  auths: ('email' | 'sms' | 'digital_certificate' | 'whatsapp' | 'pix')[];
  deliveryMethod?: 'email' | 'sms' | 'whatsapp' | 'none';
  hasDocumentation?: boolean;
  customFields?: Record<string, string | number>;
};

type CreateSignerOutput = { signerKey: string };

type CreateListInput = {
  documentKey: string;
  signerKey: string;
  signAs: 'sign' | 'approve' | 'party' | 'intervening' | 'witness' | 'receipt';
  order?: number;
};

type CreateListOutput = { listKey: string; signUrl: string };

export class ClicksignError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
    this.name = 'ClicksignError';
  }
}

function getConfig() {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const apiUrl = process.env.CLICKSIGN_API_URL || 'https://app.clicksign.com';
  if (!accessToken) throw new Error('CLICKSIGN_ACCESS_TOKEN não definido');
  return { accessToken, apiUrl };
}

async function clicksignFetch<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
  body?: unknown,
): Promise<T> {
  const { accessToken, apiUrl } = getConfig();
  const res = await fetch(`${apiUrl}/api/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new ClicksignError(
      `Clicksign ${method} ${endpoint} falhou (${res.status})`,
      res.status,
      json,
    );
  }
  return json as T;
}

export async function createDocument(input: CreateDocumentInput): Promise<CreateDocumentOutput> {
  const res = await clicksignFetch<{ document: { key: string } }>('/documents', 'POST', {
    document: {
      path: input.path,
      content_base64: input.contentBase64,
      auto_close: input.autoClose ?? true,
      locale: 'pt-BR',
      sequence_enabled: false,
      remind_interval: 1,
    },
  });
  return { documentKey: res.document.key };
}

export async function createSigner(input: CreateSignerInput): Promise<CreateSignerOutput> {
  const res = await clicksignFetch<{ signer: { key: string } }>('/signers', 'POST', {
    signer: {
      name: input.name,
      email: input.email,
      cpf: input.cpf?.replace(/\D/g, ''),
      auths: input.auths,
      delivery_method: input.deliveryMethod ?? 'none',
      has_documentation: input.hasDocumentation ?? true,
      custom_fields: input.customFields,
    },
  });
  return { signerKey: res.signer.key };
}

export async function createList(input: CreateListInput): Promise<CreateListOutput> {
  const res = await clicksignFetch<{ list: { key: string; sign_url: string } }>('/lists', 'POST', {
    list: {
      document_key: input.documentKey,
      signer_key: input.signerKey,
      sign_as: input.signAs,
      order: input.order ?? 1,
    },
  });
  return { listKey: res.list.key, signUrl: res.list.sign_url };
}

export function extractWidgetKeyFromSignUrl(signUrl: string): string {
  try {
    const u = new URL(signUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  } catch {
    throw new Error(`sign_url inválida: ${signUrl}`);
  }
}

export type DocumentStatus = 'running' | 'completed' | 'canceled' | 'expired';

export async function getDocument(documentKey: string) {
  const res = await clicksignFetch<{
    document: {
      key: string;
      status: DocumentStatus;
      signed_file_url?: string;
      file_url?: string;
    };
  }>(`/documents/${documentKey}`, 'GET');
  return res.document;
}

export async function sendDocumentForSignature(input: {
  pdfBase64: string;
  documentPath: string;
  signer: CreateSignerInput;
  signAs?: CreateListInput['signAs'];
}) {
  const { documentKey } = await createDocument({
    path: input.documentPath,
    contentBase64: input.pdfBase64,
  });
  const { signerKey } = await createSigner(input.signer);
  const { signUrl, listKey } = await createList({
    documentKey,
    signerKey,
    signAs: input.signAs ?? 'sign',
  });
  return { documentKey, signerKey, listKey, signUrl };
}
