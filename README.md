## Local Env

- **Supabase credentials**: In your Supabase project, go to **Project Settings → API** and copy the **project URL** and **public anon key**.
- **.env variables**: Put them in the root `.env` file as:
  - `VITE_SUPABASE_URL=...`
  - `VITE_SUPABASE_ANON_KEY=...`
- **Vite prefix**: The `VITE_` prefix is required for Vite to expose these values to the client (`import.meta.env.VITE_SUPABASE_URL`, etc.).
- **Restart dev server**: After changing `.env`, stop and restart `npm run dev` so Vite picks up the new values.

## Local Development

- **Node**: Node 18+ recommended.
- **Install deps**: `npm install`
- **Env file**: Create a root `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Run dev server**: `npm run dev` → open `http://localhost:5173/`

## Supabase Setup

- **Project keys**: In Supabase, go to **Project Settings → API**, then copy the **project URL** and **anon public key** into your `.env`.
- **Create `supplies` table**: In the Supabase SQL editor, run:

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.supplies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  name text not null,
  quantity int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplies_user_id on public.supplies(user_id);

alter table public.supplies enable row level security;

create policy "Supplies: select own" on public.supplies
  for select using (auth.uid() = user_id);

create policy "Supplies: insert own" on public.supplies
  for insert with check (auth.uid() = user_id);

create policy "Supplies: update own" on public.supplies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Supplies: delete own" on public.supplies
  for delete using (auth.uid() = user_id);
```

- **RLS note**: RLS is enabled; all access is restricted so each user can only read/write rows where `user_id = auth.uid()`.

## Build

- **Build app**: `npm run build`
- **Preview build**: `npm run preview`

