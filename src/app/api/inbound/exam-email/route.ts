import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

type ParsedInboundPayload = {
  provider: string
  fields: Record<string, any>
  recipients: string[]
  senderEmail: string | null
  senderName: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  messageId: string | null
  files: Array<{
    fileName: string
    mimeType: string
    size?: number
    buffer: Buffer
  }>
}

const EXAMS_BUCKET = process.env.HEALTHWALLET_EXAMS_BUCKET || 'exams'
const DEFAULT_DOMAIN = process.env.HEALTHWALLET_INBOUND_EMAIL_DOMAIN || 'exames.healthwallet.pro'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const acceptedMimePrefixes = ['image/']
const acceptedMimeTypes = new Set(['application/pdf'])

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service role env vars missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function safeCompare(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received || '')
  const expectedBuffer = Buffer.from(expected || '')
  if (!receivedBuffer.length || receivedBuffer.length !== expectedBuffer.length) return false
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

function getAuthorizationSecret(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()

  if (authorization.toLowerCase().startsWith('basic ')) {
    try {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
      return decoded.includes(':') ? decoded.split(':').pop() || '' : decoded
    } catch {
      return ''
    }
  }

  return ''
}

function verifyInboundSecret(req: NextRequest) {
  const expected = process.env.HEALTHWALLET_INBOUND_EMAIL_SECRET
  if (!expected) return true

  const url = new URL(req.url)
  const candidates = [
    req.headers.get('x-healthwallet-inbound-secret') || '',
    req.headers.get('x-inbound-secret') || '',
    url.searchParams.get('secret') || '',
    url.searchParams.get('token') || '',
    getAuthorizationSecret(req),
  ]

  return candidates.some((candidate) => safeCompare(candidate, expected))
}

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null
  const match = String(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : null
}

function extractEmails(value: unknown) {
  if (!value) return []
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return [...new Set(matches.map((item) => item.toLowerCase()))]
}

function guessProvider(fields: Record<string, any>) {
  if ('body-plain' in fields || 'recipient' in fields || 'attachment-count' in fields) return 'mailgun'
  if ('spam_score' in fields || 'envelope' in fields || 'charsets' in fields) return 'sendgrid'
  if ('FromFull' in fields || 'ToFull' in fields || 'MessageID' in fields) return 'postmark'
  return fields.provider || 'generic_email_inbound'
}

function guessDocumentType(fileName = '', subject = '') {
  const text = `${fileName} ${subject}`.toLowerCase()
  if (text.includes('receita') || text.includes('prescri')) return 'Receita'
  if (text.includes('laudo')) return 'Laudo'
  if (text.includes('exame') || text.includes('resultado') || text.includes('laborat')) return 'Exame'
  if (text.includes('vacina') || text.includes('imuniza')) return 'Vacina'
  return 'Documento de saúde'
}

function guessLaboratory(fileName = '', subject = '', fromEmail = '') {
  const text = `${fileName} ${subject} ${fromEmail}`.toLowerCase()
  const labs = [
    { key: 'dasa', label: 'DASA' },
    { key: 'fleury', label: 'Fleury' },
    { key: 'hermes', label: 'Hermes Pardini' },
    { key: 'pardini', label: 'Hermes Pardini' },
    { key: 'sergio franco', label: 'Sérgio Franco' },
    { key: 'sérgio franco', label: 'Sérgio Franco' },
    { key: 'alta', label: 'Alta Diagnósticos' },
    { key: 'lavoisier', label: 'Lavoisier' },
    { key: 'delboni', label: 'Delboni' },
  ]
  return labs.find((lab) => text.includes(lab.key))?.label || null
}

function sanitizeFileName(name: string) {
  return String(name || 'documento.pdf')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'documento.pdf'
}

function isAcceptedFile(file: { fileName: string; mimeType: string; size?: number }) {
  const mime = file.mimeType || 'application/octet-stream'
  const acceptedMime = acceptedMimeTypes.has(mime) || acceptedMimePrefixes.some((prefix) => mime.startsWith(prefix))
  const acceptedExt = /\.(pdf|png|jpe?g|webp|heic|heif)$/i.test(file.fileName || '')
  const sizeOk = !file.size || file.size <= MAX_FILE_SIZE
  return sizeOk && (acceptedMime || acceptedExt)
}

function bodyPreview(text: string | null, html: string | null) {
  const source = text || (html ? html.replace(/<[^>]+>/g, ' ') : '') || ''
  return source.replace(/\s+/g, ' ').trim().slice(0, 1200) || null
}

