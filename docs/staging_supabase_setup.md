# Staging Supabase Setup

This guide covers creating a dedicated Supabase project for the staging environment.

---

## 1. Create the staging project

1. In Supabase Dashboard, click **New project**.
2. Name it e.g. `diabeaters-staging`.
3. Choose a region (same as production if possible).
4. Set a database password and save it securely.
5. Wait for the project to be provisioned.

---

## 2. Copy project credentials

1. Go to **Project Settings** → **API**.
2. Copy the **Project URL** (e.g. `https://xxxxx.supabase.co`).
3. Copy the **anon public** key (Publishable key) under "Project API keys".

These go into your `.env.staging`, Vercel Preview env vars, and GitHub Actions staging secrets. See [ci_secrets_staging.md](ci_secrets_staging.md) for the full checklist.

---

## 3. Configure Authentication → URL Configuration

**Supabase Dashboard** → **Authentication** → **URL Configuration**

- **Site URL**: `https://<STAGING_URL>`  
  Replace `<STAGING_URL>` with your staging domain (e.g. `diabeaters-xxxx.vercel.app` from the Vercel deploy, or a custom staging domain).

- **Redirect URLs** (add each on a new line):

```
https://<STAGING_URL>/auth/callback
https://<STAGING_URL>/reset-password
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

---

## 4. Enable email confirmations (if used in production)

**Authentication** → **Providers** → **Email**  
- Enable **Confirm email** (mirror production settings).

---

## 5. Apply the same schema and RLS as production

In the **SQL Editor** for your staging project, run the following. This creates the `supplies` table and RLS policies (identical to production):

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

If production has additional tables or policies, run the equivalent migrations in the staging project as well.

---

## 6. OAuth providers (optional)

If you use OAuth in production (Apple, Google, Microsoft), configure the same providers in staging with the staging redirect URI:

- Redirect URI: `https://STAGING_DOMAIN/auth/callback`

Use separate OAuth client credentials for staging where possible.

---

## Summary

| Item                  | Production                | Staging                    |
|-----------------------|---------------------------|----------------------------|
| Project name          | e.g. diabeaters           | diabeaters-staging         |
| Site URL              | https://diabeaters.vercel.app | https://<STAGING_URL>   |
| Redirect URLs         | Production domain + localhost | Staging domain + localhost |
| Schema & RLS          | Same                      | Same (copy SQL above)      |
