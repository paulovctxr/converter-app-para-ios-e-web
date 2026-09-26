-- Narrow the privileged database surface after initial linter review.
begin;
-- Private definer helpers cannot be called through the exposed Data API schema.
grant usage on schema summer_private to authenticated;
revoke all on schema summer_private from anon;

create or replace function summer_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join summer_private.admin_emails a on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null and u.deleted_at is null
  );
$$;
revoke all on function summer_private.is_admin() from public, anon;
grant execute on function summer_private.is_admin() to authenticated;

create or replace function public.summer_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select summer_private.is_admin();
$$;

create or replace function public.summer_get_access() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'is_admin', public.summer_is_admin(),
    'plan', coalesce((select s.plan from public.summer_subscriptions s where s.user_id = (select auth.uid()) and s.expires_at > now()), 'basic'),
    'expires_at', (select s.expires_at from public.summer_subscriptions s where s.user_id = (select auth.uid())),
    'server_time', now()
  );
$$;

create or replace function public.summer_has_paid_access() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.summer_subscriptions where user_id = (select auth.uid()) and expires_at > now());
$$;

create or replace function summer_private.admin_students(p_search text default '', p_status text default 'all', p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not summer_private.is_admin() then raise exception 'Acesso restrito ao administrador' using errcode = '42501'; end if;
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
revoke all on function summer_private.admin_students(text,text,integer) from public, anon, authenticated;
grant execute on function summer_private.admin_students(text,text,integer) to authenticated;
create or replace function public.summer_admin_students(p_search text default '', p_status text default 'all', p_page integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select summer_private.admin_students(p_search, p_status, p_page);
$$;

create or replace function summer_private.admin_set_plan(p_user_id uuid, p_plan text, p_action text default 'grant')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.summer_subscriptions; new_expiration timestamptz;
begin
  if not summer_private.is_admin() then raise exception 'Acesso restrito ao administrador' using errcode = '42501'; end if;
  if p_plan not in ('premium', 'plus') or p_action not in ('grant', 'renew', 'revoke') or p_plan is null or p_action is null then raise exception 'Plano ou ação inválidos'; end if;
  perform 1 from auth.users where id = p_user_id and deleted_at is null and email_confirmed_at is not null for update;
  if not found then raise exception 'Aluno não encontrado ou e-mail ainda não confirmado'; end if;
  if exists (select 1 from auth.users u join summer_private.admin_emails a on a.email = lower(u.email) where u.id = p_user_id) then raise exception 'Selecione uma conta de aluno'; end if;
  select * into previous from public.summer_subscriptions where user_id = p_user_id;
  if p_action = 'revoke' then
    if previous.user_id is null then raise exception 'Este aluno não possui plano para revogar'; end if;
    new_expiration := now(); p_plan := previous.plan;
  elsif p_action = 'renew' then
    if previous.user_id is null then raise exception 'Libere um plano antes de renovar'; end if;
    p_plan := previous.plan; new_expiration := greatest(now(), previous.expires_at) + interval '1 month';
  else
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
revoke all on function summer_private.admin_set_plan(uuid,text,text) from public, anon, authenticated;
grant execute on function summer_private.admin_set_plan(uuid,text,text) to authenticated;
create or replace function public.summer_admin_set_plan(p_user_id uuid, p_plan text, p_action text default 'grant')
returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.admin_set_plan(p_user_id, p_plan, p_action);
$$;

create index if not exists summer_subscriptions_updated_by on public.summer_subscriptions(updated_by);
create index if not exists summer_plan_audit_admin_created on summer_private.plan_audit(admin_id, created_at desc);
create index if not exists summer_plan_audit_student_created on summer_private.plan_audit(student_id, created_at desc);
commit;
