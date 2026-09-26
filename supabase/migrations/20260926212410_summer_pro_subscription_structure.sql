-- Summer Treinos: consolida Summer Gratis / Summer PRO e o fluxo PIX manual.
-- A liberacao continua sendo confirmada no banco por um administrador. O
-- frontend nunca consegue promover a propria conta.
begin;

-- Mantemos as colunas antigas para que uma versao anterior do app continue
-- funcionando durante o deploy. As novas colunas sao a fonte de verdade.
alter table public.summer_subscriptions
  add column if not exists subscription_status text,
  add column if not exists subscription_plan text,
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscription_updated_at timestamptz;

update public.summer_subscriptions
set subscription_status = coalesce(
      subscription_status,
      case when expires_at > now() then 'pro' else 'expired' end
    ),
    subscription_plan = coalesce(subscription_plan, 'monthly'),
    subscription_started_at = coalesce(
      subscription_started_at,
      least(coalesce(updated_at, now()), expires_at)
    ),
    subscription_expires_at = coalesce(subscription_expires_at, expires_at),
    subscription_updated_at = coalesce(subscription_updated_at, updated_at, now());

alter table public.summer_subscriptions
  alter column subscription_status set not null,
  alter column subscription_plan set not null,
  alter column subscription_started_at set not null,
  alter column subscription_expires_at set not null,
  alter column subscription_updated_at set not null,
  alter column subscription_updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'summer_subscriptions_status_check'
      and conrelid = 'public.summer_subscriptions'::regclass
  ) then
    alter table public.summer_subscriptions
      add constraint summer_subscriptions_status_check
      check (subscription_status in ('free', 'pro', 'expired', 'cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'summer_subscriptions_plan_check'
      and conrelid = 'public.summer_subscriptions'::regclass
  ) then
    alter table public.summer_subscriptions
      add constraint summer_subscriptions_plan_check
      check (subscription_plan in ('monthly', 'annual'));
  end if;
end $$;

create table if not exists summer_private.plan_config (
  singleton boolean primary key default true check (singleton),
  free_price_cents integer not null default 0 check (free_price_cents = 0),
  pro_monthly_price_cents integer not null default 1490
    check (pro_monthly_price_cents between 100 and 1000000),
  pro_annual_price_cents integer not null default 11990
    check (pro_annual_price_cents between 100 and 10000000),
  promotional_monthly_price_cents integer not null default 990
    check (promotional_monthly_price_cents between 100 and 1000000),
  promotion_active boolean not null default false,
  pix_key text not null check (length(trim(pix_key)) between 3 and 160),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into summer_private.plan_config(
  singleton,
  free_price_cents,
  pro_monthly_price_cents,
  pro_annual_price_cents,
  promotional_monthly_price_cents,
  promotion_active,
  pix_key
) values (
  true,
  0,
  1490,
  11990,
  990,
  false,
  'b3a68789-7fae-426c-b17d-049f22dbdb33'
) on conflict (singleton) do update set
  pro_monthly_price_cents = excluded.pro_monthly_price_cents,
  pro_annual_price_cents = excluded.pro_annual_price_cents,
  promotional_monthly_price_cents = excluded.promotional_monthly_price_cents,
  pix_key = excluded.pix_key,
  updated_at = now();
alter table summer_private.plan_config enable row level security;
revoke all on summer_private.plan_config from public, anon, authenticated;

create table if not exists public.summer_subscription_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_plan text not null
    check (subscription_plan in ('monthly', 'annual')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index if not exists summer_subscription_requests_user_created
  on public.summer_subscription_requests(user_id, created_at desc);
create unique index if not exists summer_subscription_requests_one_pending
  on public.summer_subscription_requests(user_id)
  where status = 'pending';
alter table public.summer_subscription_requests enable row level security;
revoke all on public.summer_subscription_requests from public, anon, authenticated;
grant select on public.summer_subscription_requests to authenticated;
drop policy if exists summer_subscription_requests_read on public.summer_subscription_requests;
create policy summer_subscription_requests_read
  on public.summer_subscription_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.summer_is_admin())
  );

alter table summer_private.plan_audit
  add column if not exists old_subscription_status text,
  add column if not exists new_subscription_status text,
  add column if not exists old_subscription_plan text,
  add column if not exists new_subscription_plan text,
  add column if not exists request_id bigint,
  add column if not exists amount_cents integer;

create or replace function summer_private.plan_config()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'free_price_cents', c.free_price_cents,
    'pro_monthly_price_cents', c.pro_monthly_price_cents,
    'pro_annual_price_cents', c.pro_annual_price_cents,
    'promotional_monthly_price_cents', c.promotional_monthly_price_cents,
    'promotion_active', c.promotion_active,
    'pix_key', c.pix_key,
    'annual_savings_cents', greatest(
      0,
      c.pro_monthly_price_cents * 12 - c.pro_annual_price_cents
    ),
    'updated_at', c.updated_at
  ) into result
  from summer_private.plan_config c where c.singleton;
  return result;
