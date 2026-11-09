# Third-Party Integrations

| Service | Role | How connected | Tied to Cursor account? | Migration notes |
| --- | --- | --- | --- | --- |
| **GitHub** | Source of truth, Actions CI/CD | `origin` remote; workflows | No (unless Cursor OAuth only) | Keep same repo; re-auth Cursor↔GitHub |
| **Supabase** | DB, Auth, Storage, Edge Functions | `VITE_SUPABASE_*`, service role in Edge | No | Keep same project for Scope A |
| **Vercel** | Web hosting; Capacitor remote URL | Git deploy + Actions token | No | Keep same project; native apps hit `diabeaters.vercel.app` |
| **OpenAI** | AI Coach / Beatie feed | Edge secrets `OPENAI_API_KEY` | No | Dashboard secret; unchanged for Cursor switch |
| **Cloudflare Turnstile** | Auth captcha (optional) | `VITE_TURNSTILE_SITE_KEY` + Supabase captcha secret | No | Confirm if enabled in Auth settings |
| **Sentry** | Client errors (optional) | `VITE_SENTRY_DSN` | No | Same DSN unless rotating |
| **Apple Developer / APNs** | iOS push + signing | Edge APNS_* secrets; Xcode / Apple team | No | Certificates & keys are Apple-account-tied, not Cursor |
| **Google / FCM** | Android push | `google-services.json` (local ignored) + FCM secrets | No | Keep JSON backed up; Play Console is Google-account-tied |
| **Dexcom Share** | CGM readings | Client + Edge Dexcom Share APIs; user credentials encrypted in DB | No | User-linked; no Cursor dependency |
| **Apple Health / Health Connect** | Optional BG / health reads | Capacitor Health plugin | No | Device permissions |
| **News API** (optional) | Headlines | `NEWS_API_KEY` in server/env docs | No | Only if used |
| **Cursor Cloud Agents** | Remote agents / branches | Cursor cloud + GitHub | **Yes** | Recreate access; old branches remain on GitHub |
| **Cursor MCP / browser tools** | Dev tooling | Cursor account MCP auth | **Yes** | Re-authenticate |

## Account ownership that is *not* Cursor

These can silently break shipping if you change the wrong account:

- Apple Developer Team for `com.passingtime.diabeaters`
- Google Play / Firebase project owning `google-services.json`
- GitHub user/org owning Actions secrets
- Supabase org owning the live project
- Vercel team owning `diabeaters`

## Cursor switch recommendation

Leave every row marked “No” alone. Only re-establish Cursor ↔ GitHub and local env/MCP.
