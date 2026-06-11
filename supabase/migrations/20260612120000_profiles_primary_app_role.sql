-- Authoritative account persona for login routing (survives cleared local storage).
-- patient = Type 1 user tools; carer = supporter-only; community = community member.
alter table public.profiles
  add column if not exists primary_app_role text;

alter table public.profiles
  drop constraint if exists profiles_primary_app_role_check;

alter table public.profiles
  add constraint profiles_primary_app_role_check
  check (primary_app_role is null or primary_app_role in ('patient', 'carer', 'community'));

comment on column public.profiles.primary_app_role is
  'Login routing: patient = Type 1 tools; carer = supporter-only; community = learn/feed; null = legacy infer';

-- Linked supporters (not dual-role patients with completed onboarding).
update public.profiles p
set primary_app_role = 'carer'
where p.primary_app_role is null
  and exists (select 1 from public.carer_links cl where cl.carer_id = p.id)
  and not (
    p.onboarding_complete = true
    and coalesce(p.account_type, 'patient') = 'patient'
  );

-- Dual-role: Type 1 user who also supports someone.
update public.profiles p
set primary_app_role = 'patient'
where p.primary_app_role is null
  and exists (select 1 from public.carer_links cl where cl.carer_id = p.id)
  and p.onboarding_complete = true
  and coalesce(p.account_type, 'patient') = 'patient';

-- Community members without a supporter link.
update public.profiles p
set primary_app_role = 'community'
where p.primary_app_role is null
  and coalesce(p.account_type, 'patient') = 'community'
  and not exists (select 1 from public.carer_links cl where cl.carer_id = p.id);

-- Completed patient accounts without a supporter link.
update public.profiles p
set primary_app_role = 'patient'
where p.primary_app_role is null
  and p.onboarding_complete = true
  and coalesce(p.account_type, 'patient') = 'patient'
  and not exists (select 1 from public.carer_links cl where cl.carer_id = p.id);
