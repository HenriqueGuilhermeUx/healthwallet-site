-- HealthWallet Device Data Hub v1
-- Integra dados consentidos de smartwatches, pulseiras e dispositivos de saúde.
-- Objetivo: organizar histórico, alimentar MedScore/contexto do paciente e permitir compartilhamento controlado com profissionais.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.hw_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.hw_clamp_int(p_value numeric, p_min integer default 0, p_max integer default 100)
returns integer
language sql
immutable
as $$
  select greatest(p_min, least(p_max, round(coalesce(p_value, 0))::integer));
$$;

-- Score de contexto de dispositivo: não é diagnóstico, é um componente de tendência/completude.
-- Ele deve ser exibido como dado complementar e interpretado por profissional habilitado.
create or replace function public.calculate_device_context_score(
  p_steps integer default null,
  p_sleep_minutes integer default null,
  p_resting_heart_rate numeric default null,
  p_avg_heart_rate numeric default null,
  p_spo2_avg numeric default null,
  p_systolic_bp numeric default null,
  p_diastolic_bp numeric default null,
  p_weight_kg numeric default null,
  p_data_points integer default 0,
  p_last_sync_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_score numeric := 50;
  v_confidence integer := 0;
  v_factors jsonb := '[]'::jsonb;
  v_attention jsonb := '[]'::jsonb;
  v_last_sync_days integer := 999;
begin
  if p_last_sync_at is not null then
    v_last_sync_days := greatest(0, floor(extract(epoch from (now() - p_last_sync_at)) / 86400)::integer);
  end if;

  if p_steps is not null then
    v_confidence := v_confidence + 15;
    if p_steps >= 7000 then
      v_score := v_score + 10;
      v_factors := v_factors || jsonb_build_array('Bom volume de passos registrado no dia');
    elsif p_steps >= 4000 then
      v_score := v_score + 4;
      v_factors := v_factors || jsonb_build_array('Atividade física registrada');
    elsif p_steps < 2500 then
      v_score := v_score - 8;
      v_attention := v_attention || jsonb_build_array('Baixo volume de passos registrado');
    end if;
  end if;

  if p_sleep_minutes is not null then
    v_confidence := v_confidence + 20;
    if p_sleep_minutes between 420 and 540 then
      v_score := v_score + 10;
      v_factors := v_factors || jsonb_build_array('Sono registrado em faixa consistente');
    elsif p_sleep_minutes between 360 and 600 then
      v_score := v_score + 4;
      v_factors := v_factors || jsonb_build_array('Sono registrado no HealthWallet');
    elsif p_sleep_minutes < 300 or p_sleep_minutes > 660 then
      v_score := v_score - 8;
      v_attention := v_attention || jsonb_build_array('Sono fora da faixa habitual registrada');
    end if;
  end if;

  if p_resting_heart_rate is not null then
    v_confidence := v_confidence + 15;
    if p_resting_heart_rate between 45 and 80 then
      v_score := v_score + 6;
      v_factors := v_factors || jsonb_build_array('Frequência cardíaca de repouso registrada em faixa usual');
    elsif p_resting_heart_rate > 95 or p_resting_heart_rate < 40 then
      v_score := v_score - 8;
      v_attention := v_attention || jsonb_build_array('Frequência cardíaca de repouso merece revisão de contexto');
    else
      v_score := v_score + 1;
    end if;
  end if;

  if p_avg_heart_rate is not null then
    v_confidence := v_confidence + 5;
  end if;

  if p_spo2_avg is not null then
    v_confidence := v_confidence + 10;
    if p_spo2_avg >= 95 then
      v_score := v_score + 5;
      v_factors := v_factors || jsonb_build_array('SpO2 registrada em faixa usual');
    elsif p_spo2_avg < 92 then
      v_score := v_score - 8;
      v_attention := v_attention || jsonb_build_array('SpO2 registrada abaixo do habitual, requer interpretação profissional');
    else
      v_attention := v_attention || jsonb_build_array('SpO2 registrada merece acompanhamento de tendência');
    end if;
  end if;

  if p_systolic_bp is not null or p_diastolic_bp is not null then
    v_confidence := v_confidence + 15;
    if coalesce(p_systolic_bp, 0) >= 140 or coalesce(p_diastolic_bp, 0) >= 90 then
      v_score := v_score - 8;
      v_attention := v_attention || jsonb_build_array('Pressão arterial registrada merece revisão profissional');
    else
      v_score := v_score + 3;
      v_factors := v_factors || jsonb_build_array('Pressão arterial registrada');
    end if;
  end if;

  if p_weight_kg is not null then
    v_confidence := v_confidence + 5;
    v_factors := v_factors || jsonb_build_array('Peso registrado');
  end if;

  if coalesce(p_data_points, 0) >= 5 then
    v_confidence := v_confidence + 10;
    v_score := v_score + 4;
    v_factors := v_factors || jsonb_build_array('Boa cobertura de dados de dispositivo');
  elsif coalesce(p_data_points, 0) > 0 then
    v_confidence := v_confidence + 3;
  end if;

  if v_last_sync_days <= 2 then
    v_score := v_score + 4;
    v_factors := v_factors || jsonb_build_array('Dados sincronizados recentemente');
  elsif v_last_sync_days > 14 then
    v_score := v_score - 5;
    v_attention := v_attention || jsonb_build_array('Dados de dispositivo desatualizados');
  end if;

  return jsonb_build_object(
    'score', public.hw_clamp_int(v_score, 0, 100),
    'confidence', public.hw_clamp_int(v_confidence, 0, 100),
    'factors', v_factors,
    'attention', v_attention,
    'last_sync_days', v_last_sync_days,
    'disclaimer', 'Dados de dispositivos pessoais são complementares e não substituem avaliação profissional.'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabelas principais
-- -----------------------------------------------------------------------------

create table if not exists public.health_device_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_user_id text,
  display_name text,
  source_device text,
  status text not null default 'connected',
  scopes_authorized text[] not null default '{}',
  last_sync_at timestamptz,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint health_device_connections_provider_check check (provider in ('apple_health', 'health_connect', 'fitbit', 'garmin', 'oura', 'withings', 'polar', 'samsung_health', 'manual', 'other')),
  constraint health_device_connections_status_check check (status in ('connected', 'pending_setup', 'syncing', 'error', 'revoked'))
);

create index if not exists idx_health_device_connections_user on public.health_device_connections(user_id);
create index if not exists idx_health_device_connections_provider on public.health_device_connections(provider);
create unique index if not exists idx_health_device_connections_user_provider_active
  on public.health_device_connections(user_id, provider)
  where status <> 'revoked';

drop trigger if exists trg_health_device_connections_updated_at on public.health_device_connections;
create trigger trg_health_device_connections_updated_at
before update on public.health_device_connections
for each row execute function public.hw_set_updated_at();

create table if not exists public.health_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.health_device_connections(id) on delete set null,
  provider text not null default 'manual',
  source_device text,
  observation_type text not null,
  code text,
  value_numeric numeric,
  value_text text,
  unit text,
  observed_at timestamptz not null,
  start_time timestamptz,
  end_time timestamptz,
  external_id text,
  confidence text default 'patient_reported_or_device',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint health_observations_type_check check (observation_type in ('steps', 'sleep', 'heart_rate', 'resting_heart_rate', 'avg_heart_rate', 'spo2', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'weight', 'temperature', 'hrv', 'activity', 'calories_active', 'respiratory_rate', 'other'))
);

