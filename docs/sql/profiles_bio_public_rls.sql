-- Extend profiles + RLS for bio / public visibility.
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists is_public boolean default true;

-- Adjust RLS to match app expectations (own row always; others if is_public).
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_public" on public.profiles;
create policy "profiles_select_own_or_public"
on public.profiles for select
to authenticated
using (id = auth.uid() or coalesce(is_public, true) = true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Insert for new users (if not already defined elsewhere).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());
