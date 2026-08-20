/** Custom URL scheme registered in iOS (Info.plist) and Android for older verification emails. */
export const NATIVE_AUTH_URL_SCHEME = "diabeaters";

/**
 * Canonical public origin for Supabase auth redirects (signup confirmation, OAuth, password reset).
 *
 * Set `VITE_PUBLIC_SITE_URL` in production (e.g. Vercel) to the exact URL you list under
 * Supabase → Authentication → URL Configuration (Site URL + Redirect URLs). If users sign up
 * from a different origin than that list (preview deployments, extra domains, some WebViews),
 * Supabase may reject the redirect or fail to send confirmation mail reliably.
 *
 * Email links always use this HTTPS origin (not `diabeaters://`) so Gmail/Outlook can open them
 * and so Android remote WebViews do not send a custom-scheme redirect that is easy to reject.
 * Keep `diabeaters://auth/email-verify` in Redirect URLs so older emails still work.
 */
export function getPublicAppOrigin(): string {
  const raw = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();
  const fromEnv = raw.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    // Capacitor bundled / custom-scheme WebViews are not shareable https origins.
    if (/^https?:\/\//i.test(origin) && !/^https?:\/\/localhost\b/i.test(origin)) {
      return origin;
    }
  }
  return "https://diabeaters.vercel.app";
}

/** Absolute https URL for share sheets and external deep links (always the public site). */
export function buildPublicAppUrl(path: string): string {
  const origin = getPublicAppOrigin().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export function getAuthCallbackUrl(): string {
  return `${getPublicAppOrigin()}/auth/callback`;
}

/** Older native deep link still listed in Supabase Redirect URLs. */
export const NATIVE_EMAIL_VERIFY_REDIRECT_URL = `${NATIVE_AUTH_URL_SCHEME}://auth/email-verify`;

export function getEmailAuthRedirectUrl(): string {
  return `${getPublicAppOrigin().replace(/\/$/, "")}/auth/email-verify`;
}

export function getResetPasswordUrl(): string {
  return `${getPublicAppOrigin()}/reset-password`;
}

/**
 * Where `/auth/confirm` should send the user after a token_hash link.
 * Defaults used to be `/reset-password`, which broke signup confirmation links.
 */
export function nextPathAfterAuthConfirm(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const nextParam = params.get("next");
  if (nextParam?.startsWith("/") && !nextParam.startsWith("//")) {
    return nextParam;
  }
  const type = params.get("type");
  if (type === "recovery") return "/reset-password";
  if (type === "signup" || type === "email" || type === "invite" || type === "magiclink") {
    return "/verified-return";
  }
  return "/login";
}