create index if not exists idx_health_observations_user_time on public.health_observations(user_id, observed_at desc);
create index if not exists idx_health_observations_user_type_time on public.health_observations(user_id, observation_type, observed_at desc);
create unique index if not exists idx_health_observations_external
  on public.health_observations(user_id, provider, external_id)
  where external_id is not null;

create table if not exists public.health_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null,
  sources text[] not null default '{}',
  data_points integer not null default 0,
  steps integer,
  sleep_minutes integer,
  resting_heart_rate numeric,
  avg_heart_rate numeric,
  hrv_avg numeric,
  spo2_avg numeric,
  systolic_bp numeric,
  diastolic_bp numeric,
  weight_kg numeric,
  temperature_c numeric,
  active_calories numeric,
  activity_minutes numeric,
  device_context_score integer,
  device_confidence integer,
  score_factors jsonb not null default '{}'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_daily_summaries_unique unique(user_id, summary_date)
);

create index if not exists idx_health_daily_summaries_user_date on public.health_daily_summaries(user_id, summary_date desc);

drop trigger if exists trg_health_daily_summaries_updated_at on public.health_daily_summaries;
create trigger trg_health_daily_summaries_updated_at
before update on public.health_daily_summaries
for each row execute function public.hw_set_updated_at();

create or replace function public.recalculate_health_daily_summary_score()
returns trigger
language plpgsql
as $$
declare
  v_score jsonb;
begin
  v_score := public.calculate_device_context_score(
    new.steps,
    new.sleep_minutes,
    new.resting_heart_rate,
    new.avg_heart_rate,
    new.spo2_avg,
    new.systolic_bp,
    new.diastolic_bp,
    new.weight_kg,
    new.data_points,
    coalesce(new.last_sync_at, now())
  );

  new.device_context_score := (v_score->>'score')::integer;
  new.device_confidence := (v_score->>'confidence')::integer;
  new.score_factors := v_score;
  return new;
