-- Summer Fit: acesso exclusivo para alunos com matrícula aprovada.
-- Contas existentes e confirmadas são mantidas ativas para uma migração segura.
-- Novas contas começam pendentes e só o administrador pode aprová-las.
begin;

create table if not exists public.summer_academy_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  registration text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint summer_academy_registration_check
    check (registration is null or registration ~ '^[0-9]{4}$'),
  constraint summer_academy_status_check
    check (status in ('pending','active','suspended','inactive'))
);
create unique index if not exists summer_academy_registration_unique
  on public.summer_academy_memberships(registration)
  where registration is not null;
create index if not exists summer_academy_status_updated
  on public.summer_academy_memberships(status, updated_at desc);

-- Preserve confirmed accounts already using the app. Duplicate or malformed
-- legacy matrícula values are left blank for manual correction in the panel.
with candidates as (
  select
    u.id,
    nullif(trim(coalesce(
      u.raw_user_meta_data ->> 'matricula',
      u.raw_user_meta_data ->> 'registration',
      ''
    )), '') as registration,
    u.email_confirmed_at,
    row_number() over (
      partition by nullif(trim(coalesce(
        u.raw_user_meta_data ->> 'matricula',
        u.raw_user_meta_data ->> 'registration',
        ''
      )), '')
      order by u.created_at, u.id
    ) as registration_position
  from auth.users u
  where u.deleted_at is null
)
insert into public.summer_academy_memberships(user_id, registration, status)
select
  id,
  case
    when registration ~ '^[0-9]{4}$' and registration_position = 1
      then registration
    else null
  end,
  case when email_confirmed_at is not null then 'active' else 'pending' end
from candidates
on conflict (user_id) do nothing;

create or replace function summer_private.create_academy_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare requested_registration text;
begin
  requested_registration := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'matricula',
    new.raw_user_meta_data ->> 'registration',
    ''
  )), '');
  if requested_registration !~ '^[0-9]{4}$'
    or exists (
      select 1 from public.summer_academy_memberships m
      where m.registration = requested_registration
    ) then
    requested_registration := null;
  end if;
  insert into public.summer_academy_memberships(user_id, registration, status)
  values (new.id, requested_registration, 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function summer_private.create_academy_membership() from public, anon, authenticated;
drop trigger if exists summer_create_academy_membership on auth.users;
create trigger summer_create_academy_membership
  after insert on auth.users
  for each row execute function summer_private.create_academy_membership();

create or replace function summer_private.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select summer_private.is_admin()) or exists (
    select 1
    from public.summer_academy_memberships m
    join auth.users u on u.id = m.user_id
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and u.deleted_at is null
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function summer_private.is_active_member() from public, anon;
grant execute on function summer_private.is_active_member() to authenticated;

create or replace function public.summer_is_active_member()
returns boolean language sql stable security invoker set search_path = '' as $$
  select summer_private.is_active_member();
$$;
revoke all on function public.summer_is_active_member() from public, anon;
grant execute on function public.summer_is_active_member() to authenticated;

alter table public.summer_academy_memberships enable row level security;
revoke all on public.summer_academy_memberships from public, anon, authenticated;
grant select on public.summer_academy_memberships to authenticated;
drop policy if exists summer_academy_membership_read on public.summer_academy_memberships;
create policy summer_academy_membership_read
  on public.summer_academy_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select summer_private.is_admin())
  );

create table if not exists summer_private.membership_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  old_status text,
  new_status text not null,
  old_registration text,
  new_registration text,
  created_at timestamptz not null default now()
);
alter table summer_private.membership_audit enable row level security;
revoke all on summer_private.membership_audit from public, anon, authenticated;
create index if not exists summer_membership_audit_user_created
  on summer_private.membership_audit(user_id, created_at desc);