async function parseInboundRequest(req: NextRequest): Promise<ParsedInboundPayload> {
  const contentType = req.headers.get('content-type') || ''
  const fields: Record<string, any> = {}
  const files: ParsedInboundPayload['files'] = []

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') {
        fields[key] = value
      } else {
        const file = value as File
        const buffer = Buffer.from(await file.arrayBuffer())
        files.push({
          fileName: file.name || key,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          buffer,
        })
      }
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    const params = new URLSearchParams(text)
    params.forEach((value, key) => { fields[key] = value })
  } else {
    const json = await req.json().catch(() => ({}))
    Object.assign(fields, json)

    const attachments = Array.isArray(json.attachments) ? json.attachments : Array.isArray(json.Attachments) ? json.Attachments : []
    for (const attachment of attachments) {
      const content = attachment.contentBase64 || attachment.Content || attachment.content || attachment.data
      if (!content) continue
      const buffer = Buffer.from(String(content).replace(/^data:[^;]+;base64,/, ''), 'base64')
      files.push({
        fileName: attachment.fileName || attachment.Name || attachment.filename || 'documento.pdf',
        mimeType: attachment.mimeType || attachment.ContentType || attachment.type || 'application/octet-stream',
        size: attachment.size || buffer.length,
        buffer,
      })
    }
  }

  const provider = guessProvider(fields)
  const senderEmail = normalizeEmail(fields.from || fields.sender || fields.From || fields.FromFull?.Email)
  const senderName = fields.from_name || fields['sender-name'] || fields.FromFull?.Name || null
  const subject = fields.subject || fields.Subject || null
  const bodyText = fields.text || fields['body-plain'] || fields.TextBody || fields.bodyText || null
  const bodyHtml = fields.html || fields['body-html'] || fields.HtmlBody || fields.bodyHtml || null
  const messageId = fields['Message-Id'] || fields['message-id'] || fields.MessageID || fields.messageId || fields.provider_message_id || null

  let recipients = [
    ...extractEmails(fields.to),
    ...extractEmails(fields.recipient),
    ...extractEmails(fields.envelope),
    ...extractEmails(fields.To),
    ...extractEmails(fields.ToFull),
    ...extractEmails(fields.headers),
    ...extractEmails(fields.Headers),
  ]

  if (fields.recipient && !recipients.length) recipients = extractEmails(String(fields.recipient))
  recipients = [...new Set(recipients)]

  return { provider, fields, recipients, senderEmail, senderName, subject, bodyText, bodyHtml, messageId, files }
}

function extractAddressTokens(recipients: string[]) {
  return recipients.map((email) => {
    const [localPart] = email.split('@')
    const plusToken = localPart?.includes('+') ? localPart.split('+').pop() : null
    const dashToken = localPart?.match(/(?:exames|upload|inbox)[-_.+]?([a-z0-9]{6,})/i)?.[1]
    return (plusToken || dashToken || '').toLowerCase()
  }).filter(Boolean)
}

async function resolveInboundAddress(supabase: any, recipients: string[]) {
  if (!recipients.length) return null

  const { data: exactRows, error: exactError } = await supabase
    .from('health_inbound_email_addresses')
    .select('*')
    .eq('status', 'active')
    .in('email_address', recipients)
    .limit(1)

  if (exactError) throw exactError
  if (exactRows?.[0]) return exactRows[0]

  const tokens = extractAddressTokens(recipients)
  if (!tokens.length) return null

  const { data: tokenRows, error: tokenError } = await supabase
    .from('health_inbound_email_addresses')
    .select('*')
    .eq('status', 'active')
    .in('token', tokens)
    .limit(1)

  if (tokenError) throw tokenError
  return tokenRows?.[0] || null
}

