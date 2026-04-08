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
