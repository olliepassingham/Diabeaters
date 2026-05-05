import { NATIVE_AUTH_URL_SCHEME } from "@/lib/auth-app-url";

/**
 * Map a URL opened from outside the WebView (custom scheme or universal link) to a
 * wouter location. Custom schemes like `diabeaters://auth/email-verify?...` parse with
 * `auth` as the URL *host* in JS; we normalize those to `/auth/email-verify?...`.
 */
export function pathFromOpenedAppUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const tail = `${url.pathname || ""}${url.search || ""}${url.hash || ""}`;
    const hostLower = (url.hostname || "").toLowerCase();

    if (url.protocol === "https:" || url.protocol === "http:") {
      const nextPath = tail || "/";
      return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
    }

    const scheme = url.protocol.replace(/:$/, "").toLowerCase();
    if (scheme === NATIVE_AUTH_URL_SCHEME.toLowerCase()) {
      if (hostLower === "auth") {
        const p = tail.startsWith("/") ? tail : `/${tail}`;
        const nextPath = `/auth${p}`;
        return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
      }
      if (!hostLower && tail.startsWith("/auth")) {
        return tail.startsWith("/") && !tail.startsWith("//") ? tail : "/";
      }
    }

    const fallback = tail.startsWith("/") ? tail : `/${hostLower}${tail}`;
    const collapsed = fallback.replace(/\/{2,}/g, "/");
    return collapsed.startsWith("/") && !collapsed.startsWith("//") ? collapsed : "/";
  } catch {
    return null;
  }
}
