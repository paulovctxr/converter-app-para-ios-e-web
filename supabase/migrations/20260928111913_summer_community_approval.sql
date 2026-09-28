-- Comunidade privada. Execute uma vez após as migrações existentes.
begin;
create table public.summer_community_members (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null check (length(trim(display_name)) between 2 and 80),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.summer_community_members enable row level security;
revoke all on public.summer_community_members from public,anon,authenticated;
create index summer_community_status_idx on public.summer_community_members(status,requested_at);
create function summer_private.community_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (summer_private.is_admin() or exists (
    select 1 from public.summer_community_members m join auth.users u on u.id=m.user_id
    where m.user_id=auth.uid() and m.status='approved' and u.deleted_at is null and u.email_confirmed_at is not null
  ));
$$;
revoke all on function summer_private.community_allowed() from public,anon;
grant execute on function summer_private.community_allowed() to authenticated;
create function public.summer_community_allowed() returns boolean
language sql stable security invoker set search_path = '' as $$ select summer_private.community_allowed(); $$;
revoke all on function public.summer_community_allowed() from public,anon;
grant execute on function public.summer_community_allowed() to authenticated;
grant select on public.summer_community_members to authenticated;
grant insert(display_name) on public.summer_community_members to authenticated;
grant update(status) on public.summer_community_members to authenticated;
create policy community_member_read on public.summer_community_members for select to authenticated
using (user_id=(select auth.uid()) or (select summer_private.is_admin()));
create policy community_member_request on public.summer_community_members for insert to authenticated
with check (user_id=(select auth.uid()) and status='pending');
create policy community_member_review on public.summer_community_members for update to authenticated
using ((select summer_private.is_admin())) with check ((select summer_private.is_admin()));
create function summer_private.community_review_stamp() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.reviewed_at:=now(); new.reviewed_by:=auth.uid(); return new; end;
$$;
create trigger community_review_stamp before update on public.summer_community_members
for each row execute function summer_private.community_review_stamp();

create table public.summer_community_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null,
  caption text not null default '' check(length(caption)<=300),
  image_path text not null unique,
  status text not null default 'draft' check(status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '24 hours'
);
alter table public.summer_community_stories enable row level security;
revoke all on public.summer_community_stories from public,anon,authenticated;
create index summer_story_feed_idx on public.summer_community_stories(status,created_at desc);
create index summer_story_owner_idx on public.summer_community_stories(user_id,created_at);
create index summer_story_expiry_idx on public.summer_community_stories(expires_at);
grant select on public.summer_community_stories to authenticated;
create policy community_story_read on public.summer_community_stories for select to authenticated
using ((select summer_private.community_allowed()) and (status='published' and expires_at>now() or user_id=(select auth.uid()) or (select summer_private.is_admin())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('summer-stories','summer-stories',false,3145728,array['image/jpeg','image/png','image/webp']);
create function summer_private.community_image_allowed(p_path text,p_upload boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and summer_private.community_allowed() and exists (
   select 1 from public.summer_community_stories s where s.image_path=p_path and
   case when p_upload then s.user_id=auth.uid() and s.status='draft' and s.created_at>now()-interval '15 minutes'
   else s.status='published' and s.expires_at>now() end
 );
$$;
revoke all on function summer_private.community_image_allowed(text,boolean) from public,anon;
grant execute on function summer_private.community_image_allowed(text,boolean) to authenticated;
create policy summer_story_upload on storage.objects for insert to authenticated
with check (bucket_id='summer-stories' and summer_private.community_image_allowed(name,true));
create policy summer_story_download on storage.objects for select to authenticated
using (bucket_id='summer-stories'
 and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info'])
 and summer_private.community_image_allowed(name,false));

create function summer_private.story_action(p_action text,p_id uuid default null,p_caption text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.summer_community_stories; new_id uuid; display text;
begin
 if auth.uid() is null or not summer_private.community_allowed() then raise exception 'Comunidade restrita aos alunos aprovados' using errcode='42501'; end if;
 if p_action='create' then
   -- Serialize reservations per user: even parallel requests cannot bypass the quota.
   perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
   if (select count(*) from public.summer_community_stories where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5 then
     raise exception 'Limite de 5 stories por 24 horas. Tente novamente mais tarde.';
   end if;
   if p_caption is null or length(p_caption)>300 then raise exception 'Legenda inválida'; end if;
   select display_name into display from public.summer_community_members where user_id=auth.uid();
   new_id:=gen_random_uuid();
   insert into public.summer_community_stories(id,author_name,caption,image_path)
   values(new_id,coalesce(display,'Administração Summer'),trim(p_caption),auth.uid()::text||'/'||new_id::text||'.jpg') returning * into s;
 elsif p_action in ('publish','hide') then
   select * into s from public.summer_community_stories where id=p_id for update;
   if not found or (s.user_id<>auth.uid() and not summer_private.is_admin()) then raise exception 'Story não encontrado' using errcode='42501'; end if;
   if p_action='publish' then
     if s.status<>'draft' or s.created_at<now()-interval '15 minutes' then raise exception 'Envio expirou. Tente outra foto.'; end if;
     if not exists(select 1 from storage.objects where bucket_id='summer-stories' and name=s.image_path) then raise exception 'Foto ainda não enviada'; end if;
     update public.summer_community_stories set status='published',expires_at=now()+interval '24 hours' where id=p_id returning * into s;
   else
     update public.summer_community_stories set status='hidden',expires_at=least(expires_at,now()) where id=p_id returning * into s;
   end if;
 else raise exception 'Ação inválida'; end if;
 return to_jsonb(s);
end;
$$;
revoke all on function summer_private.story_action(text,uuid,text) from public,anon;
grant execute on function summer_private.story_action(text,uuid,text) to authenticated;
create function public.summer_story_action(p_action text,p_id uuid default null,p_caption text default '') returns jsonb
language sql security invoker set search_path = '' as $$ select summer_private.story_action(p_action,p_id,p_caption); $$;
revoke all on function public.summer_story_action(text,uuid,text) from public,anon;
grant execute on function public.summer_story_action(text,uuid,text) to authenticated;

create table public.summer_story_reports (
 id bigint generated always as identity primary key,
 story_id uuid not null references public.summer_community_stories(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 reason text not null check(length(trim(reason)) between 3 and 500),
 resolved boolean not null default false,
 created_at timestamptz not null default now(),
 unique(story_id,user_id)
);
alter table public.summer_story_reports enable row level security;
revoke all on public.summer_story_reports from public,anon,authenticated;
create index summer_report_queue_idx on public.summer_story_reports(resolved,created_at);
create index summer_report_user_idx on public.summer_story_reports(user_id);
grant select on public.summer_story_reports to authenticated;
grant insert(story_id,reason) on public.summer_story_reports to authenticated;
grant update(resolved) on public.summer_story_reports to authenticated;
grant usage on sequence public.summer_story_reports_id_seq to authenticated;
create policy report_insert on public.summer_story_reports for insert to authenticated with check (
 (select summer_private.community_allowed()) and user_id=(select auth.uid()) and exists (
 select 1 from public.summer_community_stories where id=story_id and status='published' and expires_at>now()));
create policy report_read on public.summer_story_reports for select to authenticated using ((select summer_private.is_admin()) or user_id=(select auth.uid()));
create policy report_review on public.summer_story_reports for update to authenticated using ((select summer_private.is_admin())) with check ((select summer_private.is_admin()));

create table public.summer_challenges (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 100),
 description text not null check(length(description)<=1000),
 target integer not null check(target between 1 and 365),
 starts_on date not null,
 ends_on date not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check(ends_on>=starts_on and ends_on-starts_on<=365 and target<=ends_on-starts_on+1)
);
alter table public.summer_challenges enable row level security;
revoke all on public.summer_challenges from public,anon,authenticated;
grant select,insert on public.summer_challenges to authenticated;
grant update(active) on public.summer_challenges to authenticated;
create policy challenge_read on public.summer_challenges for select to authenticated using ((select summer_private.community_allowed()));
create policy challenge_create on public.summer_challenges for insert to authenticated with check ((select summer_private.is_admin()));
create policy challenge_update on public.summer_challenges for update to authenticated using ((select summer_private.is_admin())) with check ((select summer_private.is_admin()));
create table public.summer_challenge_members (
 challenge_id uuid not null references public.summer_challenges(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(challenge_id,user_id)
);
alter table public.summer_challenge_members enable row level security;
revoke all on public.summer_challenge_members from public,anon,authenticated;
create index summer_challenge_member_user_idx on public.summer_challenge_members(user_id);
grant select on public.summer_challenge_members to authenticated;
grant insert(challenge_id) on public.summer_challenge_members to authenticated;
create policy challenge_member_read on public.summer_challenge_members for select to authenticated using (
 (select summer_private.community_allowed()) and user_id=(select auth.uid()));
create policy challenge_join on public.summer_challenge_members for insert to authenticated with check (
 (select summer_private.community_allowed()) and user_id=(select auth.uid()) and exists (
 select 1 from public.summer_challenges c where c.id=challenge_id and c.active and c.ends_on >= (now() at time zone 'America/Sao_Paulo')::date));
create table public.summer_challenge_checkins (
 challenge_id uuid not null,
 user_id uuid not null default auth.uid(),
 day date not null default (now() at time zone 'America/Sao_Paulo')::date,
 created_at timestamptz not null default now(),
 primary key(challenge_id,user_id,day),
 foreign key(challenge_id,user_id) references public.summer_challenge_members(challenge_id,user_id) on delete cascade
);
alter table public.summer_challenge_checkins enable row level security;
revoke all on public.summer_challenge_checkins from public,anon,authenticated;
create index summer_checkin_user_idx on public.summer_challenge_checkins(user_id);
grant select on public.summer_challenge_checkins to authenticated;
grant insert(challenge_id) on public.summer_challenge_checkins to authenticated;
create policy checkin_read on public.summer_challenge_checkins for select to authenticated using (
 (select summer_private.community_allowed()) and user_id=(select auth.uid()));
create policy checkin_create on public.summer_challenge_checkins for insert to authenticated with check (
 (select summer_private.community_allowed()) and user_id=(select auth.uid()) and day=(now() at time zone 'America/Sao_Paulo')::date
 and exists(select 1 from public.summer_challenges c where c.id=challenge_id and c.active and day between c.starts_on and c.ends_on));
-- Cleanup runs server-side through the Storage API; never delete storage.objects with SQL.
create function summer_private.community_members_admin(p_page integer default 0,p_search text default '') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null or not summer_private.is_admin() then raise exception 'Acesso restrito ao administrador' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>100000 or p_search is null or length(p_search)>100 then raise exception 'Filtro inválido'; end if;
 with members as (
  select m.*,u.email,coalesce(u.raw_user_meta_data->>'matricula',u.raw_user_meta_data->>'registration','') as registration
  from public.summer_community_members m join auth.users u on u.id=m.user_id
  where p_search='' or strpos(lower(m.display_name||' '||u.email||' '||coalesce(u.raw_user_meta_data->>'matricula',u.raw_user_meta_data->>'registration','')),lower(p_search))>0
 ), page as (select * from members order by (status='pending') desc, requested_at desc,user_id limit 20 offset p_page*20)
 select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'total',(select count(*) from members)) into result;
 return result;
end;
$$;
revoke all on function summer_private.community_members_admin(integer,text) from public,anon;
grant execute on function summer_private.community_members_admin(integer,text) to authenticated;
create function public.summer_community_members_admin(p_page integer default 0,p_search text default '') returns jsonb
language sql stable security invoker set search_path = '' as $$ select summer_private.community_members_admin(p_page,p_search); $$;
revoke all on function public.summer_community_members_admin(integer,text) from public,anon;
grant execute on function public.summer_community_members_admin(integer,text) to authenticated;
grant select,delete on public.summer_community_stories to service_role;
commit;