create or replace function public.summer_get_membership()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select case
    when public.summer_is_admin() then jsonb_build_object(
      'status', 'active', 'registration', null, 'is_admin', true,
      'updated_at', now(), 'server_time', now()
    )
    else coalesce((
      select jsonb_build_object(
        'status', m.status,
        'registration', m.registration,
        'is_admin', false,
        'reviewed_at', m.reviewed_at,
        'updated_at', m.updated_at,
        'server_time', now()
      )
      from public.summer_academy_memberships m
      where m.user_id = (select auth.uid())
    ), jsonb_build_object(
      'status', 'pending', 'registration', null, 'is_admin', false,
      'updated_at', null, 'server_time', now()
    ))
  end;
$$;
revoke all on function public.summer_get_membership() from public, anon;
grant execute on function public.summer_get_membership() to authenticated;

create or replace function summer_private.admin_set_membership(
  p_user_id uuid,
  p_action text,
  p_registration text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous public.summer_academy_memberships;
  next_status text;
  next_registration text;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_user_id is null or p_action not in ('approve','suspend','reactivate','deactivate') then
    raise exception 'Ação de matrícula inválida';
  end if;
  if exists (
    select 1 from auth.users u
    join summer_private.admin_emails a on a.email = lower(u.email)
    where u.id = p_user_id
  ) then
    raise exception 'Selecione uma conta de aluno';
  end if;
  perform 1 from auth.users u
    where u.id = p_user_id and u.deleted_at is null
    for update;
  if not found then raise exception 'Aluno não encontrado'; end if;

  select * into previous from public.summer_academy_memberships
    where user_id = p_user_id for update;
  if previous.user_id is null then
    insert into public.summer_academy_memberships(user_id)
    values (p_user_id) returning * into previous;
  end if;
  next_registration := coalesce(nullif(trim(p_registration), ''), previous.registration);
  if next_registration is not null and next_registration !~ '^[0-9]{4}$' then
    raise exception 'A matrícula deve possuir exatamente 4 números';
  end if;
  next_status := case p_action
    when 'approve' then 'active'
    when 'reactivate' then 'active'
    when 'suspend' then 'suspended'
    else 'inactive'
  end;
  if next_status = 'active' then
    if next_registration is null then
      raise exception 'Informe a matrícula de 4 números antes de aprovar';
    end if;
    if not exists (
      select 1 from auth.users u
      where u.id = p_user_id and u.email_confirmed_at is not null
    ) then
      raise exception 'O aluno precisa confirmar o e-mail antes da aprovação';
    end if;
  end if;

  begin
    update public.summer_academy_memberships
      set registration = next_registration,
          status = next_status,
          updated_at = now(),
          reviewed_at = now(),
          reviewed_by = auth.uid()
      where user_id = p_user_id;
  exception when unique_violation then
    raise exception 'Esta matrícula já está vinculada a outra conta';
  end;

  insert into summer_private.membership_audit(
    admin_id, user_id, old_status, new_status,
    old_registration, new_registration
  ) values (
    auth.uid(), p_user_id, previous.status, next_status,
    previous.registration, next_registration
  );
  return jsonb_build_object(
    'user_id', p_user_id,
    'status', next_status,
    'registration', next_registration,
    'updated_at', now()
  );
end;
$$;
revoke all on function summer_private.admin_set_membership(uuid,text,text)
  from public, anon, authenticated;
grant execute on function summer_private.admin_set_membership(uuid,text,text)
  to authenticated;

create or replace function public.summer_admin_set_membership(
  p_user_id uuid,
  p_action text,
  p_registration text default null
) returns jsonb language sql security invoker set search_path = '' as $$
  select summer_private.admin_set_membership(p_user_id, p_action, p_registration);
$$;
revoke all on function public.summer_admin_set_membership(uuid,text,text)
  from public, anon;
grant execute on function public.summer_admin_set_membership(uuid,text,text)
  to authenticated;

-- PRO is only valid while the academy membership is active.
create or replace function public.summer_has_pro_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select summer_private.is_active_member()) and (
    (select summer_private.is_admin()) or exists (
      select 1 from public.summer_subscriptions s
      where s.user_id = (select auth.uid())
        and s.subscription_status = 'pro'
        and s.subscription_expires_at > now()
    )
  );
$$;

create or replace function public.summer_has_paid_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.summer_has_pro_access();
$$;