end;
$$;

drop trigger if exists trg_health_daily_summaries_score on public.health_daily_summaries;
create trigger trg_health_daily_summaries_score
before insert or update on public.health_daily_summaries
for each row execute function public.recalculate_health_daily_summary_score();

create table if not exists public.health_data_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid,
  clinic_id uuid,
  care_link_id uuid,
  allowed_categories text[] not null default array['device_data', 'daily_summaries', 'medscore_context'],
  status text not null default 'active',
  purpose text default 'care_context',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint health_data_consents_status_check check (status in ('active', 'revoked', 'expired'))
);

create index if not exists idx_health_data_consents_patient on public.health_data_consents(patient_id, status);
create index if not exists idx_health_data_consents_professional on public.health_data_consents(professional_id, status);
create index if not exists idx_health_data_consents_care_link on public.health_data_consents(care_link_id);

drop trigger if exists trg_health_data_consents_updated_at on public.health_data_consents;
create trigger trg_health_data_consents_updated_at
before update on public.health_data_consents
for each row execute function public.hw_set_updated_at();

create table if not exists public.health_data_audit_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid,
  actor_role text not null default 'patient',
  action text not null,
  data_category text,
  reason text,
  source_app text default 'healthwallet',
  reference_table text,
  reference_id uuid,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_health_data_audit_patient_time on public.health_data_audit_logs(patient_id, created_at desc);
create index if not exists idx_health_data_audit_actor_time on public.health_data_audit_logs(actor_user_id, created_at desc);

-- Health score existente do app: prepara colunas para que o score também receba contexto de dispositivos.
create table if not exists public.health_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  status text,
  factors jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.health_scores add column if not exists device_context_score integer;
alter table public.health_scores add column if not exists device_confidence integer;
alter table public.health_scores add column if not exists device_context jsonb not null default '{}'::jsonb;
alter table public.health_scores add column if not exists source_categories text[] not null default '{}';
alter table public.health_scores add column if not exists score_version text not null default 'medscore_v1';

create index if not exists idx_health_scores_user_calculated on public.health_scores(user_id, calculated_at desc);

create or replace view public.patient_device_score_latest as
select distinct on (hds.user_id)
  hds.user_id,
  hds.summary_date,
  hds.device_context_score,
  hds.device_confidence,
  hds.score_factors,
  hds.steps,
  hds.sleep_minutes,
  hds.resting_heart_rate,
  hds.avg_heart_rate,
  hds.spo2_avg,
  hds.systolic_bp,
  hds.diastolic_bp,
  hds.weight_kg,
  hds.sources,
  hds.last_sync_at,
  hds.updated_at
from public.health_daily_summaries hds
order by hds.user_id, hds.summary_date desc, hds.updated_at desc;

