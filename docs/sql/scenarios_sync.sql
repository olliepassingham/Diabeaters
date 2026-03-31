-- Scenarios ↔ Supabase (support stable upsert by scenario_key)
--
-- Run in Supabase SQL editor.
-- Safe to re-run.

-- Ensure the scenarios table has a stable natural key for upserts:
-- one row per (user_id, scenario_key).
create unique index if not exists scenarios_user_key_uniq
  on public.scenarios (user_id, scenario_key);

