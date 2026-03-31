-- Appointments (cloud sync + carer read-only)
--
-- Goal:
-- - Patients can CRUD their own appointments.
-- - Linked carers can SELECT a patient's appointments when `carer_links.scopes.appointments = true`.
-- - Supports local-first sync by upserting on (user_id, client_id) and using `updated_at` ordering.
-- - Supports deletions via tombstones (`deleted_at`) to prevent “delete reappears” on merge.

-- 1) Table
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Client-generated stable id used for upsert. Keep unique per user.
  client_id text not null,

  title text not null,
  type text not null,
  date text not null,
  time text,
  -- Canonical scheduled time (preferred for display/sorting; avoids DST shifts from parsing YYYY-MM-DD).
  scheduled_at timestamptz,
  location text,
  notes text,
  is_completed boolean not null default false,

  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists appointments_user_client_id_uniq
  on public.appointments (user_id, client_id);

create index if not exists appointments_user_updated_at_idx
  on public.appointments (user_id, updated_at desc);

create index if not exists appointments_user_scheduled_at_idx
  on public.appointments (user_id, scheduled_at asc);

-- Backfill `scheduled_at` (best-effort).
-- We cannot reliably infer a user's timezone in SQL; we backfill with UTC and let the client upsert
-- the correct instant on the next sync.
update public.appointments
set scheduled_at = (
  case
    when scheduled_at is not null then scheduled_at
    when time is not null and btrim(time) <> '' then (date || 'T' || time || ':00Z')::timestamptz
    else (date || 'T12:00:00Z')::timestamptz
  end
)
where scheduled_at is null;

-- 2) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

-- 3) RLS
alter table public.appointments enable row level security;

-- Patients can read their own appointments
drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own"
on public.appointments
for select
to authenticated
using (user_id = auth.uid());

-- Patients can insert their own appointments
drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own"
on public.appointments
for insert
to authenticated
with check (user_id = auth.uid());

-- Patients can update their own appointments
drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own"
on public.appointments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Patients can delete their own appointments
drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own"
on public.appointments
for delete
to authenticated
using (user_id = auth.uid());

-- Carers can read linked patients' appointments if scope permits.
-- Requires: public.carer_links table with columns:
-- - carer_id uuid (auth.uid() of carer)
-- - patient_id uuid (owner of data)
-- - scopes jsonb (e.g. {"appointments": true})
drop policy if exists "appointments_select_linked_patient_for_carer" on public.appointments;
create policy "appointments_select_linked_patient_for_carer"
on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.carer_links cl
    where cl.carer_id = auth.uid()
      and cl.patient_id = appointments.user_id
      and coalesce((cl.scopes ->> 'appointments')::boolean, false) = true
  )
);

