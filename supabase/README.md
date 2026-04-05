# Supabase (carers, hypo logs, in-app notifications)

1. **Migrations** — run in the SQL editor or via CLI:
   - `supabase/migrations/20250325120000_carers_hypo_logs_notifications.sql`

2. **Secrets** for Edge Function `notify_carers_on_hypo`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (often auto-injected)
   - Optional: `PUSH_NOTIFICATION_API_URL`, `PUSH_NOTIFICATION_API_KEY`

3. **Deploy function**:
   ```bash
   supabase functions deploy notify_carers_on_hypo
   ```
   **`config.toml` and JWT at the edge** — `[functions.notify_carers_on_hypo] verify_jwt` controls whether Supabase validates the JWT *before* your Deno code runs. This project sets `verify_jwt = false` and validates the user JWT inside the function instead. **After you change `verify_jwt` (or anything in `config.toml` for this function), redeploy** so the hosted project picks it up; otherwise you can see gateway `401` responses with `execution_id: null` in Invocations.

4. **App** — ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set; the client POSTs to `functions/v1/notify_carers_on_hypo` (with anon `apikey` + user `Authorization`) after inserting `hypo_logs`.
