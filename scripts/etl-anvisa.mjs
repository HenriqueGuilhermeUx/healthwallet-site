#!/usr/bin/env node
/**
 * ETL — Catálogo de Medicamentos (Anvisa Dados Abertos)
 *
 * Popula as tabelas `principios_ativos`, `laboratorios`, `formas_farmaceuticas`,
 * `classes_terapeuticas` e `medicamentos` a partir de um CSV da Anvisa.
 *
 * USO:
 *   # Via URL
 *   ANVISA_CSV_URL=https://... node scripts/etl-anvisa.mjs
 *
 *   # Via arquivo local (já baixado)
 *   ANVISA_CSV_PATH=/caminho/medicamentos.csv node scripts/etl-anvisa.mjs
 *
 *   # URL passada como argumento
 *   node scripts/etl-anvisa.mjs https://...
 *
 *   # Dry-run (não escreve no banco, só conta e mostra amostras)
 *   ETL_DRY_RUN=true node scripts/etl-anvisa.mjs /caminho/medicamentos.csv
 *
 * ENV vars obrigatórias:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * ENV vars opcionais:
 *   ETL_BATCH_SIZE    (default: 500)
 *   ETL_DRY_RUN       (default: false)
 *   ETL_ENCODING      (utf-8 | iso-8859-1, default: utf-8)
 *
 * COLUNAS ESPERADAS NO CSV (case-insensitive, aceita variações comuns):
 *   REGISTRO            -> registro_ms (varchar, 13 dígitos)
 *   NOME_PRODUTO        -> nome_comercial
 *   PRINCIPIO_ATIVO     -> principios_ativos.nome
 *   CONCENTRACAO        -> concentracao
 *   FORMA_FARMACEUTICA  -> formas_farmaceuticas.descricao
 *   LABORATORIO / EMPRESA -> laboratorios.nome (e cnpj se houver)
 *   CLASSE_TERAPEUTICA  -> classes_terapeuticas.descricao
 *   CNPJ                -> laboratorios.cnpj
 *
 * O script detecta automaticamente o delimitador (; , \t) e ignora BOM.
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import iconv from 'iconv-lite'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carrega .env.local se existir (best-effort, sem dep extra)
try {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, 'utf-8')
    for (const line of envText.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch { /* sem dotenv, tudo bem */ }

// ============== CONFIG ==============
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltam env vars: NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Defina-as no .env.local ou passe como env vars ao rodar o script.')
  process.exit(1)
}

const BATCH_SIZE = Math.min(Number(process.env.ETL_BATCH_SIZE) || 500, 1000)
const DRY_RUN    = process.env.ETL_DRY_RUN === 'true' || process.env.ETL_DRY_RUN === '1'
const ENCODING   = (process.env.ETL_ENCODING || 'utf-8').toLowerCase()

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============== CACHE DE LOOKUPS ==============
const cache = {
  principios_ativos: new Map(),  // nome_normalizado -> id
  laboratorios:      new Map(),
  formas_farmaceuticas: new Map(),
  classes_terapeuticas: new Map(),
}

const counters = {
  processados: 0,
  inseridos: 0,
  atualizados: 0,
  erros: 0,
  principios_novos: 0,
  laboratorios_novos: 0,
  formas_novas: 0,
  classes_novas: 0,
  pulados: 0,
}

const t0 = Date.now()

// ============== HELPERS ==============

function normalize(s) {
  return (s || '').toString().trim().toUpperCase().replace(/\s+/g, ' ')
}

function pick(row, ...keys) {
  // Case-insensitive, ignora acentos
  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '')
  const idx = {}
  for (const k of Object.keys(row)) idx[norm(k)] = k
  for (const k of keys) {
    const orig = idx[norm(k)]
    if (orig && row[orig] != null && row[orig] !== '') return row[orig]
  }
  return null
}

async function ensureEntity(table, name, cacheMap, cnpj, counter) {
  if (!name) return null
  const norm = normalize(name)
  if (!norm) return null
  if (cacheMap.has(norm)) return cacheMap.get(norm)

  // SELECT (busca case-insensitive, com normalização simples)
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .ilike('nome', name)
    .limit(1)
    .maybeSingle()

  if (existing) {
    cacheMap.set(norm, existing.id)
    return existing.id
  }

  if (DRY_RUN) {
    const fakeId = -Math.floor(Math.random() * 1000000) - 1
    cacheMap.set(norm, fakeId)
    counters[counter]++
    return fakeId
  }

  // INSERT
  const row = { nome: name.trim() }
  if (cnpj) row.cnpj = cnpj.replace(/\D/g, '').padStart(14, '0').slice(0, 14)
  const { data: inserted, error } = await supabase
    .from(table)
    .insert(row)
    .select('id')
    .single()
  if (error) {
    // Possível race condition: outro worker inseriu entre o SELECT e o INSERT
    if (error.code === '23505') {
      const { data: retry } = await supabase.from(table).select('id').ilike('nome', name).maybeSingle()
      if (retry) { cacheMap.set(norm, retry.id); return retry.id }
    }
    console.error(`  ⚠️  Erro ao inserir ${table} "${name}": ${error.message}`)
    return null
  }
  cacheMap.set(norm, inserted.id)
  counters[counter]++
  return inserted.id
}

