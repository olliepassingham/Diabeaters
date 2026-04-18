/**
 * Supabase configuration checks. No network calls; purely client-side.
 * Used by DevBanner in development only.
 */
import { getPublicAppOrigin, NATIVE_EMAIL_VERIFY_REDIRECT_URL } from "./auth-app-url";

export const REQUIRED_REDIRECTS: string[] = [
  "/auth/callback",
  "/auth/email-verify",
  "/reset-password",
];

/**
 * Returns full redirect URLs for copy/paste into Supabase.
 * Uses window.location.origin for the current domain.
 */
export function getRequiredRedirectUrls(): string[] {
  const origins = new Set<string>();
  const primary = getPublicAppOrigin();
  if (primary) origins.add(primary);
  if (typeof window !== "undefined") origins.add(window.location.origin);

  const urls = new Set<string>();
  for (const origin of origins) {
    for (const path of REQUIRED_REDIRECTS) {
      urls.add(`${origin}${path}`);
    }
  }
  urls.add(NATIVE_EMAIL_VERIFY_REDIRECT_URL);
  if (typeof window !== "undefined") {
    const o = window.location.origin;
    if (o.includes("localhost") || o.includes("127.0.0.1")) {
      urls.add("http://localhost:5173/auth/callback");
      urls.add("http://localhost:5173/auth/email-verify");
      urls.add("http://localhost:5173/reset-password");
    }
  }
  return [...urls];
}

/**
 * Returns copy-paste block for Supabase URL Configuration.
 */
export function getRedirectUrlsCopyBlock(): string {
  const origin = window.location.origin;
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const lines: string[] = [
    `https://YOUR_DOMAIN/auth/callback`,
    `https://YOUR_DOMAIN/auth/email-verify`,
    `https://YOUR_DOMAIN/reset-password`,
    `diabeaters://auth/email-verify`,
    `http://localhost:5173/auth/callback`,
    `http://localhost:5173/auth/email-verify`,
    `http://localhost:5173/reset-password`,
  ];
  if (isLocalhost) {
    lines.push(`${origin}/auth/callback`, `${origin}/reset-password`);
  }
  return [...new Set(lines)].join("\n");
}

export function getSupabaseConfigWarnings(): string[] {
  const warnings: string[] = [];

  const url = (import.meta.env.VITE_SUPABASE_URL as string)?.trim() || "";
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim() || "";

  if (!url || !key) {
    warnings.push(
      "Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and restart the dev server.",
    );
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;

    if (import.meta.env.PROD && origin.startsWith("http://")) {
      warnings.push(
        "Production build is being served over HTTP. Use HTTPS for production.",
      );
    }

    if (
      origin.startsWith("https://") &&
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1")
    ) {
      warnings.push(
        "If using a production domain, add the redirect URLs below to Supabase Dashboard → Authentication → URL Configuration.",
      );
    }
  }

  return warnings;
}
