# MyDataMed Autopilot + n8n

Este documento descreve o fluxo operacional para usar o n8n hospedado no Oracle como orquestrador do MyDataMed / HealthWallet.

A lógica principal é:

1. MyDataMed, HealthWallet e integrações externas gravam eventos em `automation_events`.
2. O n8n busca eventos pendentes por polling.
3. O n8n chama a API interna do MyDataMed para processar cada evento.
4. A API cria teleconsultas, tarefas SmartBots/Staff, registra auditoria e marca o evento como `processed`, `skipped` ou `failed`.

## 1. Variáveis recomendadas no Netlify

```env
AUTOMATION_API_SECRET=crie_um_segredo_forte
N8N_AUTOPILOT_SECRET=o_mesmo_ou_outro_segredo
N8N_AUTOPILOT_WEBHOOK_URL=https://SEU_N8N/webhook/mydatamed-autopilot
CALCOM_WEBHOOK_SECRET=crie_um_segredo_forte_para_calcom
```

`N8N_AUTOPILOT_WEBHOOK_URL` é opcional. Se estiver vazio, os eventos ficam em `automation_events` para o n8n buscar por polling.

Para o primeiro ciclo, prefira polling. É mais fácil de auditar e evita depender de webhook exposto.

## 2. SQLs necessários

Rode no Supabase, nesta ordem:

```text
SQL_AUTOMATION_EVENTS_V1.sql
SQL_TELECONSULTA_CRM_NEXTGEN_V2.sql
SQL_TELECONSULTA_NEXTGEN_COBRANCAS_V1.sql
SQL_CALCOM_AGENDA_V1.sql
```

## 3. Endpoints disponíveis

### Criar evento

```http
POST /api/automation/event
Authorization: Bearer <token_do_usuario>
Content-Type: application/json
```

ou com segredo interno:

```http
POST /api/automation/event
x-automation-secret: <AUTOMATION_API_SECRET>
Content-Type: application/json
```

Body exemplo:

```json
{
  "event_type": "care_link_approved",
  "source_app": "healthwallet",
  "care_link_id": "uuid",
  "patient_id": "uuid",
  "professional_id": "uuid",
  "payload": {
    "scope": { "summary": true, "exams": true }
  }
}
```

### Buscar eventos pendentes para polling no n8n

```http
GET /api/automation/event?status=pending&limit=20
x-automation-secret: <AUTOMATION_API_SECRET>
```

### Processar evento com a API Autopilot

```http
POST /api/automation/process-event
x-automation-secret: <AUTOMATION_API_SECRET>
Content-Type: application/json
```

```json
{
  "event_id": "uuid_do_evento"
}
```

Também aceita:

```json
{
  "event": {
    "id": "uuid_do_evento",
    "event_type": "care_link_approved"
  }
}
```

Eventos processados nesta versão:

```text
care_link_approved
smartbots_task_created
care_link_revoked
calendar_booking_created
calendar_booking_rescheduled
calendar_booking_cancelled
```

### Webhook Cal.com / Cal.diy

Configure no Cal.com/Cal.diy:

```http
POST https://mydatamed.com/api/integrations/calcom/webhook?secret=<CALCOM_WEBHOOK_SECRET>
```

Ou envie o segredo em header:

```http
x-calcom-secret: <CALCOM_WEBHOOK_SECRET>
```

Eventos que o endpoint normaliza:

```text
BOOKING_CREATED / booking.created → calendar_booking_created
BOOKING_RESCHEDULED / booking.rescheduled → calendar_booking_rescheduled
BOOKING_CANCELLED / booking.cancelled → calendar_booking_cancelled
```

O webhook grava o payload bruto em `calcom_webhook_events` e cria um evento em `automation_events`. O n8n processa depois.

### Marcar evento manualmente como processado

```http
PATCH /api/automation/event
x-automation-secret: <AUTOMATION_API_SECRET>
Content-Type: application/json
```

```json
{
  "id": "uuid_do_evento",
  "status": "processed",
  "metadata": {
    "workflow": "care_link_approved_v1"
  }
}
```

### Marcar evento como falha

```json
{
  "id": "uuid_do_evento",
  "status": "failed",
  "last_error": "erro do workflow",
  "attempts": 1
}
```

## 4. Workflow JSON importável

Arquivo criado no repositório:

```text
n8n/workflows/mydatamed-autopilot-polling-v1.json
```

Fluxo:

```text
Manual Trigger ou Schedule Trigger
↓
GET https://mydatamed.com/api/automation/event?status=pending&limit=20
↓
Filtra eventos suportados
↓
POST https://mydatamed.com/api/automation/process-event
↓
Resumo da execução
```

