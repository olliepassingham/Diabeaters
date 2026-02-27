# Avatars Storage (Supabase)

Avatar images are stored in a private Supabase Storage bucket and served via time-limited signed URLs.

## Bucket setup

### STAGING (first)

1. In Supabase Dashboard → **Storage** → **Create Bucket**
2. Name: `avatars`
3. **Private** (checked)
4. Create

Then run the RLS policies below in **SQL Editor** of the same project.

### PRODUCTION (on promotion)

Repeat the same steps in your production Supabase project: create bucket `avatars` (private), then run the RLS SQL.

---

## STAGING setup – RLS policies

```sql
-- Create bucket 'avatars' (via Supabase UI: Storage → Create Bucket → Name 'avatars' → Private)
-- Then run the policies below in SQL Editor of the same environment

begin;

drop policy if exists "storage: select own avatars" on storage.objects;
create policy "storage: select own avatars"
on storage.objects for select
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "storage: insert own avatars" on storage.objects;
create policy "storage: insert own avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "storage: update own avatars" on storage.objects;
create policy "storage: update own avatars"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "storage: delete own avatars" on storage.objects;
create policy "storage: delete own avatars"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

commit;
```

The app uploads to path `avatars/{userId}/{timestamp}-{filename}` within the `avatars` bucket.

---

## Profiles schema

Ensure `profiles` has `full_name` and `avatar_url`:

```sql
-- Run docs/sql/profiles_extend.sql if not already applied
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
```

---

## Rollout checklist

- [ ] **STAGING**: Create bucket `avatars` (private) in Supabase staging project
- [ ] **STAGING**: Run the RLS SQL above in SQL Editor
- [ ] **STAGING**: Run `docs/sql/profiles_extend.sql` if profiles table lacks `full_name` / `avatar_url`
- [ ] **STAGING**: Test upload/display on preview URL (login → /account → upload avatar → verify preview)
- [ ] **PRODUCTION** (on promotion): Repeat bucket creation + RLS SQL in production Supabase project
- [ ] **PRODUCTION**: Run profiles_extend.sql if needed

---

## Future: account deletion Edge Function

A future Edge Function will handle account deletion (auth user + profile + avatars). For now, “Request account deletion” opens a `mailto:` link to support.
