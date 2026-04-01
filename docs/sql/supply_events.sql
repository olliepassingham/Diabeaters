-- Supply events: auditable stock history (local-first; synced to cloud)
-- Run in Supabase SQL editor.

create table if not exists public.supply_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  supply_id text not null,
  kind text not null,
  delta numeric null,
  stock_now numeric null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists supply_events_user_supply_created_at_idx
  on public.supply_events (user_id, supply_id, created_at desc);

alter table public.supply_events enable row level security;

-- Patient: own rows only
create policy if not exists supply_events_select_own
  on public.supply_events for select
  using (auth.uid() = user_id);

create policy if not exists supply_events_insert_own
  on public.supply_events for insert
  with check (auth.uid() = user_id);

create policy if not exists supply_events_update_own
  on public.supply_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists supply_events_delete_own
  on public.supply_events for delete
  using (auth.uid() = user_id);

-- Carer: can read linked patient's supply events if supplies scope enabled.
-- Assumes public.carer_links exists with: patient_id, carer_id, scopes jsonb.
create policy if not exists supply_events_select_linked_patient_for_carer
  on public.supply_events for select
  using (
    exists (
      select 1
      from public.carer_links cl
      where cl.patient_id = public.supply_events.user_id
        and cl.carer_id = auth.uid()
        and (cl.scopes ->> 'supplies') = 'true'
    )
  );

