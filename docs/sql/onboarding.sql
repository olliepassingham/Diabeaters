-- Profiles table for onboarding and user preferences.
-- Run in Supabase SQL Editor.
-- Uses id (uuid) as primary key, matching auth.uid().

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_complete boolean not null default false
);

create index if not exists idx_profiles_id on public.profiles(id);

alter table public.profiles enable row level security;

create policy "Profiles: select own" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- The app calls getOrCreateProfile to upsert on first check.
