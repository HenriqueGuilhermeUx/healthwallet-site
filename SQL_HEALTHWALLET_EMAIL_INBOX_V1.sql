-- HealthWallet Email Inbox v1
-- Permite que pacientes encaminhem exames, laudos, receitas e documentos de saúde para um e-mail único da HealthWallet.
-- Fluxo: e-mail recebido -> anexos salvos -> caixa de entrada pendente -> paciente revisa -> adiciona à carteira.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.hw_email_inbox_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Endereços únicos por usuário
-- -----------------------------------------------------------------------------

create table if not exists public.health_inbound_email_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_address text not null unique,
  local_part text not null unique,
  token text not null unique,
  domain text not null default 'exames.healthwallet.pro',
  status text not null default 'active',
  purpose text not null default 'exam_inbox',
  forwarding_verified boolean not null default false,
  forwarding_verified_at timestamptz,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint health_inbound_email_addresses_status_check check (status in ('active', 'paused', 'revoked'))
);

create index if not exists idx_health_inbound_email_addresses_user on public.health_inbound_email_addresses(user_id, status);
create index if not exists idx_health_inbound_email_addresses_token on public.health_inbound_email_addresses(token);

create unique index if not exists idx_health_inbound_email_addresses_user_active
  on public.health_inbound_email_addresses(user_id)
  where status = 'active' and purpose = 'exam_inbox';

drop trigger if exists trg_health_inbound_email_addresses_updated_at on public.health_inbound_email_addresses;
create trigger trg_health_inbound_email_addresses_updated_at
before update on public.health_inbound_email_addresses
for each row execute function public.hw_email_inbox_set_updated_at();

-- -----------------------------------------------------------------------------
-- Caixa de entrada de documentos recebidos por e-mail
-- -----------------------------------------------------------------------------

create table if not exists public.health_document_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inbound_email_id uuid references public.health_inbound_email_addresses(id) on delete set null,
  source text not null default 'email_forward',
  provider text,
  provider_message_id text,
  from_email text,
  from_name text,
  recipient_email text,
  subject text,
  body_preview text,
  received_at timestamptz not null default now(),
  status text not null default 'pending_review',
  suggested_document_type text,
  suggested_laboratory text,
  storage_bucket text,
  storage_path text,
  file_url text,
  file_name text,
  original_file_name text,
  mime_type text,
  file_size integer,
  attachment_sha256 text,
  approved_medical_record_id uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_document_inbox_status_check check (status in ('pending_review', 'approved', 'rejected', 'duplicate', 'processing_error'))
);

create index if not exists idx_health_document_inbox_user_status on public.health_document_inbox(user_id, status, received_at desc);
create index if not exists idx_health_document_inbox_user_received on public.health_document_inbox(user_id, received_at desc);
create index if not exists idx_health_document_inbox_sender on public.health_document_inbox(from_email);
create index if not exists idx_health_document_inbox_message on public.health_document_inbox(provider_message_id);
create index if not exists idx_health_document_inbox_hash on public.health_document_inbox(user_id, attachment_sha256);

create unique index if not exists idx_health_document_inbox_user_attachment_hash
  on public.health_document_inbox(user_id, attachment_sha256)
  where attachment_sha256 is not null;

drop trigger if exists trg_health_document_inbox_updated_at on public.health_document_inbox;
create trigger trg_health_document_inbox_updated_at
before update on public.health_document_inbox
for each row execute function public.hw_email_inbox_set_updated_at();

create table if not exists public.health_document_inbox_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  inbox_item_id uuid references public.health_document_inbox(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid,
  actor_role text not null default 'system',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_health_document_inbox_events_user_time on public.health_document_inbox_events(user_id, created_at desc);
create index if not exists idx_health_document_inbox_events_item_time on public.health_document_inbox_events(inbox_item_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------

create or replace function public.ensure_health_inbound_email_address(
  p_user_id uuid default auth.uid(),
  p_domain text default 'exames.healthwallet.pro'
)
returns public.health_inbound_email_addresses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.health_inbound_email_addresses;
  v_token text;
  v_local_part text;
  v_email text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not_allowed';
  end if;

  select * into v_row
  from public.health_inbound_email_addresses
  where user_id = p_user_id
    and status = 'active'
    and purpose = 'exam_inbox'
  order by created_at desc
  limit 1;

  if found then
    return v_row;
  end if;

  loop
    v_token := lower(substr(encode(gen_random_bytes(9), 'hex'), 1, 14));
    v_local_part := 'exames-' || v_token;
    v_email := v_local_part || '@' || lower(coalesce(nullif(p_domain, ''), 'exames.healthwallet.pro'));

    exit when not exists (
      select 1 from public.health_inbound_email_addresses where token = v_token or email_address = v_email
    );
  end loop;

  insert into public.health_inbound_email_addresses (
    user_id,
    email_address,
    local_part,
    token,
    domain,
    purpose,
    metadata
  ) values (
    p_user_id,
    v_email,
    v_local_part,
    v_token,
    lower(coalesce(nullif(p_domain, ''), 'exames.healthwallet.pro')),
    'exam_inbox',
    jsonb_build_object(
      'created_by', 'healthwallet_app',
      'patient_controlled', true,
      'requires_review_before_wallet', true
    )
  )
  returning * into v_row;

  insert into public.health_document_inbox_events (
    user_id,
    event_type,
    actor_user_id,
    actor_role,
    description,
    metadata
  ) values (
    p_user_id,
    'inbound_email_created',
    p_user_id,
    'patient',
    'Endereço de entrada de exames criado para o paciente.',
    jsonb_build_object('email_address', v_email)
  );

  return v_row;
end;
$$;

create or replace function public.mark_health_inbox_forwarding_verified(
  p_inbound_email_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.health_inbound_email_addresses
  set forwarding_verified = true,
      forwarding_verified_at = now(),
      updated_at = now()
  where id = p_inbound_email_id
    and user_id = auth.uid();

  return found;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.health_inbound_email_addresses enable row level security;
alter table public.health_document_inbox enable row level security;
alter table public.health_document_inbox_events enable row level security;

drop policy if exists "Patients can select own inbound email" on public.health_inbound_email_addresses;
create policy "Patients can select own inbound email"
  on public.health_inbound_email_addresses for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can update own inbound email" on public.health_inbound_email_addresses;
create policy "Patients can update own inbound email"
  on public.health_inbound_email_addresses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Patients can select own document inbox" on public.health_document_inbox;
create policy "Patients can select own document inbox"
  on public.health_document_inbox for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can update own document inbox" on public.health_document_inbox;
create policy "Patients can update own document inbox"
  on public.health_document_inbox for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Patients can select own document inbox events" on public.health_document_inbox_events;
create policy "Patients can select own document inbox events"
  on public.health_document_inbox_events for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can insert own document inbox events" on public.health_document_inbox_events;
create policy "Patients can insert own document inbox events"
  on public.health_document_inbox_events for insert
  with check (auth.uid() = user_id or auth.uid() = actor_user_id);

grant select, update on public.health_inbound_email_addresses to authenticated;
grant select, update on public.health_document_inbox to authenticated;
grant select, insert on public.health_document_inbox_events to authenticated;
grant execute on function public.ensure_health_inbound_email_address(uuid, text) to authenticated;
grant execute on function public.mark_health_inbox_forwarding_verified(uuid) to authenticated;