end;
$$;
revoke all on function summer_private.plan_config() from public, anon;
grant execute on function summer_private.plan_config() to authenticated;

create or replace function public.summer_get_plan_config()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select summer_private.plan_config();
$$;
revoke all on function public.summer_get_plan_config() from public, anon;
grant execute on function public.summer_get_plan_config() to authenticated;

create or replace function public.summer_get_access()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(
    (
      select jsonb_build_object(
        'is_admin', public.summer_is_admin(),
        'subscription_status', case
          when s.subscription_status = 'pro'
            and s.subscription_expires_at > now() then 'pro'
          when s.subscription_status = 'cancelled' then 'cancelled'
          else 'expired'
        end,
        'subscription_plan', s.subscription_plan,
        'subscription_started_at', s.subscription_started_at,
        'subscription_expires_at', s.subscription_expires_at,
        'subscription_updated_at', s.subscription_updated_at,
        -- Compatibility for the already-published client.
        'plan', case
          when s.subscription_status = 'pro'
            and s.subscription_expires_at > now() then 'plus'
          else 'basic'
        end,
        'expires_at', s.subscription_expires_at,
        'server_time', now()
      )
      from public.summer_subscriptions s
      where s.user_id = (select auth.uid())
    ),
    jsonb_build_object(
      'is_admin', public.summer_is_admin(),
      'subscription_status', 'free',
      'subscription_plan', null,
      'subscription_started_at', null,
      'subscription_expires_at', null,
      'subscription_updated_at', null,
      'plan', 'basic',
      'expires_at', null,
      'server_time', now()
    )
  );
$$;

create or replace function public.summer_has_pro_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.summer_subscriptions s
    where s.user_id = (select auth.uid())
      and s.subscription_status = 'pro'
      and s.subscription_expires_at > now()
  );
$$;
revoke all on function public.summer_has_pro_access() from public, anon;
grant execute on function public.summer_has_pro_access() to authenticated;

-- Compatibility with the existing nutrition RLS policies.
create or replace function public.summer_has_paid_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.summer_has_pro_access();
$$;

