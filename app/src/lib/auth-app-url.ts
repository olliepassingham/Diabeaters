import { Capacitor } from "@capacitor/core";

/** Custom URL scheme registered in iOS (Info.plist) for auth deep links back into the Capacitor shell. */
export const NATIVE_AUTH_URL_SCHEME = "diabeaters";

/**
 * Canonical public origin for Supabase auth redirects (signup confirmation, OAuth, password reset).
 *
 * Set `VITE_PUBLIC_SITE_URL` in production (e.g. Vercel) to the exact URL you list under
 * Supabase → Authentication → URL Configuration (Site URL + Redirect URLs). If users sign up
 * from a different origin than that list (preview deployments, extra domains, some WebViews),
 * Supabase may reject the redirect or fail to send confirmation mail reliably.
 *
 * **Email verification (native):** also add `diabeaters://auth/email-verify` under Supabase →
 * Authentication → URL Configuration → Redirect URLs so the confirmation link can reopen the app.
 */
export function getPublicAppOrigin(): string {
  const raw = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();
  const fromEnv = raw.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function getAuthCallbackUrl(): string {
  return `${getPublicAppOrigin()}/auth/callback`;
}

/**
 * Redirect after email confirmation / re-verify / email change — lands on a route that sends users
 * to the login screen. On Capacitor iOS, uses a custom scheme so Mail’s link can reopen the app
 * (https links often open in Safari unless Universal Links are configured).
 */
/** Full native deep link for Supabase “Redirect URLs” (same value as {@link getEmailAuthRedirectUrl} on iOS/Android). */
export const NATIVE_EMAIL_VERIFY_REDIRECT_URL = `${NATIVE_AUTH_URL_SCHEME}://auth/email-verify`;

export function getEmailAuthRedirectUrl(): string {
  if (typeof window !== "undefined" && Capacitor.isNativePlatform?.()) {
    return NATIVE_EMAIL_VERIFY_REDIRECT_URL;
  }
  const origin = getPublicAppOrigin() || (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin.replace(/\/$/, "")}/auth/email-verify`;
}

export function getResetPasswordUrl(): string {
  return `${getPublicAppOrigin()}/reset-password`;
}
