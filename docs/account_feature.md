# Account feature

## Overview

The Account page (`/account`) provides profile management: display name, avatar upload, password reset, and sign out. It is protected by `requireAuth` (via `AuthOnlyLayout`): unauthenticated users are redirected to `/login`. Unverified users can still use the page; an inline banner prompts them to verify.

## Full feature behaviour

- **Heading**: "Your Account"
- **Email**: Read-only, with verification pill (Verified / Unverified)
- **Display name**: Editable, saved via `upsertProfile({ id, full_name })`
- **Avatar**: Upload to Storage → save path to profile → fetch signed URL for preview. Placeholder shows user initial when no avatar.
- **Actions**: Reset password (→ `/reset-request`), Log out, Request account deletion (`mailto:` placeholder)

## Data layer

- `getProfile(userId)`: Select from `profiles` where `id = userId`. Returns `{ profile: null }` if no row.
- `upsertProfile({ id, full_name?, avatar_url? })`: Upsert by primary key `id`. Returns `{ data, error }`.
- `uploadAvatar(userId, file)`: Path `avatars/{userId}/{Date.now()}-{filename}`. Upload with `upsert: true`. Returns `{ path }` only.
- `getSignedAvatarUrl(path)`: Returns `{ url: null }` if path empty. Otherwise `createSignedUrl(path, 3600)` → `{ url }`.

## Avatars bucket & RLS recap

- **Bucket**: `avatars` (private)
- **Path pattern**: `avatars/{userId}/{timestamp}-{filename}`
- **RLS**: Users can select/insert/update/delete only their own avatars (`auth.uid() = (storage.foldername(name))[2]`)

See [docs/storage_avatars.md](storage_avatars.md) for SQL and setup steps.

## Promotion steps

1. **STAGING**: Create bucket `avatars` (private), run RLS SQL, run `profiles_extend.sql` if needed. Test upload and preview.
2. **PRODUCTION** (on promotion): Repeat bucket creation and RLS SQL in the production Supabase project. Run `profiles_extend.sql` if needed.
