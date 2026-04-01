-- Allow patients to see linked carers' display name + avatar (no email).
-- Run in Supabase SQL editor. Safe to re-run.
--
-- This updates the SELECT policy on `public.profiles` to allow:
-- - selecting your own profile
-- - selecting public profiles (is_public = true)
-- - selecting profiles of carers linked to you via `public.carer_links`

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_public" on public.profiles;
create policy "profiles_select_own_or_public"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or coalesce(is_public, true) = true
  or exists (
    select 1
    from public.carer_links cl
    where cl.patient_id = auth.uid()
      and cl.carer_id = public.profiles.id
  )
);

