# MyDataMed Autopilot + n8n

Este documento descreve o fluxo operacional para usar o n8n hospedado no Oracle como orquestrador do MyDataMed / HealthWallet.

A lógica principal é:

1. MyDataMed e HealthWallet gravam eventos em `automation_events`.
2. O n8n busca eventos pendentes por polling.
3. O n8n chama a API interna do MyDataMed para processar cada evento.
4. A API cria tarefas SmartBots/Staff, registra auditoria e marca o evento como `processed`, `skipped` ou `failed`.

## 1. Variáveis recomendadas no Netlify

```env
AUTOMATION_API_SECRET=crie_um_segredo_forte
N8N_AUTOPILOT_SECRET=o_mesmo_ou_outro_segredo
N8N_AUTOPILOT_WEBHOOK_URL=https://SEU_N8N/webhook/mydatamed-autopilot
```

`N8N_AUTOPILOT_WEBHOOK_URL` é opcional. Se estiver vazio, os eventos ficam em `automation_events` para o n8n buscar por polling.

Para o primeiro ciclo, prefira polling. É mais fácil de auditar e evita depender de webhook exposto.

## 2. Endpoints disponíveis

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
```

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

## 3. Workflow JSON importável

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

## 4. Primeiro workflow recomendado no n8n

Nome: `MyDataMed Autopilot - Polling V1`

### Gatilho

Use um Cron a cada 5 minutos:

```http
GET https://mydatamed.com/api/automation/event?status=pending&limit=20
x-automation-secret: <AUTOMATION_API_SECRET>
```

### Processamento

Para cada evento retornado, chamar:

```http
POST https://mydatamed.com/api/automation/process-event
x-automation-secret: <AUTOMATION_API_SECRET>
```

```json
{
  "event_id": "{{$json.event.id}}"
}
```

## 5. O que cada evento faz agora

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

## 6. Teste manual sem ativar o workflow

1. Rode `SQL_AUTOMATION_EVENTS_V1.sql` no Supabase.
2. Configure `AUTOMATION_API_SECRET` no Netlify.
3. Solicite vínculo em `/meus-pacientes`.
4. Aprove no HealthWallet em `/care-links`.
5. Verifique se apareceu evento `care_link_approved` em `automation_events`.
6. No n8n, importe `mydatamed-autopilot-polling-v1.json`.
7. Troque `CHANGE_ME_AUTOMATION_API_SECRET` pelo segredo real.
8. Execute manualmente.
9. Verifique se o evento virou `processed` e se tarefas foram criadas no CRM.
10. Só depois ative o Schedule Trigger.

## 7. Regra de produto

O MyDataMed Autopilot coordena rotinas, lembretes, cobrança, documentos e preparação operacional. Ele não substitui decisão clínica do profissional habilitado.

Todos os fluxos devem respeitar consentimento, revogação e escopo autorizado pelo paciente.
