/**
 * Canonical public origin for Supabase auth redirects (signup confirmation, OAuth, password reset).
 *
 * Set `VITE_PUBLIC_SITE_URL` in production (e.g. Vercel) to the exact URL you list under
 * Supabase → Authentication → URL Configuration (Site URL + Redirect URLs). If users sign up
 * from a different origin than that list (preview deployments, extra domains, some WebViews),
 * Supabase may reject the redirect or fail to send confirmation mail reliably.
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

export function getResetPasswordUrl(): string {
  return `${getPublicAppOrigin()}/reset-password`;
}
