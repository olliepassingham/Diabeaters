# Supabase (carers, hypo logs, in-app notifications)

1. **Migrations** — run in the SQL editor or via CLI (`supabase db push` linked to your project):
   - `supabase/migrations/20250325120000_carers_hypo_logs_notifications.sql`
   - **Feed topic filters** require `supabase/migrations/20260409120000_community_post_topics.sql` (or paste [`docs/sql/community_post_topics.sql`](../docs/sql/community_post_topics.sql)). If the app errors on topic chips with `fetch_community_posts_page` / `schema cache`, apply that migration, then in **Dashboard → Settings → API** use **Reload schema** (or wait a minute) so PostgREST picks up the new RPC.
   - **Supporter hypo check-ins** (“Check they’re OK”) require `supabase/migrations/20260617120000_hypo_check_ins.sql` (or paste [`docs/sql/hypo_check_ins.sql`](../docs/sql/hypo_check_ins.sql)). If the app errors with `create_hypo_check_in` / `schema cache`, run that SQL, **Reload schema**, then deploy `notify_patient_hypo_check_in` and `notify_carer_hypo_check_in_response` (`npm run supabase:deploy-notify-functions`).

2. **Secrets** (Dashboard → Edge Functions → Secrets) for the notify functions:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (often auto-injected)
   - **iOS push (APNs):** `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (full `.p8` body). Optional: `APNS_BUNDLE_ID`, `APNS_USE_SANDBOX` (`true` only for Xcode-to-device debug builds).
   - Legacy relay (optional): `PUSH_NOTIFICATION_API_URL`, `PUSH_NOTIFICATION_API_KEY`

3. **Deploy functions** — **use `--no-verify-jwt`** on the notify functions so the gateway does not reject JWTs before your Deno code runs (each patient-facing handler still calls `auth.getUser(jwt)`; **`notify_supply_low_cron`** expects the **service role** bearer instead). If you skip this flag and only rely on `config.toml`, some CLI versions may not apply `verify_jwt` and you will keep seeing **`401 {"code":401,"message":"Invalid JWT"}`** in the app when activating travel mode, etc.

   **Simplest (no local terminal):** merge `.github/workflows/deploy-supabase-edge-functions.yml`, then in GitHub **Settings → Secrets → Actions** add `SUPABASE_ACCESS_TOKEN` (from [account tokens](https://supabase.com/dashboard/account/tokens)). Open **Actions → Deploy Supabase notify functions → Run workflow**. Optional secret `SUPABASE_PROJECT_REF` overrides the default ref from `config.toml`.

   **From your machine** (after `supabase login` and `supabase link --project-ref …`):

   ```bash
   supabase functions deploy notify_carers_on_hypo --no-verify-jwt
   supabase functions deploy notify_scenario_started --no-verify-jwt
   supabase functions deploy notify_supply_low --no-verify-jwt
   supabase functions deploy notify_supply_low_cron --no-verify-jwt
   supabase functions deploy notify_supporter_appointment_reminders --no-verify-jwt
   supabase functions deploy notify_dm_push --no-verify-jwt
   ```

   Or: `npm run supabase:deploy-notify-functions` (same commands).

   **`config.toml`** duplicates this (`[functions.*] verify_jwt = false`); redeploy after changing either.

4. **Low supply (scheduled)** — apply migration `20260506120000_supplies_forecast_cache.sql` (columns `days_remaining_cached`, `supply_forecast_at` on `public.supplies`). Schedule **`notify_supply_low_cron`** via **Dashboard → Integrations → Cron** (or `pg_cron` + `pg_net` SQL; [docs](https://supabase.com/docs/guides/functions/schedule-functions)): POST to `…/functions/v1/notify_supply_low_cron` with **`Authorization: Bearer <service role>`** and matching **`apikey`**, or set Edge secret **`NOTIFY_SUPPLY_LOW_CRON_SECRET`** and send **`x-notify-supply-low-cron-secret`** ( **`apikey`** can be **anon** for the gateway). Prefer [Vault](https://supabase.com/docs/guides/database/vault) for values in SQL. See `notify_supply_low_cron/index.ts` header.

5. **Supporter appointment reminders (optional cron)** — deploy **`notify_supporter_appointment_reminders`**. The patient app invokes it while open (`AppointmentReminderPoller`). For background delivery when the patient does not open the app, schedule POST to `…/functions/v1/notify_supporter_appointment_reminders` every 15–30 minutes with service role or **`NOTIFY_SUPPORTER_APPT_CRON_SECRET`**. See `notify_supporter_appointment_reminders/index.ts` header and `docs/ios-push-notification-paths.md` (Path F).

6. **App** — ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set; the client POSTs to `functions/v1/notify_carers_on_hypo` (with anon `apikey` + user `Authorization`) after inserting `hypo_logs`.