async function rowToMedicamento(row) {
  const registro = pick(row, 'REGISTRO', 'NUMERO_REGISTRO', 'registro', 'numero_registro')
  const nome     = pick(row, 'NOME_PRODUTO', 'PRODUTO', 'nome_produto', 'produto', 'NOME_COMERCIAL')
  if (!registro || !nome) {
    counters.pulados++
    return null
  }
  const registroStr = String(registro).replace(/\D/g, '').padStart(13, '0').slice(0, 13)

  const [principioId, laboratorioId, formaId, classeId] = await Promise.all([
    ensureEntity('principios_ativos',     pick(row, 'PRINCIPIO_ATIVO', 'principio_ativo'),     cache.principios_ativos,    null, 'principios_novos'),
    ensureEntity('laboratorios',          pick(row, 'LABORATORIO', 'EMPRESA', 'EMPRESA_DETENTORA', 'DETENTORA_REGISTRO'), cache.laboratorios, pick(row, 'CNPJ', 'cnpj'), 'laboratorios_novos'),
    ensureEntity('formas_farmaceuticas',  pick(row, 'FORMA_FARMACEUTICA', 'FORMA', 'forma_farmaceutica', 'forma'), cache.formas_farmaceuticas, null, 'formas_novas'),
    ensureEntity('classes_terapeuticas',  pick(row, 'CLASSE_TERAPEUTICA', 'CLASSE_TERAP', 'classe_terapeutica', 'classe'), cache.classes_terapeuticas, null, 'classes_novas'),
  ])

  return {
    registro_ms: registroStr,
    nome_comercial: nome.toString().trim().slice(0, 255),
    principio_ativo_id: principioId > 0 || principioId === null ? principioId : null,
    concentracao: pick(row, 'CONCENTRACAO', 'concentracao', 'DOSAGEM'),
    forma_farmaceutica_id: formaId > 0 || formaId === null ? formaId : null,
    laboratorio_id: laboratorioId > 0 || laboratorioId === null ? laboratorioId : null,
    classe_terapeutica_id: classeId > 0 || classeId === null ? classeId : null,
    ativo: true,
  }
}

async function upsertBatch(batch) {
  if (DRY_RUN) {
    counters.inseridos += batch.length
    return
  }
  const { error } = await supabase
    .from('medicamentos')
    .upsert(batch, { onConflict: 'registro_ms', ignoreDuplicates: false })

  if (error) {
    // Tenta um a um pra identificar linhas problemáticas
    if (batch.length > 1) {
      console.error(`  ⚠️  Erro no batch (${batch.length} itens): ${error.message}. Tentando 1 a 1...`)
      for (const item of batch) {
        const { error: singleErr } = await supabase
          .from('medicamentos')
          .upsert([item], { onConflict: 'registro_ms' })
        if (singleErr) {
          counters.erros++
          console.error(`     ❌ Registro ${item.registro_ms}: ${singleErr.message}`)
        } else {
          counters.inseridos++
        }
      }
    } else {
      counters.erros++
      console.error(`  ❌ ${error.message}`)
    }
  } else {
    counters.inseridos += batch.length
  }
}

// ============== DOWNLOAD ==============
const DOWNLOAD_TIMEOUT_MS = Math.max(10_000, Number(process.env.ETL_DOWNLOAD_TIMEOUT_SEC || 300) * 1000)
const DOWNLOAD_RETRIES = Math.max(1, Number(process.env.ETL_DOWNLOAD_RETRIES || 3))

function downloadCsvOnce(url) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const agent = new https.Agent({ rejectUnauthorized: false })
    const req = https.get(url, { agent, timeout: DOWNLOAD_TIMEOUT_MS }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return resolve(downloadCsvOnce(res.headers.location))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error('HTTP ' + res.statusCode + ' ao baixar ' + url))
      }
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      res.on('data', (chunk) => {
        chunks.push(chunk)
        received += chunk.length
        if (totalBytes) {
          const pct = ((received / totalBytes) * 100).toFixed(1)
          process.stdout.write('\r  ' + (received / 1e6).toFixed(1) + 'MB / ' + (totalBytes / 1e6).toFixed(1) + 'MB (' + pct + '%)')
        }
      })
      res.on('end', () => {
        if (totalBytes) process.stdout.write('\n')
        resolve(Buffer.concat(chunks))
      })
      res.on('error', reject)
    })
    req.on('timeout', () => {
      req.destroy(new Error('Timeout apos ' + (DOWNLOAD_TIMEOUT_MS/1000).toFixed(0) + 's'))
    })
    req.on('error', reject)
  })
}

