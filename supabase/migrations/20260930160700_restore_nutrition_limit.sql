-- Summer Treinos: restaura 4 cardapios por mes e desativa substituicao de refeicao por IA.
begin;

update summer_private.plan_config
set nutrition_generation_limit = 4,
    updated_at = now()
where singleton;

create or replace function summer_private.nutrition_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  pro_active boolean;
  limit_value integer;
  used_value integer;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;

  pro_active := summer_private.is_admin() or exists (
    select 1
    from public.summer_subscriptions s
    where s.user_id = account_id
      and s.subscription_status = 'pro'
      and s.subscription_expires_at > now()
  );

  select c.nutrition_generation_limit into limit_value
  from summer_private.plan_config c
  where c.singleton;
  limit_value := coalesce(limit_value, 4);

  select count(*)::integer into used_value
  from public.summer_nutrition_generations g
  where g.user_id = account_id
    and g.created_at >= date_trunc('month', now())
    and g.created_at < date_trunc('month', now()) + interval '1 month'
    and (
      g.status = 'completed'
      or (g.status = 'processing' and g.created_at > now() - interval '15 minutes')
    );

  return jsonb_build_object(
    'is_pro', pro_active,
    'allowed', pro_active and used_value < limit_value,
    'used', used_value,
    'remaining', greatest(0, limit_value - used_value),
    'monthly_limit', limit_value,
    'period_ends_at', date_trunc('month', now()) + interval '1 month',
    'server_time', now()
  );
end;
$$;

create or replace function summer_private.begin_nutrition_generation()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  access_result jsonb;
  generation_id bigint;
begin
  if account_id is null then
    raise exception 'Autenticacao necessaria' using errcode = '42501';
  end if;

  perform 1
  from auth.users
  where id = account_id
    and deleted_at is null
    and email_confirmed_at is not null
  for update;

  if not found then
    raise exception 'Conta nao encontrada ou e-mail ainda nao confirmado';
  end if;

  access_result := summer_private.nutrition_access();

  if not coalesce((access_result ->> 'is_pro')::boolean, false) then
    raise exception 'Recurso exclusivo do Summer PRO' using errcode = '42501';
  end if;

  if not coalesce((access_result ->> 'allowed')::boolean, false) then
    raise exception 'Limite mensal de cardapios atingido';
  end if;

  insert into public.summer_nutrition_generations(user_id)
  values (account_id)
  returning id into generation_id;

  return access_result || jsonb_build_object(
    'generation_id', generation_id,
    'used', (access_result ->> 'used')::integer + 1,
    'remaining', greatest(0, (access_result ->> 'remaining')::integer - 1)
  );
end;
$$;

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

  if p_action <> 'food_photo' then
    raise exception 'Acao de nutricao invalida';
  end if;

  perform 1
  from auth.users
  where id = account_id
    and deleted_at is null
    and email_confirmed_at is not null
  for update;

  if not found then
    raise exception 'Conta nao encontrada ou e-mail ainda nao confirmado';
  end if;

  if not (
    summer_private.is_admin()
    or exists (
      select 1
      from public.summer_subscriptions s
      where s.user_id = account_id
        and s.subscription_status = 'pro'
        and s.subscription_expires_at > now()
    )
  ) then
    raise exception 'Recurso exclusivo do Summer PRO' using errcode = '42501';
  end if;

  select c.food_photo_monthly_limit into limit_value
  from summer_private.plan_config c
  where c.singleton;
  limit_value := coalesce(limit_value, 30);

  select count(*)::integer into used_value
  from public.summer_nutrition_ai_actions a
  where a.user_id = account_id
    and a.action = 'food_photo'
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
  values (account_id, 'food_photo')
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

commit;
