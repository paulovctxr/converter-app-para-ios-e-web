-- Summer Fit: cadastro com acesso automático.
-- O administrador continua podendo suspender, desativar e reativar contas.
begin;

alter table public.summer_academy_memberships
  alter column status set default 'active';

-- Libera cadastros antigos que ainda aguardavam uma conferência manual.
-- Contas suspensas ou inativas permanecem bloqueadas.
update public.summer_academy_memberships
set status = 'active',
    updated_at = now(),
    reviewed_at = null,
    reviewed_by = null
where status = 'pending';

-- Garante uma matrícula de acesso para contas antigas que, por qualquer
-- motivo, ainda não possuam linha na tabela. A matrícula numérica poderá ser
-- preenchida posteriormente no painel administrativo.
insert into public.summer_academy_memberships(user_id, registration, status)
select u.id, null, 'active'
from auth.users u
where u.deleted_at is null
  and not exists (
    select 1 from public.summer_academy_memberships m where m.user_id = u.id
  )
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
  values (new.id, requested_registration, 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function summer_private.create_academy_membership()
  from public, anon, authenticated;

create or replace function summer_private.require_active_member()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not summer_private.is_active_member() then
    raise exception 'Acesso suspenso ou matrícula inativa'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function summer_private.require_active_member()
  from public, anon;
grant execute on function summer_private.require_active_member()
  to authenticated;

commit;
