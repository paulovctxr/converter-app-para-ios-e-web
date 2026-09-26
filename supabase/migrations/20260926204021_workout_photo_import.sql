-- Importação de fichas por foto.
-- O plano `plus` existente passa a representar o Summer PRO. As imagens nunca
-- são gravadas no banco: apenas o resultado estruturado e metadados da execução.
begin;

create table if not exists summer_private.workout_import_config (
  singleton boolean primary key default true check (singleton),
  monthly_limit integer not null default 5 check (monthly_limit between 1 and 50),
  free_trial_limit integer not null default 1 check (free_trial_limit between 0 and 5),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into summer_private.workout_import_config(singleton, monthly_limit, free_trial_limit)
values (true, 5, 1) on conflict (singleton) do nothing;
alter table summer_private.workout_import_config enable row level security;
revoke all on summer_private.workout_import_config from public, anon, authenticated;

create table if not exists public.summer_workout_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null check (status in ('processing', 'review', 'completed', 'failed')),
  image_count integer not null check (image_count between 1 and 4),
  detected_workouts jsonb check (
    detected_workouts is null or
    (jsonb_typeof(detected_workouts) = 'array' and octet_length(detected_workouts::text) <= 200000)
  ),
  error_code text check (error_code is null or length(error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists summer_workout_imports_user_created
  on public.summer_workout_imports(user_id, created_at desc);
create index if not exists summer_workout_imports_active_usage
  on public.summer_workout_imports(user_id, status, created_at desc)
  where status in ('processing', 'review', 'completed');

alter table public.summer_workout_imports enable row level security;
revoke all on public.summer_workout_imports from public, anon, authenticated;
grant select on public.summer_workout_imports to authenticated;
drop policy if exists summer_workout_imports_read on public.summer_workout_imports;
create policy summer_workout_imports_read on public.summer_workout_imports
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Edge Functions use the server-only service role to persist the validated AI
-- result. Keep this conditional so the migration also runs in the local test DB.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update on public.summer_workout_imports to service_role';
  end if;
end;
$$;

create or replace function summer_private.workout_import_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  pro_active boolean;
  monthly_limit_value integer;
  free_trial_limit_value integer;
  used_value integer;
  remaining_value integer;
begin
  if account_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select c.monthly_limit, c.free_trial_limit
    into monthly_limit_value, free_trial_limit_value
  from summer_private.workout_import_config c where c.singleton;

  monthly_limit_value := coalesce(monthly_limit_value, 5);
  free_trial_limit_value := coalesce(free_trial_limit_value, 1);
  pro_active := summer_private.is_admin() or exists (
    select 1 from public.summer_subscriptions s
    where s.user_id = account_id and s.plan = 'plus' and s.expires_at > now()
  );

  if pro_active then
    select count(*)::integer into used_value
    from public.summer_workout_imports i
    where i.user_id = account_id
      and i.created_at >= date_trunc('month', now())
      and i.created_at < date_trunc('month', now()) + interval '1 month'
      and (i.status in ('review', 'completed') or (i.status = 'processing' and i.created_at > now() - interval '15 minutes'));
    remaining_value := greatest(0, monthly_limit_value - used_value);
  else
    select count(*)::integer into used_value
    from public.summer_workout_imports i
    where i.user_id = account_id
      and (i.status in ('review', 'completed') or (i.status = 'processing' and i.created_at > now() - interval '15 minutes'));
    remaining_value := greatest(0, free_trial_limit_value - used_value);
  end if;

  return jsonb_build_object(
    'is_pro', pro_active,
    'allowed', remaining_value > 0,
    'used', used_value,
    'remaining', remaining_value,
    'monthly_limit', monthly_limit_value,
    'free_trial_limit', free_trial_limit_value,
    'period_ends_at', case when pro_active then date_trunc('month', now()) + interval '1 month' else null end,
    'server_time', now()
  );
end;
$$;
revoke all on function summer_private.workout_import_access() from public, anon;
grant execute on function summer_private.workout_import_access() to authenticated;

create or replace function public.summer_get_workout_import_access()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select summer_private.workout_import_access();
$$;
revoke all on function public.summer_get_workout_import_access() from public, anon;
grant execute on function public.summer_get_workout_import_access() to authenticated;

create or replace function summer_private.begin_workout_import(p_image_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  access_result jsonb;
  import_id uuid;
begin
  if account_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if p_image_count is null or p_image_count < 1 or p_image_count > 4 then
    raise exception 'Envie entre 1 e 4 fotos';
  end if;

  -- Serialize starts for the same account so concurrent requests cannot pass the
  -- quota together. Also release abandoned processing reservations.
  perform 1 from auth.users where id = account_id and deleted_at is null for update;
  if not found then raise exception 'Conta não encontrada' using errcode = '42501'; end if;
  update public.summer_workout_imports
    set status = 'failed', error_code = 'processing_timeout', updated_at = now(), completed_at = now()
    where user_id = account_id and status = 'processing' and created_at <= now() - interval '15 minutes';

  access_result := summer_private.workout_import_access();
  if not coalesce((access_result ->> 'allowed')::boolean, false) then
    raise exception 'Limite de digitalizações atingido' using errcode = 'P0001', detail = access_result::text;
  end if;

  insert into public.summer_workout_imports(user_id, status, image_count)
    values (account_id, 'processing', p_image_count)
    returning id into import_id;

  return access_result || jsonb_build_object(
    'import_id', import_id,
    'remaining', greatest(0, (access_result ->> 'remaining')::integer - 1),
    'used', (access_result ->> 'used')::integer + 1
  );
end;
$$;
revoke all on function summer_private.begin_workout_import(integer) from public, anon;
grant execute on function summer_private.begin_workout_import(integer) to authenticated;

create or replace function public.summer_begin_workout_import(p_image_count integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.begin_workout_import(p_image_count);
$$;
revoke all on function public.summer_begin_workout_import(integer) from public, anon;
grant execute on function public.summer_begin_workout_import(integer) to authenticated;

create or replace function summer_private.complete_workout_import(p_import_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  update public.summer_workout_imports
    set status = 'completed', updated_at = now(), completed_at = now()
    where id = p_import_id and user_id = auth.uid() and status = 'review';
  if not found then
    raise exception 'Importação não encontrada ou já finalizada';
  end if;
  return true;
end;
$$;
revoke all on function summer_private.complete_workout_import(uuid) from public, anon;
grant execute on function summer_private.complete_workout_import(uuid) to authenticated;

create or replace function public.summer_complete_workout_import(p_import_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select summer_private.complete_workout_import(p_import_id);
$$;
revoke all on function public.summer_complete_workout_import(uuid) from public, anon;
grant execute on function public.summer_complete_workout_import(uuid) to authenticated;

-- One admin RPC both reads and updates the limits. Null arguments mean read-only.
create or replace function summer_private.admin_workout_import_config(
  p_monthly_limit integer default null,
  p_free_trial_limit integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_monthly_limit is not null and (p_monthly_limit < 1 or p_monthly_limit > 50) then
    raise exception 'O limite mensal deve ficar entre 1 e 50';
  end if;
  if p_free_trial_limit is not null and (p_free_trial_limit < 0 or p_free_trial_limit > 5) then
    raise exception 'O teste gratuito deve ficar entre 0 e 5';
  end if;
  if p_monthly_limit is not null or p_free_trial_limit is not null then
    update summer_private.workout_import_config
      set monthly_limit = coalesce(p_monthly_limit, monthly_limit),
          free_trial_limit = coalesce(p_free_trial_limit, free_trial_limit),
          updated_at = now(), updated_by = auth.uid()
      where singleton;
  end if;
  select jsonb_build_object(
    'monthly_limit', monthly_limit,
    'free_trial_limit', free_trial_limit,
    'updated_at', updated_at
  ) into result from summer_private.workout_import_config where singleton;
  return result;
end;
$$;
revoke all on function summer_private.admin_workout_import_config(integer,integer) from public, anon, authenticated;
grant execute on function summer_private.admin_workout_import_config(integer,integer) to authenticated;

create or replace function public.summer_admin_workout_import_config(
  p_monthly_limit integer default null,
  p_free_trial_limit integer default null
) returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.admin_workout_import_config(p_monthly_limit, p_free_trial_limit);
$$;
revoke all on function public.summer_admin_workout_import_config(integer,integer) from public, anon;
grant execute on function public.summer_admin_workout_import_config(integer,integer) to authenticated;

commit;
