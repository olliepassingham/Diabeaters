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

4. **App** — ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set; the client calls `supabase.functions.invoke("notify_carers_on_hypo", …)` after inserting `hypo_logs`.
