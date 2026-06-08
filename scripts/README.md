# ETL — Catálogo de Medicamentos (Anvisa)

Script que popula as tabelas `principios_ativos`, `laboratorios`, `formas_farmaceuticas`, `classes_terapeuticas` e `medicamentos` a partir do CSV de "Medicamentos Registrados no Brasil" da Anvisa (Dados Abertos).

## 🚀 Rodando localmente (rápido)

### 1. Baixe o CSV mais recente

Acesse https://dados.anvisa.gov.br/dataset/medicamentos-registrados-no-brasil e baixe o CSV consolidado (geralmente o arquivo mais recente é o "MEDICAMENTOS_REGISTRADOS_YYYYMMDD.csv").

### 2. Configure as variáveis de ambiente

No `.env.local` da raiz do projeto (ou como env vars no shell):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # NUNCA exponha publicamente
```

### 3. Rode o script

**Modo dry-run** (só simula, não escreve no banco):
```bash
node scripts/etl-anvisa.mjs /caminho/medicamentos.csv
# ou
ETL_DRY_RUN=true node scripts/etl-anvisa.mjs https://url-do-csv
```

**Modo escrita real:**
```bash
node scripts/etl-anvisa.mjs /caminho/medicamentos.csv
```

**Via URL direto** (sem baixar manualmente):
```bash
ANVISA_CSV_URL=https://... node scripts/etl-anvisa.mjs
```

## ⚙️ Variáveis de ambiente opcionais

| Var | Default | Descrição |
|---|---|---|
| `ETL_BATCH_SIZE` | 500 | Tamanho do batch no upsert (max 1000) |
| `ETL_DRY_RUN` | false | Se true, só simula (não escreve) |
| `ETL_ENCODING` | `utf-8` | Encoding do CSV: `utf-8` ou `iso-8859-1` |
| `ANVISA_CSV_URL` | - | URL para baixar o CSV |
| `ANVISA_CSV_PATH` | - | Caminho local do CSV |

## 📊 Colunas esperadas no CSV

O script detecta as colunas por nome (case-insensitive, ignora acentos). Aceita variações comuns:

| Campo no banco | Colunas aceitas no CSV |
|---|---|
| `registro_ms` | `REGISTRO`, `NUMERO_REGISTRO` |
| `nome_comercial` | `NOME_PRODUTO`, `PRODUTO`, `NOME_COMERCIAL` |
| `principios_ativos.nome` | `PRINCIPIO_ATIVO` |
| `concentracao` | `CONCENTRACAO`, `DOSAGEM` |
| `formas_farmaceuticas.descricao` | `FORMA_FARMACEUTICA`, `FORMA` |
| `laboratorios.nome` | `LABORATORIO`, `EMPRESA`, `EMPRESA_DETENTORA`, `DETENTORA_REGISTRO` |
| `laboratorios.cnpj` | `CNPJ` |
| `classes_terapeuticas.descricao` | `CLASSE_TERAPEUTICA`, `CLASSE_TERAP` |

Se o CSV da Anvisa usar nomes diferentes, edite o array de chaves em `scripts/etl-anvisa.mjs` (função `pick`).

## 🤖 Rodando no GitHub Actions (mensal)

A workflow em `.github/workflows/etl-anvisa.yml` roda **automaticamente todo dia 1 do mês às 03:00 UTC**.

### Setup único (você precisa fazer 1 vez):

1. Vá em **Settings → Secrets and variables → Actions** do seu repo no GitHub
2. Em **Secrets**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` (igual ao do Netlify)
   - `SUPABASE_SERVICE_ROLE_KEY` (⚠️ o `service_role`, não o `anon`)
3. Em **Variables**, adicione (opcional):
   - `ANVISA_CSV_URL` — URL do CSV consolidado mais recente
   - `ETL_BATCH_SIZE` — default 500
   - `ETL_ENCODING` — default `utf-8`

### Rodar manualmente

Vá em **Actions → ETL - Atualizar catálogo (Anvisa) → Run workflow**. Você pode marcar "Dry-run" pra testar sem alterar o banco.

## 📈 Saída esperada

```
🚀 ETL Anvisa — Catálogo de Medicamentos
   Modo: 🟢 ESCRITA REAL
   Batch: 500 | Encoding: utf-8
   Supabase: https://xxxxx.supabase.co

📄 Lendo arquivo local: /caminho/medicamentos.csv
   Tamanho: 45.2MB
   Delimitador detectado: ";"

   Processados: 5.000 | Inseridos: 4.987 | Erros: 13
   Processados: 10.000 | Inseridos: 9.972 | Erros: 28
   ...

============================================================
✅ ETL CONCLUÍDO em 87.3s
============================================================
   Linhas processadas:  87.456
   Medicamentos upsert: 87.123
   Erros:               47
   Linhas puladas:      286
   --- Novos cadastros auxiliares ---
   Princípios ativos:   1.247
   Laboratórios:        312
   Formas farmacêuticas:48
   Classes terapêuticas:853
```

## ⚠️ Troubleshooting

| Sintoma | Causa + fix |
|---|---|
| `❌ Faltam env vars` | Defina `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` |
| `Erro ao inserir` em lote | O script cai pra tentar 1-a-1 e mostra exatamente qual registro falhou |
| `Encoding` errado | Defina `ETL_ENCODING=iso-8859-1` (alguns CSVs antigos da Anvisa são Latin1) |
| CSV gigante trava o Node | Aumente RAM ou reduza `ETL_BATCH_SIZE` pra 100 |
| Lentidão | Normal — primeira execução demora ~1-2min a cada 10k registros. Execuções seguintes (upsert idempotente) são mais rápidas |

## 🔁 Quando rodar

- **Após deploy inicial:** 1 vez pra popular o catálogo
- **Mensalmente:** pra pegar novos medicamentos registrados no mês
- **Sempre que precisar:** o script é idempotente (atualiza registros existentes, adiciona novos)