create or replace function public.upsert_health_daily_summary(
  p_user_id uuid,
  p_summary_date date,
  p_sources text[] default '{}',
  p_data_points integer default 0,
  p_steps integer default null,
  p_sleep_minutes integer default null,
  p_resting_heart_rate numeric default null,
  p_avg_heart_rate numeric default null,
  p_hrv_avg numeric default null,
  p_spo2_avg numeric default null,
  p_systolic_bp numeric default null,
  p_diastolic_bp numeric default null,
  p_weight_kg numeric default null,
  p_temperature_c numeric default null,
  p_active_calories numeric default null,
  p_activity_minutes numeric default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not_allowed';
  end if;

  insert into public.health_daily_summaries (
    user_id,
    summary_date,
    sources,
    data_points,
    steps,
    sleep_minutes,
    resting_heart_rate,
    avg_heart_rate,
    hrv_avg,
    spo2_avg,
    systolic_bp,
    diastolic_bp,
    weight_kg,
    temperature_c,
    active_calories,
    activity_minutes,
    metadata,
    last_sync_at
  ) values (
    p_user_id,
    p_summary_date,
    coalesce(p_sources, '{}'),
    coalesce(p_data_points, 0),
    p_steps,
    p_sleep_minutes,
    p_resting_heart_rate,
    p_avg_heart_rate,
    p_hrv_avg,
    p_spo2_avg,
    p_systolic_bp,
    p_diastolic_bp,
    p_weight_kg,
    p_temperature_c,
    p_active_calories,
    p_activity_minutes,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (user_id, summary_date)
  do update set
    sources = array(select distinct unnest(coalesce(public.health_daily_summaries.sources, '{}') || coalesce(excluded.sources, '{}'))),
    data_points = greatest(public.health_daily_summaries.data_points, excluded.data_points),
    steps = coalesce(excluded.steps, public.health_daily_summaries.steps),
    sleep_minutes = coalesce(excluded.sleep_minutes, public.health_daily_summaries.sleep_minutes),
    resting_heart_rate = coalesce(excluded.resting_heart_rate, public.health_daily_summaries.resting_heart_rate),
    avg_heart_rate = coalesce(excluded.avg_heart_rate, public.health_daily_summaries.avg_heart_rate),
    hrv_avg = coalesce(excluded.hrv_avg, public.health_daily_summaries.hrv_avg),
    spo2_avg = coalesce(excluded.spo2_avg, public.health_daily_summaries.spo2_avg),
    systolic_bp = coalesce(excluded.systolic_bp, public.health_daily_summaries.systolic_bp),
    diastolic_bp = coalesce(excluded.diastolic_bp, public.health_daily_summaries.diastolic_bp),
    weight_kg = coalesce(excluded.weight_kg, public.health_daily_summaries.weight_kg),
    temperature_c = coalesce(excluded.temperature_c, public.health_daily_summaries.temperature_c),
    active_calories = coalesce(excluded.active_calories, public.health_daily_summaries.active_calories),
    activity_minutes = coalesce(excluded.activity_minutes, public.health_daily_summaries.activity_minutes),
    metadata = public.health_daily_summaries.metadata || excluded.metadata,
    last_sync_at = now(),
    updated_at = now()
  returning id into v_id;

  insert into public.health_data_audit_logs (
    patient_id,
    actor_user_id,
    actor_role,
    action,
    data_category,
    source_app,
    reference_table,
    reference_id,
    metadata
  ) values (
    p_user_id,
    coalesce(auth.uid(), p_user_id),
    'patient',
    'device_daily_summary_upserted',
    'device_data',
    'healthwallet',
    'health_daily_summaries',
    v_id,
    jsonb_build_object('summary_date', p_summary_date, 'sources', p_sources)
  );

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.health_device_connections enable row level security;
alter table public.health_observations enable row level security;
alter table public.health_daily_summaries enable row level security;
alter table public.health_data_consents enable row level security;
alter table public.health_data_audit_logs enable row level security;
alter table public.health_scores enable row level security;

drop policy if exists "Patients can select own device connections" on public.health_device_connections;
create policy "Patients can select own device connections"
  on public.health_device_connections for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can manage own device connections" on public.health_device_connections;
create policy "Patients can manage own device connections"
  on public.health_device_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Patients can select own observations" on public.health_observations;
create policy "Patients can select own observations"
  on public.health_observations for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can manage own observations" on public.health_observations;
create policy "Patients can manage own observations"
  on public.health_observations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Patients can select own daily summaries" on public.health_daily_summaries;
create policy "Patients can select own daily summaries"
  on public.health_daily_summaries for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can manage own daily summaries" on public.health_daily_summaries;
create policy "Patients can manage own daily summaries"
  on public.health_daily_summaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Patients can select own device consents" on public.health_data_consents;
create policy "Patients can select own device consents"
  on public.health_data_consents for select
  using (auth.uid() = patient_id);

drop policy if exists "Patients can manage own device consents" on public.health_data_consents;
create policy "Patients can manage own device consents"
  on public.health_data_consents for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

drop policy if exists "Patients can select own audit logs" on public.health_data_audit_logs;
create policy "Patients can select own audit logs"
  on public.health_data_audit_logs for select
  using (auth.uid() = patient_id);

drop policy if exists "Patients can insert own audit logs" on public.health_data_audit_logs;
create policy "Patients can insert own audit logs"
  on public.health_data_audit_logs for insert
  with check (auth.uid() = patient_id or auth.uid() = actor_user_id);

drop policy if exists "Patients can select own health scores" on public.health_scores;
create policy "Patients can select own health scores"
  on public.health_scores for select
  using (auth.uid() = user_id);

drop policy if exists "Patients can insert own health scores" on public.health_scores;
create policy "Patients can insert own health scores"
  on public.health_scores for insert
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.health_device_connections to authenticated;
grant select, insert, update, delete on public.health_observations to authenticated;
grant select, insert, update, delete on public.health_daily_summaries to authenticated;
grant select, insert, update, delete on public.health_data_consents to authenticated;
grant select, insert on public.health_data_audit_logs to authenticated;
grant select, insert on public.health_scores to authenticated;
grant select on public.patient_device_score_latest to authenticated;
grant execute on function public.calculate_device_context_score(integer, integer, numeric, numeric, numeric, numeric, numeric, numeric, integer, timestamptz) to authenticated;
grant execute on function public.upsert_health_daily_summary(uuid, date, text[], integer, integer, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) to authenticated;
