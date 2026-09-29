-- Summer Treinos: ações de IA para substituição de refeições e registro por foto.
-- A foto é processada em memória pela Edge Function e não é armazenada.
begin;

alter table summer_private.plan_config
  add column if not exists food_photo_monthly_limit integer not null default 30,
  add column if not exists food_replacement_monthly_limit integer not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'plan_config_food_photo_limit_check'
      and conrelid = 'summer_private.plan_config'::regclass
  ) then
    alter table summer_private.plan_config
      add constraint plan_config_food_photo_limit_check
      check (food_photo_monthly_limit between 1 and 200);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'plan_config_food_replacement_limit_check'
      and conrelid = 'summer_private.plan_config'::regclass
  ) then
    alter table summer_private.plan_config
      add constraint plan_config_food_replacement_limit_check
      check (food_replacement_monthly_limit between 1 and 200);
  end if;
end $$;

create table if not exists public.summer_nutrition_ai_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('food_photo', 'food_replacement')),
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  error_code text check (error_code is null or length(error_code) <= 80),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists summer_nutrition_ai_actions_user_action_created
  on public.summer_nutrition_ai_actions(user_id, action, created_at desc);

alter table public.summer_nutrition_ai_actions enable row level security;
revoke all on public.summer_nutrition_ai_actions from public, anon, authenticated;

create or replace function summer_private.begin_nutrition_ai_action(p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  limit_value integer;
  used_value integer;
  action_id bigint;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;
  if p_action not in ('food_photo', 'food_replacement') then
    raise exception 'Acao de nutricao invalida';
  end if;
  perform 1 from auth.users
    where id = account_id and deleted_at is null and email_confirmed_at is not null
    for update;
  if not found then
    raise exception 'Conta nao encontrada ou e-mail ainda nao confirmado';
  end if;
  if not (
    summer_private.is_admin()
    or exists (
      select 1 from public.summer_subscriptions s
      where s.user_id = account_id
        and s.subscription_status = 'pro'
        and s.subscription_expires_at > now()
    )
  ) then
    raise exception 'Recurso exclusivo do Summer PRO' using errcode = '42501';
  end if;

  select case p_action
    when 'food_photo' then c.food_photo_monthly_limit
    else c.food_replacement_monthly_limit
  end into limit_value
  from summer_private.plan_config c where c.singleton;
  limit_value := coalesce(limit_value, 30);

  select count(*)::integer into used_value
  from public.summer_nutrition_ai_actions a
  where a.user_id = account_id
    and a.action = p_action
    and a.created_at >= date_trunc('month', now())
    and a.created_at < date_trunc('month', now()) + interval '1 month'
    and (
      a.status = 'completed'
      or (a.status = 'processing' and a.created_at > now() - interval '15 minutes')
    );

  if used_value >= limit_value then
    raise exception 'Limite mensal desta ferramenta atingido';
  end if;

  insert into public.summer_nutrition_ai_actions(user_id, action)
  values (account_id, p_action)
  returning id into action_id;

  return jsonb_build_object(
    'action_id', action_id,
    'used', used_value + 1,
    'remaining', greatest(0, limit_value - used_value - 1),
    'monthly_limit', limit_value,
    'period_ends_at', date_trunc('month', now()) + interval '1 month'
  );
end;
$$;

revoke all on function summer_private.begin_nutrition_ai_action(text)
  from public, anon, authenticated;
grant execute on function summer_private.begin_nutrition_ai_action(text)
  to authenticated;

create or replace function public.summer_begin_nutrition_ai_action(p_action text)
returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.begin_nutrition_ai_action(p_action);
$$;

revoke all on function public.summer_begin_nutrition_ai_action(text)
  from public, anon;
grant execute on function public.summer_begin_nutrition_ai_action(text)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update on public.summer_nutrition_ai_actions to service_role';
    execute 'grant usage, select on sequence public.summer_nutrition_ai_actions_id_seq to service_role';
    execute 'grant select on public.summer_nutrition_profiles to service_role';
    execute 'grant select, update on public.summer_meal_plans to service_role';
  end if;
end $$;

commit;