Depois de importar no n8n, troque em dois nós HTTP o valor:

```text
CHANGE_ME_AUTOMATION_API_SECRET
```

pelo mesmo valor configurado no Netlify como `AUTOMATION_API_SECRET`.

## 5. Fluxo Cal.com recomendado

### Opção A — Cal.com Cloud

1. Crie o evento do profissional no Cal.com.
2. Adicione perguntas simples: nome, e-mail, motivo da consulta.
3. Em metadata ou querystring, envie `professional_id` quando possível.
4. Configure o webhook para:

```text
https://mydatamed.com/api/integrations/calcom/webhook?secret=<CALCOM_WEBHOOK_SECRET>&professional_id=<UUID_DO_PROFISSIONAL>
```

5. Marque eventos de booking criado, cancelado e reagendado.

### Opção B — Cal.diy/self-host

Use a mesma URL de webhook. A vantagem é controle; a desvantagem é manutenção.

### Dados que podem ir no Cal.com

```text
nome do paciente
e-mail do paciente
tipo de consulta
data e hora
motivo resumido
professional_id interno, quando aplicável
```

### Dados que não devem ir no Cal.com

```text
laudos
exames completos
diagnósticos
documentos médicos
histórico clínico detalhado
dados sensíveis sem necessidade operacional
```

Dados clínicos ficam no MyDataMed/HealthWallet, com autorização do paciente.

## 6. O que cada evento faz agora

### care_link_approved

Quando o paciente aprova vínculo assistencial no HealthWallet, a API Autopilot:

1. Confirma se o vínculo está ativo.
2. Confirma se existe `patient_id` aprovado.
3. Cria tarefas iniciais de acompanhamento em `professional_crm_tasks`.
4. Registra evento de auditoria em `professional_care_link_events`.
5. Marca `automation_events.status = processed`.

Tarefas criadas:

```text
Revisar paciente recém-vinculado
Solicitar atualização de dados do paciente
Follow-up do vínculo assistencial em 7 dias
Revisar acompanhamento em 30 dias
```

### smartbots_task_created

Quando uma tarefa SmartBots nasce no painel do paciente acompanhado, a API Autopilot:

1. Confirma se a tarefa existe.
2. Registra que ela está pronta para execução operacional.
3. Mantém a tarefa pendente se o canal for manual.
4. Marca o evento como processado.

### care_link_revoked

Quando o paciente revoga um vínculo no HealthWallet, a API Autopilot:

1. Localiza tarefas pendentes daquele vínculo.
2. Marca tarefas como `cancelled`, quando aplicável.
3. Registra auditoria.
4. Marca o evento como processado.

### calendar_booking_created

Quando Cal.com cria um booking, a API Autopilot:

1. Localiza o profissional por `professional_id` ou por `professional_calendar_integrations`.
2. Cria uma linha em `telemedicine_appointments`.
3. Registra evento em `telemedicine_events`.
4. Cria tarefas de pré-consulta e lembrete.
5. Prepara o fluxo para NextGen, SmartBots e Daily.

### calendar_booking_rescheduled

Quando Cal.com reagenda, a API Autopilot:

1. Localiza a teleconsulta pelo `calcom_booking_id`.
2. Atualiza data, horário, duração e metadados.
3. Registra auditoria.

### calendar_booking_cancelled

Quando Cal.com cancela, a API Autopilot:

1. Localiza a teleconsulta pelo `calcom_booking_id`.
2. Marca a teleconsulta como `cancelled`.
3. Cancela tarefas pendentes vinculadas ao appointment.
4. Registra auditoria.

## 7. Teste manual sem ativar o workflow

1. Rode os SQLs no Supabase.
2. Configure `AUTOMATION_API_SECRET` e `CALCOM_WEBHOOK_SECRET` no Netlify.
3. Configure o webhook no Cal.com apontando para `/api/integrations/calcom/webhook`.
4. Crie um booking teste no Cal.com.
5. Verifique se apareceu registro em `calcom_webhook_events`.
6. Verifique se apareceu evento `calendar_booking_created` em `automation_events`.
7. No n8n, importe `mydatamed-autopilot-polling-v1.json`.
8. Troque `CHANGE_ME_AUTOMATION_API_SECRET` pelo segredo real.
9. Execute manualmente.
10. Verifique se o evento virou `processed` e se a teleconsulta foi criada.
11. Só depois ative o Schedule Trigger.

## 8. Regra de produto

O MyDataMed Autopilot coordena rotinas, lembretes, cobrança, documentos, agenda e preparação operacional. Ele não substitui decisão clínica do profissional habilitado.

Todos os fluxos devem respeitar consentimento, revogação e escopo autorizado pelo paciente.
