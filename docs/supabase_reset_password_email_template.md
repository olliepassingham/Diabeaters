# Supabase password reset email template (PKCE / cross-browser)

The app uses **PKCE** auth (`flowType: "pkce"`). Supabase’s default **Reset password** template uses `{{ .ConfirmationURL }}`, which redirects to your app with `?code=…`. That code only works in the **same browser** where the user tapped “Send reset link” (e.g. not when Mail opens Safari, or when the Diabeaters app vs Safari have separate storage).

**Fix:** change the template to send a **token hash** link the app can verify on any device.

## Steps (Supabase Dashboard)

1. **Authentication → Email Templates → Reset password**
2. Replace the reset link with **one** of these (pick the style you prefer):

### Option A — direct to reset page (recommended)

```html
<h2>Reset password</h2>
<p>Follow this link to reset your password for Diabeaters:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
```

`{{ .RedirectTo }}` is set by the app to `https://diabeaters.vercel.app/reset-password` (via `VITE_PUBLIC_SITE_URL`).

### Option B — via `/auth/confirm` (same behaviour)

```html
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset password</a></p>
```

3. **Save** the template.
4. **Authentication → URL Configuration → Redirect URLs** must include:
   - `https://diabeaters.vercel.app/reset-password`
   - `https://diabeaters.vercel.app/auth/confirm`
   - (and your local dev URLs if needed)
5. Request a **new** reset email (old links still use the previous template).

## Verify

After deploying the app fix and updating the template:

1. Go to `/reset-request` and submit your email.
2. Open the new email on your phone (or any browser).
3. You should land on **Set new password**, not “Invalid or expired link”.

## Related

- [troubleshooting_auth_email.md](troubleshooting_auth_email.md) — Site URL / redirect allowlist
- [Supabase: Password-based auth (PKCE)](https://supabase.com/docs/guides/auth/passwords?flow=pkce)
