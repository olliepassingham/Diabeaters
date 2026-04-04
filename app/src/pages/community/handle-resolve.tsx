import { useEffect, useState } from "react";
import { Redirect, useRoute } from "wouter";
import { PageHeader, PageShell } from "@/components/layout";
import { getProfileIdByPublicHandle } from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";

function safeDecodePathSegment(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Resolves `/community/u/:handle` to `/community/profile/:userId`. */
export default function CommunityHandleResolvePage() {
  const [, params] = useRoute("/community/u/:handle");
  const handle = params?.handle != null ? safeDecodePathSegment(params.handle) : undefined;
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    void (async () => {
      const { userId } = await getProfileIdByPublicHandle(handle);
      if (cancelled) return;
      if (userId) setResolvedId(userId);
      setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader title="Profile" />
        <p className="text-sm text-muted-foreground">Connect Supabase to open community profiles.</p>
      </PageShell>
    );
  }

  if (resolvedId) {
    return <Redirect to={`/community/profile/${resolvedId}`} replace />;
  }

  if (done && !resolvedId) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader title="Profile" />
        <p className="text-sm text-muted-foreground">No profile found for that handle.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
      <PageHeader title="Profile" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </PageShell>
  );
}
