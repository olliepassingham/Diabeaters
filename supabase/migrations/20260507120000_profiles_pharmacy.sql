-- User-managed primary pharmacy (name + opening hours) for collect-by hints + display.
-- Owner-only via existing `profiles` RLS; not selected in batch community profile fetches.

alter table public.profiles
  add column if not exists pharmacy jsonb;

comment on column public.profiles.pharmacy is
  'Primary pharmacy (manually entered): { name, phone?, addressLine?, notes?, hours: { mon..sun: { open?, close?, break?, closed? } }, updatedAt }. Local-time HH:mm strings; v1 assumes UK / device local timezone.';
