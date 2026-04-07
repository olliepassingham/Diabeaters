# Supabase (carers, hypo logs, in-app notifications)

1. **Migrations** — run in the SQL editor or via CLI (`supabase db push` linked to your project):
   - `supabase/migrations/20250325120000_carers_hypo_logs_notifications.sql`
   - **Feed topic filters** require `supabase/migrations/20260409120000_community_post_topics.sql` (or paste [`docs/sql/community_post_topics.sql`](../docs/sql/community_post_topics.sql)). If the app errors on topic chips with `fetch_community_posts_page` / `schema cache`, apply that migration, then in **Dashboard → Settings → API** use **Reload schema** (or wait a minute) so PostgREST picks up the new RPC.

2. **Secrets** for Edge Function `notify_carers_on_hypo`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (often auto-injected)
   - Optional: `PUSH_NOTIFICATION_API_URL`, `PUSH_NOTIFICATION_API_KEY`

3. **Deploy functions** — **use `--no-verify-jwt`** so the gateway does not reject valid user JWTs before your Deno code runs (each handler still calls `auth.getUser(jwt)`). If you skip this flag and only rely on `config.toml`, some CLI versions may not apply `verify_jwt` and you will keep seeing **`401 {"code":401,"message":"Invalid JWT"}`** in the app when activating travel mode, etc.

   From the repo root (after `supabase login` and `supabase link --project-ref …`):

   ```bash
   supabase functions deploy notify_carers_on_hypo --no-verify-jwt
   supabase functions deploy notify_scenario_started --no-verify-jwt
   supabase functions deploy notify_supply_low --no-verify-jwt
   ```

   Or: `npm run supabase:deploy-notify-functions` (same commands).

   **`config.toml`** duplicates this (`[functions.*] verify_jwt = false`); redeploy after changing either.

4. **App** — ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set; the client POSTs to `functions/v1/notify_carers_on_hypo` (with anon `apikey` + user `Authorization`) after inserting `hypo_logs`.
