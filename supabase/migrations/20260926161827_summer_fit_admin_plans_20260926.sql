-- Summer Fit: plan management. Run once through Supabase migrations / SQL Editor.
-- Administrative authority is server controlled, never user-editable metadata.
begin;
create schema if not exists summer_private;
revoke all on schema summer_private from public, anon, authenticated;

create table if not exists summer_private.admin_emails (
  email text primary key check (email = lower(email))
);
insert into summer_private.admin_emails(email) values ('victorpaulognv@gmail.com') on conflict do nothing;

create table if not exists public.summer_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('premium', 'plus')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table if not exists summer_private.plan_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  student_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_plan text,
  new_plan text,
  old_expires_at timestamptz,
  new_expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table summer_private.admin_emails enable row level security;
alter table summer_private.plan_audit enable row level security;
alter table public.summer_subscriptions enable row level security;
revoke all on public.summer_subscriptions from public, anon, authenticated;
grant select on public.summer_subscriptions to authenticated;
revoke all on all tables in schema summer_private from public, anon, authenticated;

create or replace function public.summer_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join summer_private.admin_emails a on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
drop policy if exists summer_read_own_plan on public.summer_subscriptions;
create policy summer_read_own_plan on public.summer_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.summer_is_admin()));

create or replace function public.summer_get_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'is_admin', public.summer_is_admin(),
    'plan', coalesce((select s.plan from public.summer_subscriptions s where s.user_id = auth.uid() and s.expires_at > now()), 'basic'),
    'expires_at', (select s.expires_at from public.summer_subscriptions s where s.user_id = auth.uid()),
    'server_time', now()
  );
$$;

create or replace function public.summer_admin_students(p_search text default '', p_status text default 'all', p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.summer_is_admin() then raise exception 'Acesso restrito ao administrador' using errcode = '42501'; end if;
  if p_page < 0 or p_page > 100000 or length(p_search) > 120 or p_status not in ('all', 'active', 'expiring', 'expired', 'basic') then raise exception 'Filtro inválido'; end if;
  with students as (
    select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', '') as name,
      coalesce(u.raw_user_meta_data ->> 'matricula', u.raw_user_meta_data ->> 'registration', '') as registration,
      u.created_at, u.email_confirmed_at is not null as confirmed,
      coalesce(s.plan, 'basic') as plan, s.expires_at,
      case when s.expires_at > now() then 'active' when s.user_id is not null then 'expired' else 'basic' end as status
    from auth.users u left join public.summer_subscriptions s on s.user_id = u.id
    where u.deleted_at is null and not exists (select 1 from summer_private.admin_emails a where a.email = lower(u.email))
  ), filtered as (
    select * from students where
      (p_search = '' or strpos(lower(email), lower(p_search)) > 0 or strpos(lower(name), lower(p_search)) > 0 or strpos(registration, p_search) > 0)
      and (p_status = 'all' or status = p_status or (p_status = 'expiring' and status = 'active' and expires_at <= now() + interval '7 days'))
  ), page as (
    select * from filtered order by created_at desc, id limit 20 offset (p_page * 20)
  )
  select jsonb_build_object(
    'students', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id) from page p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'summary', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where status = 'active'), 'expiring', count(*) filter (where status = 'active' and expires_at <= now() + interval '7 days'), 'expired', count(*) filter (where status = 'expired'), 'basic', count(*) filter (where status = 'basic')) from students),
    'server_time', now()
  ) into result;
  return result;
end;
$$;

