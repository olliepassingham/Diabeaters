/**
 * Environment flags. Safe feature-flag utility for banners, robots, and conditional UI.
 * Never expose secrets. Values come from VITE_APP_ENV at build time.
 */
export const APP_ENV =
  (import.meta.env.VITE_APP_ENV as string)?.trim() ||
  (import.meta.env.PROD ? "production" : "development");

export const isStaging = APP_ENV === "staging";
export const isProd = APP_ENV === "production";
export const isDev = APP_ENV === "development";

/**
 * Community (timeline + DMs). Production: set `VITE_FEATURE_COMMUNITY=true`.
 * Development: on unless `VITE_FEATURE_COMMUNITY=false`.
 */
export const isCommunityEnabled =
  import.meta.env.VITE_FEATURE_COMMUNITY === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_FEATURE_COMMUNITY !== "false");

/**
 * Diabeaters AI guide (Edge Function + OpenAI). **Visible by default** — `/coach` and the
 * Tools tile register unless you explicitly set `VITE_FEATURE_AI_COACH=false`.
 *
 * LLM calls remain gated server-side by `ENABLE_AI_COACH` + `OPENAI_API_KEY`; consent
 * and rate limits still apply when those are configured.
 */
export const isAiCoachEnabled = import.meta.env.VITE_FEATURE_AI_COACH !== "false";

/**
 * Settings → Notifications: “Send test push” panel (native shell only). Hidden on public App Store /
 * production web builds unless the tester unlocks via About → Version (seven taps on device). Use
 * **staging** or `VITE_SHOW_PUSH_TEST=true` at build time for internal TestFlight / QA.
 */
export const isPushTestUiEnabled =
  isStaging || import.meta.env.VITE_SHOW_PUSH_TEST === "true";
