-- Extend profiles table with full_name and avatar_url.
-- Run after docs/sql/onboarding.sql.
-- Safe to run multiple times (IF NOT EXISTS for columns not supported; use migrations or run once).

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