create or replace function public.summer_get_access()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select jsonb_build_object(
      'is_admin', public.summer_is_admin(),
      'subscription_status', case
        when public.summer_has_pro_access() then 'pro'
        when s.subscription_status = 'cancelled' then 'cancelled'
        else 'expired'
      end,
      'subscription_plan', s.subscription_plan,
      'subscription_started_at', s.subscription_started_at,
      'subscription_expires_at', s.subscription_expires_at,
      'subscription_updated_at', s.subscription_updated_at,
      'plan', case when public.summer_has_pro_access() then 'plus' else 'basic' end,
      'expires_at', s.subscription_expires_at,
      'server_time', now()
    )
    from public.summer_subscriptions s
    where s.user_id = (select auth.uid())
  ), jsonb_build_object(
    'is_admin', public.summer_is_admin(),
    'subscription_status', 'free', 'subscription_plan', null,
    'subscription_started_at', null, 'subscription_expires_at', null,
    'subscription_updated_at', null, 'plan', 'basic', 'expires_at', null,
    'server_time', now()
  ));
$$;

-- Free workout data is still private to the owner, and now also requires an
-- active academy membership. Suspension preserves every row for reactivation.
drop policy if exists summer_fitness_read on public.summer_fitness_state;
drop policy if exists summer_fitness_insert on public.summer_fitness_state;
drop policy if exists summer_fitness_update on public.summer_fitness_state;
create policy summer_fitness_read on public.summer_fitness_state
  for select to authenticated using (
    user_id = (select auth.uid()) and (select summer_private.is_active_member())
  );
create policy summer_fitness_insert on public.summer_fitness_state
  for insert to authenticated with check (
    user_id = (select auth.uid()) and (select summer_private.is_active_member())
  );
create policy summer_fitness_update on public.summer_fitness_state
  for update to authenticated using (
    user_id = (select auth.uid()) and (select summer_private.is_active_member())
  ) with check (
    user_id = (select auth.uid()) and (select summer_private.is_active_member())
  );

drop policy if exists summer_workout_imports_read on public.summer_workout_imports;
create policy summer_workout_imports_read on public.summer_workout_imports
  for select to authenticated using (
    user_id = (select auth.uid()) and (select summer_private.is_active_member())
  );

drop policy if exists summer_subscription_requests_read on public.summer_subscription_requests;
create policy summer_subscription_requests_read on public.summer_subscription_requests
  for select to authenticated using (
    (user_id = (select auth.uid()) and (select summer_private.is_active_member()))
    or (select summer_private.is_admin())
  );

-- Guard every public RPC that can create or consume student data. The private
-- implementation remains unchanged and the check stays centralized.
create or replace function summer_private.require_active_member()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not summer_private.is_active_member() then
    raise exception 'Matrícula aguardando aprovação ou acesso suspenso'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function summer_private.require_active_member() from public, anon;
grant execute on function summer_private.require_active_member() to authenticated;

