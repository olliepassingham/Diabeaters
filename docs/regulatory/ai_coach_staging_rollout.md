# AI Coach — staging dark launch (runbook)

Use this **after** migrations are applied and the Edge Function is deployed, **before** any production user sees `/coach`.

## 1. Database

1. `supabase db push` (or your CI migration pipeline) so `20260501120000_ai_coach.sql` is applied.
2. Verify columns exist: `profiles.ai_coach_consent_at`, `profiles.ai_coach_consent_version`, tables `ai_coach_audit`, `ai_coach_rate_limits`, function `public.ai_coach_rate_increment`.

## 2. Edge Function

1. Deploy: `supabase functions deploy ai_coach` (JWT verification on; see `supabase/config.toml`).
2. Set secrets in Supabase Dashboard → Edge Functions:
   - `ENABLE_AI_COACH` = `true` **only on staging** at first.
   - `OPENAI_API_KEY` = production or staging key per your OpenAI project policy.
   - Optional: `AI_COACH_MAX_PER_DAY` (default 50).

## 3. Client (Vercel / staging web)

1. The coach UI is visible by default; set `VITE_FEATURE_AI_COACH=false` only if you need to hide `/coach` on a given build.
2. Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` point at the same Supabase project as the deployed function.

## 4. Internal soak (≥ 1 week)

1. Have 3–5 internal testers accept consent and run scripted prompts from [`ai_coach_system_prompt.md`](./ai_coach_system_prompt.md) §9.
2. Log findings as new rows in §9 and patch `interceptor.ts` / `postFilter.ts` / the system prompt as needed.
3. Watch `ai_coach_audit` row volume and OpenAI spend.

## 5. Production

1. Only after DPO/counsel sign-off: repeat steps 2–3 on production Supabase + production Vercel env.
2. Keep `ENABLE_AI_COACH=false` as the safe default for the Edge Function until sign-off; client UI may still appear but LLM calls stay disabled.
