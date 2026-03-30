-- Private Storage bucket for account avatars.
-- Object keys used by the app: avatar/{auth.uid()}-{timestamp}.{ext}
-- Run in Supabase SQL Editor after creating bucket "profile_pictures" (Storage UI → private).
--
-- Verification (Dashboard): uploads can succeed while previews fail if SELECT is missing.
--   • Storage → profile_pictures → Policies: ensure an authenticated SELECT policy exists
--     on storage.objects for this bucket (see policy below). The client uses
--     createSignedUrl(), which requires the same read permission as listing/downloading.
--   • Table Editor → profiles.avatar_url should store the object key (e.g. avatar/uuid-123.jpg),
--     not only a public URL (public URLs 403 on a private bucket unless the bucket is public).

begin;

-- Bucket must exist: Storage → New bucket → name profile_pictures → Private

drop policy if exists "profile_pictures: select authenticated" on storage.objects;
create policy "profile_pictures: select authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'profile_pictures');

drop policy if exists "profile_pictures: insert own" on storage.objects;
create policy "profile_pictures: insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile_pictures'
  and name like ('avatar/' || auth.uid()::text || '-%')
);

drop policy if exists "profile_pictures: update own" on storage.objects;
create policy "profile_pictures: update own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile_pictures'
  and name like ('avatar/' || auth.uid()::text || '-%')
)
with check (
  bucket_id = 'profile_pictures'
  and name like ('avatar/' || auth.uid()::text || '-%')
);

drop policy if exists "profile_pictures: delete own" on storage.objects;
create policy "profile_pictures: delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile_pictures'
  and name like ('avatar/' || auth.uid()::text || '-%')
);

commit;
