-- Cover the administrative foreign keys used by membership history.
create index if not exists summer_academy_memberships_reviewed_by
  on public.summer_academy_memberships(reviewed_by)
  where reviewed_by is not null;

create index if not exists summer_membership_audit_admin_created
  on summer_private.membership_audit(admin_id, created_at desc);
