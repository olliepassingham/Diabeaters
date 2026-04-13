# Troubleshooting: verification email never arrives

Work through this in order. The app uses Supabase Auth (`signUp` + `resend` with `emailRedirectTo`); **delivery and templates are controlled in the Supabase project**, not in this repo.

---

## 1. Confirm you’re on the right Supabase project

- In **Vercel → Production**, open `VITE_SUPABASE_URL`. Its hostname must be **`https://<ref>.supabase.co`** for the **same** project you’re configuring in the dashboard (often *Diabeaters (staging)* if *Diabeaters* is paused).
- **Paused** projects do not reliably send Auth mail. Use an **active** project.

---

## 2. URL configuration (most common)

**Authentication → URL Configuration**

| Field | Must match your live app |
|--------|---------------------------|
| **Site URL** | e.g. `https://diabeaters.vercel.app` |
| **Redirect URLs** | Include `https://diabeaters.vercel.app/auth/callback` and `.../reset-password` |

**Vercel:** `VITE_PUBLIC_SITE_URL` = **same origin** as Site URL (no trailing slash). **Redeploy** after changing it.

If the redirect in the signup request is **not** allowed, Supabase often returns an **error** on sign-up (check the app toast). If URLs were wrong and are now fixed, try a **new** signup or **Resend** from `/check-email`.

---

## 3. Email provider settings

**Authentication → Providers → Email**

- **Confirm email** (or equivalent) must be **enabled** if you expect a verification message.
- **Save** any changes.

---

## 4. CAPTCHA / attack protection (easy to miss)

**Authentication** (or **Project Settings**) → **Attack Protection** / **CAPTCHA**

If **CAPTCHA is required for sign-up**, the app must send a captcha token with `signUp`. This codebase **does not** integrate CAPTCHA yet.

**Fix:** Turn **off** CAPTCHA for sign-up (or only enable it after adding a Turnstile/hCaptcha integration to the signup form).

---

## 5. Logs and rate limits

- **Logs** (or **Auth** section) in the Supabase dashboard: look for failures when you sign up or tap **Resend**.
- **Rate limits:** too many resends can temporarily block sends; wait a few minutes and try again.

### Logs look “OK” but nothing ever hits the inbox

Supabase can **accept** the signup and **hand off** the message to its mail pipeline without surfacing an error in the UI you’re watching. If CAPTCHA is off, URLs match, and you still get **zero** messages (not even spam), this is almost always **deliverability**, not the Diabeaters app code.

**Do this next:**

1. **Authentication → Users** — Confirm the new user row appears with **Waiting for verification** (or equivalent). If yes, Auth created the user; the gap is **mail delivery**.
2. **Custom SMTP (strongly recommended for production)**  
   **Project Settings → Auth** (or **Authentication** → **SMTP Settings**, depending on dashboard version):
   - Enable **custom SMTP**.
   - Use a **transactional** provider: [Resend](https://resend.com), [Postmark](https://postmarkapp.com), SendGrid, Amazon SES, Mailgun, etc.
   - Complete the provider’s **domain verification** (SPF, DKIM, often one or more DNS records). Without this, Gmail and others often **silently delay or drop** mail.
   - Send a **test email** from the provider’s dashboard to your address. If that doesn’t arrive, fix DNS/provider first before retesting Supabase.
3. **Inbox checks** — Gmail: **Spam**, **Promotions**, **All Mail**, and any **filters** that auto-archive or delete.
4. **A/B the mailbox** — Sign up with a **different provider** (e.g. Outlook.com) using a fresh address. If Outlook gets it but Gmail doesn’t, it’s provider-specific filtering.
5. **Wait** — Some providers **greylist** new senders; delivery can lag 15–30+ minutes the first time.

Default Supabase email is fine for experiments; for real users, **custom SMTP + verified domain** is the reliable fix when “everything looks correct” but mail never appears.

---

## 6. Deliverability (inbox vs spam)

- Check **spam / promotions**.
- For production, use **custom SMTP** (Project Settings → Auth → SMTP) so mail comes from your domain and is less likely to be dropped.

---

## 7. User already exists

If the email is already registered (confirmed or not), behaviour depends on Supabase settings. Try **Log in**, or use **another email** for a clean test.

---

## 8. Email template

**Authentication → Email Templates → Confirm signup**

- Ensure the template is present and not disabled (rare misconfiguration).

---

## Quick test

1. Use a **new** mailbox you’ve never used with this project.
2. Sign up from **`https://diabeaters.vercel.app`** (same host as Site URL).
3. Immediately check **Supabase → Authentication → Users** — if the user row appears, Auth accepted the signup; if no mail, focus on **SMTP**, **CAPTCHA**, and **logs**.

For project naming and prod vs staging, see [supabase_project_strategy.md](supabase_project_strategy.md).