create or replace function public.summer_request_subscription(p_subscription_plan text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform summer_private.require_active_member();
  return summer_private.request_subscription(p_subscription_plan);
end;
$$;

create or replace function public.summer_get_workout_import_access()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform summer_private.require_active_member();
  return summer_private.workout_import_access();
end;
$$;
create or replace function public.summer_begin_workout_import(p_image_count integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform summer_private.require_active_member();
  return summer_private.begin_workout_import(p_image_count);
end;
$$;
create or replace function public.summer_complete_workout_import(p_import_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform summer_private.require_active_member();
  return summer_private.complete_workout_import(p_import_id);
end;
$$;
create or replace function public.summer_get_nutrition_access()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform summer_private.require_active_member();
  return summer_private.nutrition_access();
end;
$$;
create or replace function public.summer_begin_nutrition_generation()
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform summer_private.require_active_member();
  return summer_private.begin_nutrition_generation();
end;
$$;

-- Community approval remains separate, but suspended academy memberships lose
-- community access immediately as well.
create or replace function summer_private.community_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select summer_private.is_active_member() and (
    summer_private.is_admin() or exists (
      select 1
      from public.summer_community_members m
      join auth.users u on u.id = m.user_id
      where m.user_id = (select auth.uid())
        and m.status = 'approved'
        and u.deleted_at is null
        and u.email_confirmed_at is not null
    )
  );
$$;

-- Extend the existing student overview with academy membership controls.
create or replace function summer_private.admin_students(
  p_search text default '', p_status text default 'all', p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not summer_private.is_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;
  if p_page < 0 or p_page > 100000 or length(p_search) > 120
    or p_status not in (
      'all','pending','active','suspended','inactive',
      'pro','expiring','expired','free','basic','cancelled'
    ) then raise exception 'Filtro inválido'; end if;

  with students as (
    select
      u.id,
      coalesce(u.email, '') as email,
      coalesce(u.raw_user_meta_data ->> 'name', '') as name,
      coalesce(m.registration, '') as registration,
      coalesce(m.status, 'pending') as membership_status,
      m.reviewed_at as membership_reviewed_at,
      u.created_at,
      u.email_confirmed_at is not null as confirmed,
      case
        when s.subscription_status = 'pro' and s.subscription_expires_at > now() then 'pro'
        when s.subscription_status = 'cancelled' then 'cancelled'
        when s.user_id is not null then 'expired'
        else 'free'
      end as subscription_status,
      s.subscription_plan, s.subscription_started_at,
      s.subscription_expires_at, s.subscription_updated_at,
      case
        when s.subscription_status = 'pro' and s.subscription_expires_at > now() then 'plus'
        else 'basic'
      end as plan,
      s.subscription_expires_at as expires_at,
      pr.pending_request
    from auth.users u
    left join public.summer_academy_memberships m on m.user_id = u.id
    left join public.summer_subscriptions s on s.user_id = u.id
    left join lateral (
      select jsonb_build_object(
        'id', r.id, 'subscription_plan', r.subscription_plan,
        'amount_cents', r.amount_cents, 'status', r.status,
        'created_at', r.created_at
      ) as pending_request
      from public.summer_subscription_requests r
      where r.user_id = u.id and r.status = 'pending'
      order by r.created_at desc limit 1
    ) pr on true
    where u.deleted_at is null
      and not exists (
        select 1 from summer_private.admin_emails a where a.email = lower(u.email)
      )
  ), filtered as (
    select * from students s where
      (p_search = '' or strpos(lower(s.email), lower(p_search)) > 0
        or strpos(lower(s.name), lower(p_search)) > 0
        or strpos(s.registration, p_search) > 0)
      and (
        p_status = 'all' or p_status = s.membership_status
        or p_status = s.subscription_status
        or (p_status = 'basic' and s.subscription_status = 'free')
        or (p_status = 'expiring' and s.subscription_status = 'pro'
          and s.subscription_expires_at <= now() + interval '7 days')
      )
  ), page as (
    select * from filtered
    order by (membership_status = 'pending') desc, created_at desc, id
    limit 20 offset (p_page * 20)
  )
  select jsonb_build_object(
    'students', coalesce(
      (select jsonb_agg(to_jsonb(p) order by
        (p.membership_status = 'pending') desc, p.created_at desc, p.id) from page p),
      '[]'::jsonb
    ),
    'total', (select count(*) from filtered),
    'summary', (select jsonb_build_object(
      'total', count(*),
      'members_active', count(*) filter (where membership_status = 'active'),
      'members_pending', count(*) filter (where membership_status = 'pending'),
      'members_suspended', count(*) filter (where membership_status = 'suspended'),
      'members_inactive', count(*) filter (where membership_status = 'inactive'),
      'active', count(*) filter (where subscription_status = 'pro'),
      'pro', count(*) filter (where subscription_status = 'pro'),
      'expiring', count(*) filter (where subscription_status = 'pro'
        and subscription_expires_at <= now() + interval '7 days'),
      'expired', count(*) filter (where subscription_status = 'expired'),
      'free', count(*) filter (where subscription_status = 'free'),
      'basic', count(*) filter (where subscription_status = 'free'),
      'cancelled', count(*) filter (where subscription_status = 'cancelled')
    ) from students),
    'server_time', now()
  ) into result;
  return result;
end;
$$;

commit;
