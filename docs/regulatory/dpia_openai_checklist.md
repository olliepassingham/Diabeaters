# DPIA-style checklist — optional OpenAI / activity advice

Use this when **`ENABLE_ACTIVITY_ADVICE=true`** and **`OPENAI_API_KEY`** are set so `/api/activity/advice` is active. This is a **practical checklist** for GDPR / UK GDPR **Article 9** (special category health data) and subprocessor governance — **not** a substitute for a formal DPIA signed off by your DPO or counsel.

## 1. Lawful basis

- [ ] Document **lawful basis** for processing health-related data (e.g. explicit consent, or another Article 9(2) ground).
- [ ] If relying on **consent**, ensure it is **specific**, **informed**, and **withdrawable**, and that disabling the feature stops transfers.

## 2. Data minimisation

- [ ] Review the **prompt payload**: only send fields **necessary** for the educational answer (avoid unnecessary history).
- [ ] **Retention**: OpenAI API default retention — confirm current **OpenAI** enterprise / API data policies and whether **zero retention** or regional processing is required for your risk appetite.

## 3. Subprocessor

- [ ] **OpenAI** listed in privacy policy as a **subprocessor** when the feature is enabled.
- [ ] **Data processing agreement** or equivalent with OpenAI appropriate to your role (controller vs processor).

## 4. Transparency

- [ ] In-app copy explains that **optional** AI text may be generated using a third-party model and that output is **not medical advice**.

## 5. Security

- [ ] **HTTPS** only for API calls (already expected in deployment).
- [ ] **API key** stored in server environment only, not in client bundles.

## 6. Review

- [ ] Re-run when changing **model**, **prompt**, or **data** sent to the API.

---

## 7. AI Coach — Edge Function `ai_coach` + `ENABLE_AI_COACH`

Use this section when the **`ai_coach`** Edge Function has **`ENABLE_AI_COACH=true`** + **`OPENAI_API_KEY`** so conversational coaching is active. The client normally shows `/coach` unless **`VITE_FEATURE_AI_COACH=false`**. Canonical behaviour: [`ai_coach_system_prompt.md`](./ai_coach_system_prompt.md).

### 7.1 Lawful basis & consent

- [x] **In-app explicit consent** stored server-side on `profiles.ai_coach_consent_at` / `ai_coach_consent_version` before any LLM call (`/coach` UI + Edge Function gate).
- [ ] **Withdrawal**: product decision — today, clearing consent requires a support path or SQL; document the user-facing process (e.g. Account action or support ticket) before wide rollout.
- [ ] **Lawful basis** recorded in your DPIA register (typically explicit consent for Article 9 health data).

### 7.2 Data minimisation & retention

- [x] **Context packer** sends only aggregated numeric / enum fields (see `supabase/functions/_shared/ai-coach/contextPacker.ts`); no names, emails, postcodes, or free-text notes in `context`.
- [x] **Chat history** is held client-side (`localStorage`) only in v1; the server does not persist message bodies.
- [x] **Audit table** (`ai_coach_audit`) stores metadata only — **no** prompt or reply content, only category, `deferToTeam`, post-filter status, latency, token counts, model, `prompt_chars`.
- [ ] **OpenAI retention / zero-retention**: confirm the controller’s OpenAI org settings and, when available, send the documented API flags / org configuration for zero business retention. *Engineering note: wire any new OpenAI “no store” parameters in `llmClient.ts` when your DPO approves the exact mechanism.*

### 7.3 Subprocessor & transparency

- [ ] **OpenAI** listed as a subprocessor in the public privacy policy whenever `ENABLE_AI_COACH` is on in any environment users can access.
- [x] **In-app copy** on `/coach` states educational-only scope, Help Now routing, and that OpenAI may process messages when the feature is enabled.

### 7.4 Security & abuse controls

- [x] **`OPENAI_API_KEY`** only in Supabase Edge secrets (never `VITE_*`, never bundled).
- [x] **User JWT** required (`verify_jwt = true` for `ai_coach` in `supabase/config.toml`); handler re-validates with `auth.getUser`.
- [x] **Per-user rate limit** (`ai_coach_rate_increment` + `AI_COACH_MAX_PER_DAY`, default 50 UTC-day bucket).
- [x] **Pre-LLM interceptor** + **post-LLM filter** per [`ai_coach_system_prompt.md`](./ai_coach_system_prompt.md) §6 / §8.

### 7.5 Breach & audit retention

- [ ] **Personal data breach playbook** updated to include “OpenAI / LLM subprocessor incident” contact steps and user comms templates.
- [ ] **Audit row retention** policy (e.g. 90-day rolling delete for `ai_coach_audit`) agreed and implemented (scheduled job or manual runbook).

### 7.6 Review

- [ ] Re-run this subsection when changing **model**, **system prompt**, **context schema**, **interceptor / post-filter rules**, or **consent copy**.
