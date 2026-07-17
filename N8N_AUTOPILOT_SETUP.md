# MyDataMed Autopilot + n8n

Este documento descreve o primeiro fluxo operacional para usar o n8n hospedado no Oracle como orquestrador do MyDataMed / HealthWallet.

## 1. Variáveis recomendadas no Netlify

```env
AUTOMATION_API_SECRET=crie_um_segredo_forte
N8N_AUTOPILOT_SECRET=o_mesmo_ou_outro_segredo
N8N_AUTOPILOT_WEBHOOK_URL=https://SEU_N8N/webhook/mydatamed-autopilot
```

`N8N_AUTOPILOT_WEBHOOK_URL` é opcional. Se estiver vazio, os eventos ficam em `automation_events` para o n8n buscar por polling.

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

### Marcar evento como processado

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

## 3. Primeiro workflow recomendado no n8n

Nome: `MyDataMed Autopilot - Care Link Approved`

### Gatilho

Use um Cron a cada 1 ou 5 minutos:

```http
GET https://mydatamed.com/api/automation/event?status=pending&limit=20
x-automation-secret: <AUTOMATION_API_SECRET>
```

### Filtro

Processar eventos:

```text
care_link_approved
smartbots_task_created
care_link_revoked
```

### Ações iniciais por tipo

#### care_link_approved

1. Criar/atualizar contato no CRM.
2. Criar checklist inicial.
3. Avisar profissional.
4. Programar follow-up em 7 dias.
5. Checar dados faltantes: exames, medicamentos, alergias, CNS/UBS, Passport.

#### smartbots_task_created

1. Ler tarefa criada.
2. Enviar mensagem, e-mail ou WhatsApp quando o canal estiver configurado.
3. Atualizar status da tarefa.
4. Registrar log.

#### care_link_revoked

1. Interromper automações futuras desse vínculo.
2. Avisar profissional.
3. Marcar tarefas relacionadas como canceladas quando aplicável.

## 4. Marcação de conclusão

Depois de processar, chamar:

```http
PATCH https://mydatamed.com/api/automation/event
x-automation-secret: <AUTOMATION_API_SECRET>
```

```json
{
  "id": "{{$json.id}}",
  "status": "processed",
  "metadata": {
    "processed_by": "n8n",
    "workflow": "mydatamed_autopilot_v1"
  }
}
```

## 5. Regra de produto

O MyDataMed Autopilot coordena rotinas, lembretes, cobrança, documentos e preparação operacional. Ele não substitui decisão clínica do profissional habilitado.