create or replace function summer_private.admin_students(
  p_search text default '',
  p_status text default 'all',
  p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_page < 0 or p_page > 100000 or length(p_search) > 120
    or p_status not in (
      'all', 'pro', 'active', 'expiring', 'expired', 'free', 'basic', 'cancelled'
    ) then
    raise exception 'Filtro invalido';
  end if;
  with students as (
    select
      u.id,
      u.email,
      coalesce(u.raw_user_meta_data ->> 'name', '') as name,
      coalesce(
        u.raw_user_meta_data ->> 'matricula',
        u.raw_user_meta_data ->> 'registration',
        ''
      ) as registration,
      u.created_at,
      u.email_confirmed_at is not null as confirmed,
      case
        when s.subscription_status = 'pro'
          and s.subscription_expires_at > now() then 'pro'
        when s.subscription_status = 'cancelled' then 'cancelled'
        when s.user_id is not null then 'expired'
        else 'free'
      end as subscription_status,
      s.subscription_plan,
      s.subscription_started_at,
      s.subscription_expires_at,
      s.subscription_updated_at,
      case
        when s.subscription_status = 'pro'
          and s.subscription_expires_at > now() then 'plus'
        else 'basic'
      end as plan,
      s.subscription_expires_at as expires_at,
      pr.pending_request
    from auth.users u
    left join public.summer_subscriptions s on s.user_id = u.id
    left join lateral (
      select jsonb_build_object(
        'id', r.id,
        'subscription_plan', r.subscription_plan,
        'amount_cents', r.amount_cents,
        'status', r.status,
        'created_at', r.created_at
      ) as pending_request
      from public.summer_subscription_requests r
      where r.user_id = u.id and r.status = 'pending'
      order by r.created_at desc
      limit 1
    ) pr on true
    where u.deleted_at is null
      and not exists (
        select 1 from summer_private.admin_emails a
        where a.email = lower(u.email)
      )
  ), filtered as (
    select * from students s where
      (
        p_search = ''
        or strpos(lower(s.email), lower(p_search)) > 0
        or strpos(lower(s.name), lower(p_search)) > 0
        or strpos(s.registration, p_search) > 0
      )
      and (
        p_status = 'all'
        or p_status = s.subscription_status
        or (p_status = 'active' and s.subscription_status = 'pro')
        or (p_status = 'basic' and s.subscription_status = 'free')
        or (
          p_status = 'expiring'
          and s.subscription_status = 'pro'
          and s.subscription_expires_at <= now() + interval '7 days'
        )
      )
  ), page as (
    select * from filtered
    order by created_at desc, id
    limit 20 offset (p_page * 20)
  )
  select jsonb_build_object(
    'students', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id) from page p),
      '[]'::jsonb
    ),
    'total', (select count(*) from filtered),
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where subscription_status = 'pro'),
        'pro', count(*) filter (where subscription_status = 'pro'),
        'expiring', count(*) filter (
          where subscription_status = 'pro'
            and subscription_expires_at <= now() + interval '7 days'
        ),
        'expired', count(*) filter (where subscription_status = 'expired'),
        'free', count(*) filter (where subscription_status = 'free'),
        'basic', count(*) filter (where subscription_status = 'free'),
        'cancelled', count(*) filter (where subscription_status = 'cancelled')
      ) from students
    ),
    'server_time', now()
  ) into result;
  return result;
end;
$$;

