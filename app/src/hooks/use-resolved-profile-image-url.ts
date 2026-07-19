import { useEffect, useState } from "react";

import { getCachedProfileImageUrl, resolveProfileImageUrlResult } from "@/lib/storage-profile";

export type ResolvedProfileImageState = {
  /** URL suitable for `<img src>` (signed URL for private Storage keys, or passthrough http(s)). */
  displayUrl: string | null;
  /** Set when signing/read failed but a storage key or extractable URL was present. */
  resolveError: string | null;
  /** True while resolving a non-empty avatar value. */
  isPending: boolean;
};

/**
 * Resolves `profiles.avatar_url` for display. Surfaces Storage/RLS errors via `resolveError`.
 * Uses the shared signed-URL cache so feed avatars can paint immediately after prefetch.
 */
export function useResolvedProfileImageUrl(
  avatarUrl: string | null | undefined,
): ResolvedProfileImageState {
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => getCachedProfileImageUrl(avatarUrl));
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(
    () => Boolean(avatarUrl?.trim()) && !getCachedProfileImageUrl(avatarUrl),
  );

  useEffect(() => {
    const raw = avatarUrl?.trim();
    if (!raw) {
      setDisplayUrl(null);
      setResolveError(null);
      setIsPending(false);
      return;
    }

    const hit = getCachedProfileImageUrl(raw);
    if (hit) {
      setDisplayUrl(hit);
      setResolveError(null);
      setIsPending(false);
      return;
    }

    setIsPending(true);
    let cancelled = false;

    void resolveProfileImageUrlResult(raw).then(({ url, error }) => {
      if (cancelled) return;
      setDisplayUrl(url ?? null);
      setResolveError(error ?? null);
      setIsPending(false);
      if (import.meta.env.DEV && error) {
        console.warn("[profile avatar] resolveProfileImageUrl:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  return { displayUrl, resolveError, isPending };
}