create or replace function public.summer_admin_set_plan(p_user_id uuid, p_plan text, p_action text default 'grant')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.summer_subscriptions; new_expiration timestamptz;
begin
  if not public.summer_is_admin() then raise exception 'Acesso restrito ao administrador' using errcode = '42501'; end if;
  if p_plan not in ('premium', 'plus') or p_action not in ('grant', 'renew', 'revoke') or p_plan is null or p_action is null then raise exception 'Plano ou ação inválidos'; end if;
  -- Lock the user to serialize changes even before the first subscription exists.
  perform 1 from auth.users where id = p_user_id and deleted_at is null and email_confirmed_at is not null for update;
  if not found then raise exception 'Aluno não encontrado ou e-mail ainda não confirmado'; end if;
  if exists (select 1 from auth.users u join summer_private.admin_emails a on a.email = lower(u.email) where u.id = p_user_id) then raise exception 'Selecione uma conta de aluno'; end if;
  select * into previous from public.summer_subscriptions where user_id = p_user_id;
  if p_action = 'revoke' then
    if previous.user_id is null then raise exception 'Este aluno não possui plano para revogar'; end if;
    new_expiration := now();
    p_plan := previous.plan;
  elsif p_action = 'renew' then
    if previous.user_id is null then raise exception 'Libere um plano antes de renovar'; end if;
    p_plan := previous.plan;
    new_expiration := greatest(now(), previous.expires_at) + interval '1 month';
  else
    -- Changing plans keeps unused days and adds the new paid month.
    new_expiration := greatest(now(), coalesce(previous.expires_at, now())) + interval '1 month';
  end if;
  insert into public.summer_subscriptions(user_id, plan, expires_at, updated_by)
    values (p_user_id, p_plan, new_expiration, auth.uid())
    on conflict (user_id) do update set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now(), updated_by = excluded.updated_by;
  insert into summer_private.plan_audit(admin_id, student_id, action, old_plan, new_plan, old_expires_at, new_expires_at)
    values (auth.uid(), p_user_id, p_action, previous.plan, p_plan, previous.expires_at, new_expiration);
  return jsonb_build_object('plan', p_plan, 'expires_at', new_expiration);
end;
$$;

-- Personal workout data stays out of Auth metadata and JWT cookies.
create table if not exists public.summer_fitness_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.summer_fitness_state enable row level security;
revoke all on public.summer_fitness_state from public, anon, authenticated;
grant select, insert, update on public.summer_fitness_state to authenticated;
drop policy if exists summer_fitness_read on public.summer_fitness_state;
drop policy if exists summer_fitness_insert on public.summer_fitness_state;
drop policy if exists summer_fitness_update on public.summer_fitness_state;
create policy summer_fitness_read on public.summer_fitness_state for select to authenticated using (user_id = (select auth.uid()));
create policy summer_fitness_insert on public.summer_fitness_state for insert to authenticated with check (user_id = (select auth.uid()));
create policy summer_fitness_update on public.summer_fitness_state for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create or replace function public.summer_save_fitness(p_data jsonb, p_revision bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  insert into public.summer_fitness_state(user_id, data, revision) values (auth.uid(), p_data, 1)
    on conflict (user_id) do update set data = excluded.data, revision = summer_fitness_state.revision + 1, updated_at = now()
    where summer_fitness_state.revision = p_revision
    returning revision into next_revision;
  if next_revision is null then raise exception 'Dados atualizados em outro aparelho. Recarregue e tente novamente.' using errcode = '40001'; end if;
  return next_revision;
end;
$$;
revoke all on function public.summer_save_fitness(jsonb,bigint) from public, anon;
grant execute on function public.summer_save_fitness(jsonb,bigint) to authenticated;

-- Use this database check in every paid-data policy. Never trust a plan in user_metadata.
create or replace function public.summer_has_paid_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.summer_subscriptions where user_id = auth.uid() and expires_at > now());
$$;

create table if not exists public.summer_calorie_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  label text not null check (length(trim(label)) between 1 and 100),
  calories integer not null check (calories between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists summer_calories_user_day on public.summer_calorie_entries(user_id, day);
alter table public.summer_calorie_entries enable row level security;
revoke all on public.summer_calorie_entries from public, anon, authenticated;
grant select, insert, delete on public.summer_calorie_entries to authenticated;
drop policy if exists summer_calories_read on public.summer_calorie_entries;
drop policy if exists summer_calories_insert on public.summer_calorie_entries;
drop policy if exists summer_calories_delete on public.summer_calorie_entries;
create policy summer_calories_read on public.summer_calorie_entries for select to authenticated using (user_id = (select auth.uid()) and (select public.summer_has_paid_access()));
create policy summer_calories_insert on public.summer_calorie_entries for insert to authenticated with check (user_id = (select auth.uid()) and (select public.summer_has_paid_access()));
create policy summer_calories_delete on public.summer_calorie_entries for delete to authenticated using (user_id = (select auth.uid()) and (select public.summer_has_paid_access()));

revoke all on function public.summer_is_admin(), public.summer_get_access(), public.summer_admin_students(text,text,integer), public.summer_admin_set_plan(uuid,text,text), public.summer_has_paid_access() from public, anon;
grant execute on function public.summer_is_admin(), public.summer_get_access(), public.summer_admin_students(text,text,integer), public.summer_admin_set_plan(uuid,text,text), public.summer_has_paid_access() to authenticated;
commit;
