# Self-serve signup and login (Supabase checklist)

Use this when **email/password or OAuth signup** does not work but **manually adding a user** in the Supabase Dashboard does. Manual users are often **email pre-confirmed**; self-serve users must match your project’s auth and URL settings.

## 1. Environment variables (app)

In `app/.env.local` (or your host’s env):

- `VITE_SUPABASE_URL` — **Project Settings → API → Project URL**
- `VITE_SUPABASE_ANON_KEY` — **anon public** key (not the service role key)

Restart the dev server after changes.

## 2. URL configuration (Supabase Dashboard)

**Authentication → URL Configuration**

| Setting | Example |
|--------|---------|
| **Site URL** | `http://localhost:5173` (dev) or your production origin `https://yourdomain.com` |
| **Additional redirect URLs** | Add each origin you use, one per line |

Include at least:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`
- Production: `https://YOUR_DOMAIN/auth/callback`
- Production: `https://YOUR_DOMAIN/auth/email-verify`
- Production: `https://YOUR_DOMAIN/reset-password`

Email verification links and OAuth redirects are rejected if the final URL is not allowlisted.

## 3. Email provider and confirmations

**Authentication → Providers → Email**

- **Enable** the email provider.
- **Confirm email**: when **enabled**, new users get **no session** until they click the link in the email; the app sends them to **Check your email**. If they try to log in before confirming, they may see an error until they verify (or use **Resend** on the check-email page).
- When **Confirm email** is **disabled** (e.g. local testing), signup can return a **session immediately** and the app can send the user straight into the app.

For production deliverability, configure **custom SMTP** under **Project Settings → Auth** if needed.

## 4. OAuth (Apple / Google / Microsoft)

**Authentication → Providers**

Enable and configure each provider you use. Each provider’s developer console must list the same redirect URI as in Supabase, typically:

- `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` (Supabase-hosted redirect)
- Plus any app-specific URLs documented in the main README.

The app redirects the browser to `/auth/callback` after OAuth; that path must be in **Additional redirect URLs** (section 2).

## 5. `profiles` row (database)

If you use `public.profiles` for community or settings, apply migration [`supabase/migrations/20260408150000_auth_profiles_bootstrap.sql`](../supabase/migrations/20260408150000_auth_profiles_bootstrap.sql) so each new `auth.users` row gets a matching `profiles` row (`INSERT` on conflict do nothing).

## Quick test

1. Sign up with a new email → expect “Check your email” **or** straight into the app if confirmations are off.
2. Click the verification link (if used) → should land on `/auth/callback` and then the app.
3. Log out → log in with the same password → should succeed after verification.
