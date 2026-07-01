import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import {
  fetchStoryById,
  getStoryMediaSignedUrl,
  type CommunityStoryRow,
} from "@/lib/community/stories-supabase";
import { getProfilesByIds } from "@/lib/profile";
import { cn } from "@/lib/utils";

type Props = {
  storyId: string;
  className?: string;
};

export function DmSharedStoryPreview({ storyId, className }: Props) {
  const [story, setStory] = useState<CommunityStoryRow | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    setStory(null);
    setAuthorName(null);
    setAuthorAvatar(null);
    setMediaUrl(null);

    void (async () => {
      const res = await fetchStoryById(storyId);
      if (cancelled) return;
      if (res.error || !res.data) {
        setLoading(false);
        setUnavailable(true);
        return;
      }
      const row = res.data;
      setStory(row);

      const prof = await getProfilesByIds([row.author_id]);
      if (cancelled) return;
      const p = prof.get(row.author_id);
      setAuthorName(p?.full_name?.trim() || "Story");
      setAuthorAvatar(p?.avatar_url ?? null);

      const url = await getStoryMediaSignedUrl(row.media_path);
      if (!cancelled) setMediaUrl(url);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [storyId]);

  if (loading) {
    return <div className={cn("h-28 animate-pulse rounded-xl bg-muted/80", className)} aria-hidden />;
  }

  if (unavailable || !story) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-background px-3 py-2.5 text-xs text-muted-foreground",
          className,
        )}
      >
        Story unavailable
      </div>
    );
  }

  const name = authorName ?? "Story";
  const previewText = story.caption?.trim() || (story.media_kind === "video" ? "Video story" : "Photo story");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-background text-left text-foreground shadow-sm",
        className,
      )}
    >
      <Link
        href={`/community?story=${encodeURIComponent(story.id)}`}
        className="block transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {mediaUrl ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/40">
            {story.media_kind === "video" ? (
              <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              Story
            </span>
          </div>
        ) : null}
        <div className="flex gap-2.5 p-2.5">
          <CommunityAuthorAvatar size="sm" displayName={name} avatarPath={authorAvatar} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-xs font-medium text-foreground">{name}&apos;s story</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{previewText}</p>
            <span className="text-xs font-medium text-primary">View story</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