create or replace function public.summer_admin_students(
  p_search text default '',
  p_status text default 'all',
  p_page integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select summer_private.admin_students(p_search, p_status, p_page);
$$;
revoke all on function public.summer_admin_students(text,text,integer)
  from public, anon;
grant execute on function public.summer_admin_students(text,text,integer)
  to authenticated;

create or replace function summer_private.admin_set_subscription(
  p_user_id uuid,
  p_subscription_plan text,
  p_action text default 'grant'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous public.summer_subscriptions;
  new_status text;
  new_started_at timestamptz;
  new_expiration timestamptz;
  duration interval;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_subscription_plan not in ('monthly', 'annual')
    or p_action not in ('grant', 'renew', 'revoke')
    or p_subscription_plan is null or p_action is null then
    raise exception 'Plano ou acao invalidos';
  end if;
  perform 1 from auth.users
    where id = p_user_id and deleted_at is null and email_confirmed_at is not null
    for update;
  if not found then
    raise exception 'Aluno nao encontrado ou e-mail ainda nao confirmado';
  end if;
  if exists (
    select 1 from auth.users u
    join summer_private.admin_emails a on a.email = lower(u.email)
    where u.id = p_user_id
  ) then
    raise exception 'Selecione uma conta de aluno';
  end if;

  select * into previous from public.summer_subscriptions
    where user_id = p_user_id for update;

  if p_action = 'revoke' then
    if previous.user_id is null then
      raise exception 'Este aluno nao possui assinatura para cancelar';
    end if;
    new_status := 'cancelled';
    p_subscription_plan := previous.subscription_plan;
    new_started_at := previous.subscription_started_at;
    new_expiration := now();
  else
    duration := case
      when p_subscription_plan = 'annual' then interval '1 year'
      else interval '1 month'
    end;
    new_status := 'pro';
    new_started_at := case
      when previous.subscription_status = 'pro'
        and previous.subscription_expires_at > now()
        then previous.subscription_started_at
      else now()
    end;
    new_expiration := greatest(
      now(),
      case
        when previous.subscription_status = 'pro'
          then coalesce(previous.subscription_expires_at, now())
        else now()
      end
    ) + duration;
  end if;

  insert into public.summer_subscriptions(
    user_id,
    plan,
    expires_at,
    updated_at,
    updated_by,
    subscription_status,
    subscription_plan,
    subscription_started_at,
    subscription_expires_at,
    subscription_updated_at
  ) values (
    p_user_id,
    'plus',
    new_expiration,
    now(),
    auth.uid(),
    new_status,
    p_subscription_plan,
    new_started_at,
    new_expiration,
    now()
  ) on conflict (user_id) do update set
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    updated_at = now(),
    updated_by = excluded.updated_by,
    subscription_status = excluded.subscription_status,
    subscription_plan = excluded.subscription_plan,
    subscription_started_at = excluded.subscription_started_at,
    subscription_expires_at = excluded.subscription_expires_at,
    subscription_updated_at = now();

  insert into summer_private.plan_audit(
    admin_id,
    student_id,
    action,
    old_plan,
    new_plan,
    old_expires_at,
    new_expires_at,
    old_subscription_status,
    new_subscription_status,
    old_subscription_plan,
    new_subscription_plan
  ) values (
    auth.uid(),
    p_user_id,
    p_action,
    previous.plan,
    'plus',
    previous.subscription_expires_at,
    new_expiration,
    previous.subscription_status,
    new_status,
    previous.subscription_plan,
    p_subscription_plan
  );

  return jsonb_build_object(
    'subscription_status', new_status,
    'subscription_plan', p_subscription_plan,
    'subscription_started_at', new_started_at,
    'subscription_expires_at', new_expiration
  );
end;
$$;
revoke all on function summer_private.admin_set_subscription(uuid,text,text)
  from public, anon, authenticated;
grant execute on function summer_private.admin_set_subscription(uuid,text,text)
  to authenticated;

create or replace function public.summer_admin_set_subscription(
  p_user_id uuid,
  p_subscription_plan text,
  p_action text default 'grant'
) returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.admin_set_subscription(
    p_user_id,
    p_subscription_plan,
    p_action
  );
$$;
revoke all on function public.summer_admin_set_subscription(uuid,text,text)
  from public, anon;
grant execute on function public.summer_admin_set_subscription(uuid,text,text)
  to authenticated;

-- Keep the old RPC callable while clients update. Both old paid plans map to
-- the single Summer PRO monthly plan.
create or replace function summer_private.admin_set_plan(
  p_user_id uuid,
  p_plan text,
  p_action text default 'grant'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_plan not in ('premium', 'plus') then
    raise exception 'Plano invalido';
  end if;
  return summer_private.admin_set_subscription(
    p_user_id,
    'monthly',
    p_action
  );
end;
$$;
revoke all on function summer_private.admin_set_plan(uuid,text,text)
  from public, anon, authenticated;
grant execute on function summer_private.admin_set_plan(uuid,text,text)
  to authenticated;

create or replace function public.summer_admin_set_plan(
  p_user_id uuid,
  p_plan text,
  p_action text default 'grant'
) returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.admin_set_plan(p_user_id, p_plan, p_action);
$$;

create or replace function summer_private.request_subscription(
  p_subscription_plan text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  amount_value integer;
  request_id bigint;
  existing_plan text;
  config_result jsonb;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;
  if p_subscription_plan not in ('monthly', 'annual')
    or p_subscription_plan is null then
    raise exception 'Plano invalido';
  end if;
  perform 1 from auth.users
    where id = account_id and deleted_at is null and email_confirmed_at is not null
    for update;
  if not found then
    raise exception 'Confirme seu e-mail antes de solicitar o Summer PRO';
  end if;

  select
    case
      when p_subscription_plan = 'annual' then c.pro_annual_price_cents
      when c.promotion_active then c.promotional_monthly_price_cents
      else c.pro_monthly_price_cents
    end
  into amount_value
  from summer_private.plan_config c where c.singleton;

  select r.id, r.subscription_plan into request_id, existing_plan
  from public.summer_subscription_requests r
  where r.user_id = account_id and r.status = 'pending'
  for update;

  if request_id is not null and existing_plan = p_subscription_plan then
    config_result := summer_private.plan_config();
    return config_result || jsonb_build_object(
      'request_id', request_id,
      'subscription_plan', existing_plan,
      'amount_cents', amount_value,
      'status', 'pending'
    );
  end if;

  if request_id is not null then
    update public.summer_subscription_requests
      set status = 'cancelled', updated_at = now()
      where id = request_id and user_id = account_id and status = 'pending';
  end if;

  insert into public.summer_subscription_requests(
    user_id,
    subscription_plan,
    amount_cents
  ) values (
    account_id,
    p_subscription_plan,
    amount_value
  ) returning id into request_id;

  config_result := summer_private.plan_config();
  return config_result || jsonb_build_object(
    'request_id', request_id,
    'subscription_plan', p_subscription_plan,
    'amount_cents', amount_value,
    'status', 'pending'
  );
end;
$$;
revoke all on function summer_private.request_subscription(text)
  from public, anon, authenticated;
grant execute on function summer_private.request_subscription(text)
  to authenticated;

create or replace function public.summer_request_subscription(
  p_subscription_plan text
) returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.request_subscription(p_subscription_plan);
$$;
revoke all on function public.summer_request_subscription(text)
  from public, anon;
grant execute on function public.summer_request_subscription(text)
  to authenticated;

create or replace function summer_private.admin_review_subscription_request(
  p_request_id bigint,
  p_decision text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request_row public.summer_subscription_requests;
  subscription_result jsonb;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') or p_decision is null then
    raise exception 'Decisao invalida';
  end if;

  select * into request_row
  from public.summer_subscription_requests
  where id = p_request_id for update;
  if request_row.id is null or request_row.status <> 'pending' then
    raise exception 'Solicitacao nao encontrada ou ja analisada';
  end if;

  if p_decision = 'approved' then
    subscription_result := summer_private.admin_set_subscription(
      request_row.user_id,
      request_row.subscription_plan,
      'grant'
    );
  else
    subscription_result := jsonb_build_object(
      'subscription_status', 'free',
      'subscription_plan', request_row.subscription_plan
    );
  end if;

  update public.summer_subscription_requests
    set status = p_decision,
        updated_at = now(),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = request_row.id;

  if p_decision = 'approved' then
    update summer_private.plan_audit
      set request_id = request_row.id,
          amount_cents = request_row.amount_cents
      where id = (
        select a.id from summer_private.plan_audit a
        where a.admin_id = auth.uid()
          and a.student_id = request_row.user_id
          and a.request_id is null
        order by a.created_at desc, a.id desc
        limit 1
      );
  end if;

  return subscription_result || jsonb_build_object(
    'request_id', request_row.id,
    'request_status', p_decision
  );
end;
$$;
revoke all on function summer_private.admin_review_subscription_request(bigint,text)
  from public, anon, authenticated;
grant execute on function summer_private.admin_review_subscription_request(bigint,text)
  to authenticated;

create or replace function public.summer_admin_review_subscription_request(
  p_request_id bigint,
  p_decision text
) returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.admin_review_subscription_request(
    p_request_id,
    p_decision
  );
$$;
revoke all on function public.summer_admin_review_subscription_request(bigint,text)
  from public, anon;
grant execute on function public.summer_admin_review_subscription_request(bigint,text)
  to authenticated;

-- Photo import belongs to Summer Gratis. The quota is monthly for every
-- account and remains configurable to protect the owner's AI costs.
update summer_private.workout_import_config
  set free_trial_limit = 0, updated_at = now()
  where singleton;

create or replace function summer_private.workout_import_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  pro_active boolean;
  monthly_limit_value integer;
  used_value integer;
  remaining_value integer;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;

  select c.monthly_limit into monthly_limit_value
  from summer_private.workout_import_config c where c.singleton;
  monthly_limit_value := coalesce(monthly_limit_value, 5);
  pro_active := summer_private.is_admin() or exists (
    select 1 from public.summer_subscriptions s
    where s.user_id = account_id
      and s.subscription_status = 'pro'
      and s.subscription_expires_at > now()
  );

  select count(*)::integer into used_value
  from public.summer_workout_imports i
  where i.user_id = account_id
    and i.created_at >= date_trunc('month', now())
    and i.created_at < date_trunc('month', now()) + interval '1 month'
    and (
      i.status in ('review', 'completed')
      or (i.status = 'processing' and i.created_at > now() - interval '15 minutes')
    );
  remaining_value := greatest(0, monthly_limit_value - used_value);

  return jsonb_build_object(
    'is_pro', pro_active,
    'available_on_free', true,
    'allowed', remaining_value > 0,
    'used', used_value,
    'remaining', remaining_value,
    'monthly_limit', monthly_limit_value,
    'free_trial_limit', 0,
    'period_ends_at', date_trunc('month', now()) + interval '1 month',
    'server_time', now()
  );
end;
$$;

create or replace function summer_private.admin_workout_import_config(
  p_monthly_limit integer default null,
  p_free_trial_limit integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_monthly_limit is not null
    and (p_monthly_limit < 1 or p_monthly_limit > 50) then
    raise exception 'O limite mensal deve ficar entre 1 e 50';
  end if;
  if p_monthly_limit is not null then
    update summer_private.workout_import_config
      set monthly_limit = p_monthly_limit,
          free_trial_limit = 0,
          updated_at = now(),
          updated_by = auth.uid()
      where singleton;
  end if;
  select jsonb_build_object(
    'monthly_limit', c.monthly_limit,
    'free_trial_limit', 0,
    'updated_at', c.updated_at
  ) into result
  from summer_private.workout_import_config c where c.singleton;
  return result;
end;
$$;

revoke all on function public.summer_get_access(),
  public.summer_has_paid_access(),
  public.summer_admin_students(text,text,integer),
  public.summer_admin_set_plan(uuid,text,text),
  public.summer_get_workout_import_access(),
  public.summer_begin_workout_import(integer),
  public.summer_complete_workout_import(uuid),
  public.summer_admin_workout_import_config(integer,integer)
  from public, anon;
grant execute on function public.summer_get_access(),
  public.summer_has_paid_access(),
  public.summer_admin_students(text,text,integer),
  public.summer_admin_set_plan(uuid,text,text),
  public.summer_get_workout_import_access(),
  public.summer_begin_workout_import(integer),
  public.summer_complete_workout_import(uuid),
  public.summer_admin_workout_import_config(integer,integer)
  to authenticated;

commit;