async function saveInboxEvent(supabase: any, payload: any) {
  await supabase.from('health_document_inbox_events').insert(payload).then(() => null, () => null)
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'HealthWallet Exam Email Inbox',
    domain: DEFAULT_DOMAIN,
    accepted: ['PDF', 'PNG', 'JPG', 'WEBP', 'HEIC'],
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyInboundSecret(req)) {
      return NextResponse.json({ error: 'invalid_inbound_secret' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const parsed = await parseInboundRequest(req)
    const inboundAddress = await resolveInboundAddress(supabase, parsed.recipients)

    if (!inboundAddress?.user_id) {
      return NextResponse.json({
        error: 'unknown_recipient',
        recipients: parsed.recipients,
      }, { status: 404 })
    }

    await supabase
      .from('health_inbound_email_addresses')
      .update({ last_received_at: new Date().toISOString() })
      .eq('id', inboundAddress.id)

    const preview = bodyPreview(parsed.bodyText, parsed.bodyHtml)
    const acceptedFiles = parsed.files.filter(isAcceptedFile)
    const ignoredFiles = parsed.files.length - acceptedFiles.length
    const createdItems: any[] = []

    if (!acceptedFiles.length) {
      const { data, error } = await supabase
        .from('health_document_inbox')
        .insert({
          user_id: inboundAddress.user_id,
          inbound_email_id: inboundAddress.id,
          source: 'email_forward',
          provider: parsed.provider,
          provider_message_id: parsed.messageId,
          from_email: parsed.senderEmail,
          from_name: parsed.senderName,
          recipient_email: inboundAddress.email_address,
          subject: parsed.subject,
          body_preview: preview,
          status: 'pending_review',
          suggested_document_type: 'Mensagem de e-mail',
          metadata: {
            recipients: parsed.recipients,
            no_accepted_attachments: true,
            ignored_files: ignoredFiles,
            possible_forwarding_confirmation: /gmail|google|encaminhamento|forwarding|confirmation|confirma/i.test(`${parsed.subject || ''} ${preview || ''}`),
          },
        })
        .select('*')
        .single()

      if (error) throw error
      createdItems.push(data)
      await saveInboxEvent(supabase, {
        user_id: inboundAddress.user_id,
        inbox_item_id: data.id,
        event_type: 'email_received_without_attachment',
        actor_role: 'system',
        description: 'E-mail recebido sem anexo aceito. Útil para códigos de confirmação de encaminhamento.',
        metadata: { provider: parsed.provider, from_email: parsed.senderEmail, subject: parsed.subject },
      })
    }

    for (const file of acceptedFiles) {
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex')
      const safeName = sanitizeFileName(file.fileName)
      const path = `${inboundAddress.user_id}/email-inbox/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`
      const laboratory = guessLaboratory(file.fileName, parsed.subject || '', parsed.senderEmail || '')
      const suggestedType = guessDocumentType(file.fileName, parsed.subject || '')

      const upload = await supabase.storage
        .from(EXAMS_BUCKET)
        .upload(path, file.buffer, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false,
        })

      if (upload.error) throw upload.error

      const { data: publicUrlData } = supabase.storage.from(EXAMS_BUCKET).getPublicUrl(path)

      const { data, error } = await supabase
        .from('health_document_inbox')
        .insert({
          user_id: inboundAddress.user_id,
          inbound_email_id: inboundAddress.id,
          source: 'email_forward',
          provider: parsed.provider,
          provider_message_id: parsed.messageId,
          from_email: parsed.senderEmail,
          from_name: parsed.senderName,
          recipient_email: inboundAddress.email_address,
          subject: parsed.subject,
          body_preview: preview,
          status: 'pending_review',
          suggested_document_type: suggestedType,
          suggested_laboratory: laboratory,
          storage_bucket: EXAMS_BUCKET,
          storage_path: path,
          file_url: publicUrlData.publicUrl,
          file_name: safeName,
          original_file_name: file.fileName,
          mime_type: file.mimeType,
          file_size: file.size || file.buffer.length,
          attachment_sha256: hash,
          metadata: {
            recipients: parsed.recipients,
            accepted_via: 'healthwallet_exam_email_inbox',
            requires_patient_review: true,
            ignored_files,
          },
        })
        .select('*')
        .single()

      if (error) {
        if (String(error.message || '').toLowerCase().includes('duplicate')) {
          await supabase.storage.from(EXAMS_BUCKET).remove([path]).then(() => null, () => null)
          continue
        }
        throw error
      }

      createdItems.push(data)
      await saveInboxEvent(supabase, {
        user_id: inboundAddress.user_id,
        inbox_item_id: data.id,
        event_type: 'email_attachment_received',
        actor_role: 'system',
        description: 'Anexo de saúde recebido por e-mail e colocado na caixa de entrada para revisão do paciente.',
        metadata: { provider: parsed.provider, from_email: parsed.senderEmail, file_name: file.fileName, sha256: hash },
      })
    }

    return NextResponse.json({
      success: true,
      user_id: inboundAddress.user_id,
      inbound_email_id: inboundAddress.id,
      created: createdItems.length,
      ignored_files: ignoredFiles,
      items: createdItems.map((item) => ({ id: item.id, status: item.status, file_name: item.file_name, suggested_document_type: item.suggested_document_type })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao receber e-mail de exames.' }, { status: 500 })
  }
}