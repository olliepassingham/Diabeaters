# Vercel Environment Variables

Configure environment variables per environment in Vercel so builds and runtime use the correct values.

---

## 1. Project Settings → Environment Variables

**Vercel Dashboard** → your project → **Settings** → **Environment Variables**

Add variables for each environment (Production, Preview, Development).

---

## 2. Production environment

Set these for **Production** (deploys from `main`):

| Variable                | Value                       | Notes                    |
|-------------------------|-----------------------------|--------------------------|
| `VITE_SUPABASE_URL`     | Your production Supabase URL | From Supabase → API      |
| `VITE_SUPABASE_ANON_KEY`| Production anon key         | From Supabase → API      |
| `VITE_APP_ENV`          | `production`                | Enables prod robots, no staging banner |

---

## 3. Preview / Staging environment

Set these for **Preview** (and optionally **Development**):

| Variable                | Value                      | Notes                    |
|-------------------------|----------------------------|--------------------------|
| `VITE_SUPABASE_URL`     | Staging Supabase URL       | From staging project     |
| `VITE_SUPABASE_ANON_KEY`| Staging anon key           | From staging project     |
| `VITE_APP_ENV`          | `staging`                  | Enables staging banner, robots no-index |

CI deploys from `develop` inject these via GitHub Actions secrets. Vercel Preview deploys (e.g. from PRs) will use whatever you set in **Preview** here, or you can leave Preview to rely on CI for `develop` pushes.

---

## 4. Redirect URLs in Supabase

Add the staging domain to Supabase **Authentication → URL Configuration → Redirect URLs**:

```
https://YOUR_STAGING_DOMAIN/auth/callback
https://YOUR_STAGING_DOMAIN/reset-password
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

Replace `YOUR_STAGING_DOMAIN` with e.g. `diabeaters-staging.vercel.app` or your custom staging domain.

---

## 5. Optional: Custom staging domain

1. **Vercel** → Project → **Settings** → **Domains**
2. Add a domain, e.g. `staging-diabeaters.vercel.app` or `staging.yourdomain.com`
3. For Preview deployments, assign this domain to the `develop` branch
4. Add this domain to Supabase Redirect URLs (step 4 above)

---

## 6. Optional: Disable caching on staging

For staging, you may want to avoid aggressive caching. In `vercel.json` you can add headers per route. For a global no-store on staging, this would require edge logic or a separate config. Most staging use cases work fine with default caching; document any overrides here if needed.