async function downloadCsv(url) {
  let lastError = null
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const backoffMs = Math.min(30_000, 2000 * Math.pow(2, attempt - 2))
        console.log('   Aguardando ' + (backoffMs/1000).toFixed(0) + 's antes de tentar de novo (tentativa ' + attempt + '/' + DOWNLOAD_RETRIES + ')...')
        await new Promise((r) => setTimeout(r, backoffMs))
      }
      console.log('Tentativa ' + attempt + '/' + DOWNLOAD_RETRIES + ' - baixando: ' + url)
      const buf = await downloadCsvOnce(url)
      if (attempt > 1) console.log('   Sucesso na tentativa ' + attempt)
      return buf
    } catch (err) {
      lastError = err
      console.error('   Tentativa ' + attempt + ' falhou: ' + err.message)
    }
  }
  throw new Error('Download falhou apos ' + DOWNLOAD_RETRIES + ' tentativas. Ultimo erro: ' + (lastError && lastError.message))
}

// ============== MAIN ==============
async function main() {
  console.log('🚀 ETL Anvisa — Catálogo de Medicamentos')
  console.log(`   Modo: ${DRY_RUN ? '🟡 DRY-RUN (não escreve)' : '🟢 ESCRITA REAL'}`)
  console.log(`   Batch: ${BATCH_SIZE} | Encoding: ${ENCODING}`)
  console.log(`   Supabase: ${SUPABASE_URL}\n`)

  // 1) Carregar arquivo
  const url = process.argv[2] || process.env.ANVISA_CSV_URL
  const localPath = process.env.ANVISA_CSV_PATH
  let buffer
  if (localPath) {
    console.log(`📄 Lendo arquivo local: ${localPath}`)
    if (!fs.existsSync(localPath)) {
      console.error(`❌ Arquivo não encontrado: ${localPath}`)
      process.exit(1)
    }
    buffer = fs.readFileSync(localPath)
  } else if (url) {
    buffer = await downloadCsv(url)
  } else {
    console.error('❌ Forneça o CSV via:')
    console.error('   - argumento: node scripts/etl-anvisa.mjs https://...')
    console.error('   - env var:   ANVISA_CSV_URL=... ou ANVISA_CSV_PATH=...')
    process.exit(1)
  }

  console.log(`   Tamanho: ${(buffer.length / 1e6).toFixed(1)}MB\n`)

  // 2) Decodificar
  let text
  if (ENCODING === 'iso-8859-1' || ENCODING === 'latin1') {
    text = iconv.decode(buffer, 'iso-8859-1')
  } else {
    text = buffer.toString('utf-8')
  }
  // Remove BOM se houver
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  // 3) Detectar delimitador pela primeira linha
  const firstLine = text.split('\n')[0]
  let delimiter = ','
  if (firstLine.includes(';')) delimiter = ';'
  else if (firstLine.includes('\t')) delimiter = '\t'
  console.log(`   Delimitador detectado: "${delimiter}"`)

  // 4) Parsear
  const parser = parse({
    columns: true,
    delimiter,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  })

  // 5) Processar linha a linha
  let batch = []
  let sampleRow = null
  for await (const row of parser) {
    if (!sampleRow) sampleRow = row
    const item = await rowToMedicamento(row)
    if (item) batch.push(item)
    counters.processados++

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch)
      batch = []
      if (counters.processados % 5000 === 0) {
        console.log(`   Processados: ${counters.processados.toLocaleString('pt-BR')} | Inseridos: ${counters.inseridos.toLocaleString('pt-BR')} | Erros: ${counters.erros}`)
      }
    }
  }
  if (batch.length > 0) await upsertBatch(batch)

  // 6) Relatório final
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ ETL CONCLUÍDO em ${dt}s`)
  console.log(`${'='.repeat(60)}`)
  console.log(`   Linhas processadas:  ${counters.processados.toLocaleString('pt-BR')}`)
  console.log(`   Medicamentos upsert: ${counters.inseridos.toLocaleString('pt-BR')}`)
  console.log(`   Erros:               ${counters.erros.toLocaleString('pt-BR')}`)
  console.log(`   Linhas puladas:      ${counters.pulados.toLocaleString('pt-BR')}`)
  console.log(`   --- Novos cadastros auxiliares ---`)
  console.log(`   Princípios ativos:   ${counters.principios_novos.toLocaleString('pt-BR')}`)
  console.log(`   Laboratórios:        ${counters.laboratorios_novos.toLocaleString('pt-BR')}`)
  console.log(`   Formas farmacêuticas:${counters.formas_novas.toLocaleString('pt-BR')}`)
  console.log(`   Classes terapêuticas:${counters.classes_novas.toLocaleString('pt-BR')}`)
  if (sampleRow) {
    console.log(`\n   Exemplo de linha do CSV:`)
    for (const [k, v] of Object.entries(sampleRow).slice(0, 8)) {
      console.log(`     ${k}: ${String(v).slice(0, 60)}`)
    }
  }
  if (DRY_RUN) {
    console.log(`\n   🟡 MODO DRY-RUN: nada foi escrito. Rode sem ETL_DRY_RUN para aplicar.`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('\n❌ Erro fatal:', e.message)
  console.error(e.stack)
  process.exit(1)
})
