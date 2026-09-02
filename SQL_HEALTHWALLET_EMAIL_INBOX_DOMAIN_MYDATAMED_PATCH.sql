-- HealthWallet Email Inbox - Patch de domínio para MyDataMed
-- Use este arquivo se você não possui healthwallet.pro.
-- Domínio de entrada recomendado: exames.mydatamed.com
-- Endpoint que recebe os e-mails: https://mydatamed.com/api/inbound/exam-email

begin;

-- Atualiza o domínio padrão da coluna para novos registros criados fora do app.
alter table if exists public.health_inbound_email_addresses
  alter column domain set default 'exames.mydatamed.com';

-- Atualiza endereços já criados com o domínio antigo inexistente.
update public.health_inbound_email_addresses
set
  domain = 'exames.mydatamed.com',
  email_address = local_part || '@exames.mydatamed.com',
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'domain_patch', 'mydatamed',
    'previous_domain', 'exames.healthwallet.pro',
    'patched_at', now()
  )
where
  domain = 'exames.healthwallet.pro'
  or email_address like '%@exames.healthwallet.pro';

-- Recria a função principal com MyDataMed como fallback padrão.
create or replace function public.ensure_health_inbound_email_address(
  p_user_id uuid default auth.uid(),
  p_domain text default 'exames.mydatamed.com'
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
  v_domain text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not_allowed';
  end if;

  v_domain := lower(coalesce(nullif(p_domain, ''), 'exames.mydatamed.com'));

  select * into v_row
  from public.health_inbound_email_addresses
  where user_id = p_user_id
    and status = 'active'
    and purpose = 'exam_inbox'
  order by created_at desc
  limit 1;

  if found then
    if v_row.domain <> v_domain or v_row.email_address <> (v_row.local_part || '@' || v_domain) then
      update public.health_inbound_email_addresses
      set
        domain = v_domain,
        email_address = local_part || '@' || v_domain,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'domain_refreshed_by', 'ensure_health_inbound_email_address',
          'refreshed_at', now()
        )
      where id = v_row.id
      returning * into v_row;
    end if;

    return v_row;
  end if;

  loop
    v_token := lower(substr(encode(gen_random_bytes(9), 'hex'), 1, 14));
    v_local_part := 'exames-' || v_token;
    v_email := v_local_part || '@' || v_domain;

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
    v_domain,
    'exam_inbox',
    jsonb_build_object(
      'created_by', 'healthwallet_app',
      'patient_controlled', true,
      'requires_review_before_wallet', true,
      'domain_owner', 'mydatamed.com'
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

grant execute on function public.ensure_health_inbound_email_address(uuid, text) to authenticated;

commit;
