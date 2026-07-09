/**
 * Environment flags. Safe feature-flag utility for banners, robots, and conditional UI.
 * Never expose secrets. Values come from VITE_APP_ENV at build time.
 */
import { Capacitor } from "@capacitor/core";

export const APP_ENV =
  (import.meta.env.VITE_APP_ENV as string)?.trim() ||
  (import.meta.env.PROD ? "production" : "development");

export const isStaging = APP_ENV === "staging";
export const isProd = APP_ENV === "production";
export const isDev = APP_ENV === "development";

/**
 * Community (timeline + DMs).
 * - Explicit `VITE_FEATURE_COMMUNITY=true|false` always wins.
 * - Dev: on unless `false`.
 * - Production web (Vercel): requires `true` at build time.
 * - Production native (iOS/Android store bundles): on unless explicitly `false`
 *   so a missing env var during `ios:release:sync` does not hide Feed.
 */
export function resolveCommunityEnabled(): boolean {
  if (import.meta.env.VITE_FEATURE_COMMUNITY === "true") return true;
  if (import.meta.env.VITE_FEATURE_COMMUNITY === "false") return false;
  if (import.meta.env.DEV) return true;
  if (import.meta.env.PROD && Capacitor.isNativePlatform?.()) return true;
  return false;
}

export const isCommunityEnabled = resolveCommunityEnabled();

/** DM threads count toward the home-screen badge only when Messages appears in the header. */
export function includeDmThreadsInHomeScreenBadge(): boolean {
  return isCommunityEnabled;
}

/**
 * Diabeaters AI guide (Edge Function + OpenAI). **Visible by default** — `/coach` and the
 * Tools tile register unless you explicitly set `VITE_FEATURE_AI_COACH=false`.
 *
 * LLM calls remain gated server-side by `ENABLE_AI_COACH` + `OPENAI_API_KEY`; consent
 * and rate limits still apply when those are configured.
 */
export const isAiCoachEnabled = import.meta.env.VITE_FEATURE_AI_COACH !== "false";

/**
 * Settings → Notifications: “Send test push” panel (native shell only). Shown in local dev, staging
 * (`VITE_APP_ENV=staging`), or when `VITE_SHOW_PUSH_TEST=true` at build time — never in production.
 */
export const isPushTestUiEnabled =
  isStaging || import.meta.env.VITE_SHOW_PUSH_TEST === "true";
