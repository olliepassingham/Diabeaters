-- Supply Tracker ↔ Supabase sync (patient write + carer read-only)
--
-- Goal:
-- - Patients can CRUD their own supplies rows.
-- - Linked carers can SELECT a patient's supplies when `carer_links.scopes.supplies = true`.
-- - Client sync uses `updated_at` for last-write-wins reconciliation.

-- 1) Table
create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity integer not null default 0,
  unit text,
  category text,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists supplies_user_id_idx on public.supplies (user_id);
create index if not exists supplies_user_updated_at_idx on public.supplies (user_id, updated_at desc);

-- 2) updated_at trigger — stock fields only (forecast cache must not steal LWW)
create or replace function public.set_supplies_stock_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (
    new.quantity is not distinct from old.quantity
    and new.name is not distinct from old.name
    and new.unit is not distinct from old.unit
    and new.category is not distinct from old.category
    and new.notes is not distinct from old.notes
    and new.user_id is not distinct from old.user_id
  ) then
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_supplies_updated_at on public.supplies;
create trigger set_supplies_updated_at
before update on public.supplies
for each row
execute function public.set_supplies_stock_updated_at();

-- 3) RLS
alter table public.supplies enable row level security;

-- Patients can read their own supplies
drop policy if exists "supplies_select_own" on public.supplies;
create policy "supplies_select_own"
on public.supplies
for select
to authenticated
using (user_id = auth.uid());

-- Patients can insert their own supplies
drop policy if exists "supplies_insert_own" on public.supplies;
create policy "supplies_insert_own"
on public.supplies
for insert
to authenticated
with check (user_id = auth.uid());

-- Patients can update their own supplies
drop policy if exists "supplies_update_own" on public.supplies;
create policy "supplies_update_own"
on public.supplies
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Patients can delete their own supplies
drop policy if exists "supplies_delete_own" on public.supplies;
create policy "supplies_delete_own"
on public.supplies
for delete
to authenticated
using (user_id = auth.uid());

-- Carers can read linked patients' supplies if scope permits.
-- Requires: public.carer_links with (carer_id, patient_id, scopes jsonb).
drop policy if exists "supplies_select_linked_patient_for_carer" on public.supplies;
create policy "supplies_select_linked_patient_for_carer"
on public.supplies
for select
to authenticated
using (
  exists (
    select 1
    from public.carer_links cl
    where cl.carer_id = auth.uid()
      and cl.patient_id = supplies.user_id
      and coalesce((cl.scopes ->> 'supplies')::boolean, false) = true
  )
);
