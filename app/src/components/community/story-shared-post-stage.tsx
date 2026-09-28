import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { renderBodyWithMentions } from "@/components/community/render-body-with-mentions";
import {
  fetchCommunityPostById,
  getPostImageSignedUrls,
  getPostVideoSignedUrl,
  parseEventExtra,
  parsePollExtra,
  type CommunityPostRow,
} from "@/lib/community";
import { getProfilesByIds } from "@/lib/profile";
import { cn } from "@/lib/utils";

type AuthorMeta = {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
};

type SharedMedia =
  | { kind: "images"; urls: string[] }
  | { kind: "video"; url: string };

type Props = {
  postId: string;
  className?: string;
  onOpenPost: () => void;
  onOpenAuthor: (authorId: string) => void;
};

function AuthorChip({
  author,
  post,
  onLight,
  onOpenAuthor,
}: {
  author: AuthorMeta;
  post: CommunityPostRow;
  onLight: boolean;
  onOpenAuthor: (authorId: string) => void;
}) {
  return (
    <Link
      href={`/community/profile/${encodeURIComponent(author.id)}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpenAuthor(author.id);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 outline-none transition-colors focus-visible:ring-2",
        onLight
          ? "hover:bg-slate-900/[0.04] focus-visible:ring-teal-600/35"
          : "bg-white/15 text-white hover:bg-white/20 focus-visible:ring-white/40",
      )}
      data-testid="story-shared-post-author-link"
    >
      <CommunityAuthorAvatar
        displayName={author.name}
        avatarPath={author.avatarUrl}
        size="sm"
        className="!h-10 !w-10 shrink-0"
      />
      <span className={cn("min-w-0 flex-1 text-left", onLight ? "text-foreground" : "text-white")}>
        <span className="block truncate text-[15px] font-semibold leading-tight">{author.name}</span>
        <span className={cn("block truncate text-[13px] leading-tight", onLight ? "text-muted-foreground" : "text-white/70")}>
          {author.handle ? `@${author.handle}` : "View profile"}
          {post.created_at
            ? ` · ${formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}`
            : ""}
        </span>
      </span>
    </Link>
  );
}

function PhotoCollage({ urls }: { urls: string[] }) {
  if (urls.length <= 1) {
    return <img src={urls[0]} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />;
  }
  if (urls.length === 2) {
    return (
      <div className="pointer-events-none absolute inset-0 grid grid-cols-2 gap-0.5">
        {urls.map((url) => (
          <img key={url} src={url} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
    );
  }
  if (urls.length === 3) {
    return (
      <div className="pointer-events-none absolute inset-0 grid grid-rows-[1.15fr_0.85fr] gap-0.5">
        <img src={urls[0]} alt="" className="h-full w-full object-cover" />
        <div className="grid grid-cols-2 gap-0.5">
          <img src={urls[1]} alt="" className="h-full w-full object-cover" />
          <img src={urls[2]} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
      {urls.slice(0, 4).map((url) => (
        <img key={url} src={url} alt="" className="h-full w-full object-cover" />
      ))}
    </div>
  );
}

/**
 * Full-bleed story stage for a reshared feed post.
 * The card matches the feed: author, photos, caption, and a tap through to the post.
 */
export function StorySharedPostStage({ postId, className, onOpenPost, onOpenAuthor }: Props) {
  const [post, setPost] = useState<CommunityPostRow | null>(null);
  const [author, setAuthor] = useState<AuthorMeta | null>(null);
  const [media, setMedia] = useState<SharedMedia | null>(null);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const toggleMute = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMuted((m) => !m);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPost(null);
    setAuthor(null);
    setMedia(null);
    setMuted(true);

    void (async () => {
      const res = await fetchCommunityPostById(postId);
      if (cancelled) return;
      if (res.error || !res.data) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const row = res.data;
      setPost(row);

      const prof = await getProfilesByIds([row.author_id]);
      if (cancelled) return;
      const p = prof.get(row.author_id);
      const name = p?.full_name?.trim() || "Member";
      const handle = p?.public_handle?.trim().replace(/^@/, "") || null;
      setAuthor({
        id: row.author_id,
        name,
        handle,
        avatarUrl: p?.avatar_url ?? null,
      });

      const videoPath = row.video_url?.trim() || null;
      if (videoPath) {
        const url = await getPostVideoSignedUrl(videoPath);
        if (!cancelled && url) setMedia({ kind: "video", url });
      } else {
        const paths = (row.image_urls ?? []).filter(Boolean).slice(0, 4);
        if (paths.length > 0) {
          const urls = (await getPostImageSignedUrls(paths)).filter((url): url is string => Boolean(url));
          if (!cancelled && urls.length > 0) setMedia({ kind: "images", urls });
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black",
          className,
        )}
        aria-hidden
      >
        <div className="h-10 w-10 animate-pulse rounded-full bg-teal-800/15" />
      </div>
    );
  }

  if (failed || !post || !author) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black px-8",
          className,
        )}
      >
        <p className="text-center text-sm text-white/75">This post is no longer available.</p>
      </div>
    );
  }

  const poll = post.post_kind === "poll" ? parsePollExtra(post.post_extra) : null;
  const event = post.post_kind === "event" ? parseEventExtra(post.post_extra) : null;
  const body = post.body.trim();
  const caption =
    (event?.title?.trim() && body === event.title.trim() ? "" : body) ||
    event?.title?.trim() ||
    "";
  const quoteText = poll?.question?.trim() || caption || "Shared from the feed";
  const showMediaCard = Boolean(media) && !poll;
  const footerCaption = caption || event?.title?.trim() || "";

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        showMediaCard ? "bg-black" : "bg-gradient-to-br from-[#d7ebe4] via-[#f6f1e8] to-[#e8f4f1]",
        className,
      )}
      data-testid="story-shared-post-stage"
    >
      {showMediaCard && media ? (
        <>
          {media.kind === "images" ? (
            <img
              src={media.urls[0]}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              aria-hidden
            />
          ) : (
            <video
              src={media.url}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              aria-hidden
            />
          )}
          <div className="absolute inset-0 bg-black/70" />
        </>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[9] flex flex-col px-3.5 pb-[max(6.75rem,env(safe-area-inset-bottom))] pt-[max(5.25rem,calc(env(safe-area-inset-top)+4rem))] sm:px-5">
        {showMediaCard && media ? (
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden rounded-[1.6rem] bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)]">
            <div className="pointer-events-auto flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <AuthorChip author={author} post={post} onLight onOpenAuthor={onOpenAuthor} />
              </div>
              <span className="shrink-0 rounded-full bg-teal-700/10 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-teal-800">
                Shared post
              </span>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-100">
              <button
                type="button"
                className="pointer-events-auto absolute inset-0 z-0 cursor-pointer border-0 bg-transparent"
                aria-label="View original post"
                data-testid="button-story-open-post"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPost();
                }}
              />
              {media.kind === "images" ? (
                <PhotoCollage urls={media.urls} />
              ) : (
                <video
                  src={media.url}
                  muted={muted}
                  loop
                  playsInline
                  autoPlay
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  data-testid="story-shared-post-video"
                />
              )}
              {media.kind === "video" ? (
                <button
                  type="button"
                  className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
                  onClick={toggleMute}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label={muted ? "Unmute video" : "Mute video"}
                  data-testid="story-shared-post-mute"
                >
                  {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                </button>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2 px-4 pb-3.5 pt-3">
              {footerCaption ? (
                <button
                  type="button"
                  className="pointer-events-auto line-clamp-4 text-left text-sm font-normal leading-snug text-foreground"
                  data-testid="story-shared-post-caption"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPost();
                  }}
                >
                  <span className="mr-1.5 font-semibold">{author.name}</span>
                  <span className="whitespace-pre-wrap">{renderBodyWithMentions(footerCaption, post.mention_map ?? {})}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="pointer-events-auto self-start text-sm font-semibold text-teal-800"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPost();
                }}
              >
                View post
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-1">
            <button
              type="button"
              className="pointer-events-auto min-h-0 overflow-hidden text-left"
              aria-label="View original post"
              data-testid="button-story-open-post"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPost();
              }}
            >
              <p
                className="mb-3 select-none font-serif text-[4.75rem] leading-none text-teal-700/20"
                aria-hidden
              >
                “
              </p>
              <p className="-mt-8 line-clamp-[10] text-balance font-serif text-[1.45rem] font-medium leading-snug tracking-tight text-slate-900 sm:text-[1.7rem]">
                {poll ? quoteText : renderBodyWithMentions(quoteText, {})}
              </p>
              {poll?.options?.length ? (
                <ul className="mt-5 space-y-2">
                  {poll.options.slice(0, 4).map((opt) => (
                    <li
                      key={opt}
                      className="rounded-2xl border border-slate-900/10 bg-white/75 px-3.5 py-2.5 text-sm font-medium text-slate-800"
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
              ) : null}
            </button>
            <div className="pointer-events-auto mt-6 rounded-2xl bg-white/75 p-1 shadow-sm ring-1 ring-slate-900/5">
              <AuthorChip author={author} post={post} onLight onOpenAuthor={onOpenAuthor} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
