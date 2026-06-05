export function buildPublicProfileShareUrl(opts: {
  userId: string;
  publicHandle?: string | null;
  origin?: string;
}): string {
  const origin =
    opts.origin ?? (typeof window !== "undefined" ? window.location.origin : "https://diabeaters.vercel.app");
  const handle = opts.publicHandle?.replace(/^@/, "").trim();
  const path = handle
    ? `/community/u/${encodeURIComponent(handle)}`
    : `/community/profile/${encodeURIComponent(opts.userId)}`;
  return `${origin}${path}`;
}

export type SharePublicProfileResult = "shared" | "copied" | "failed";

/** Native share sheet when available; otherwise copy link to clipboard. */
export async function sharePublicProfile(opts: {
  userId: string;
  displayName?: string | null;
  publicHandle?: string | null;
}): Promise<SharePublicProfileResult> {
  const url = buildPublicProfileShareUrl({
    userId: opts.userId,
    publicHandle: opts.publicHandle,
  });
  const title = opts.displayName?.trim()
    ? `${opts.displayName.trim()} on Diabeaters`
    : "Diabeaters profile";

  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, url });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "failed";
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
