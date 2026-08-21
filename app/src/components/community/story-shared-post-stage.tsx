import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { renderBodyWithMentions } from "@/components/community/render-body-with-mentions";
import {
  fetchCommunityPostById,
  getPostImageSignedUrls,
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
      <span className={cn("min-w-0 flex-1 text-left", onLight ? "text-slate-900" : "text-white")}>
        <span className="block truncate text-sm font-semibold tracking-tight">{author.name}</span>
        <span className={cn("block truncate text-xs", onLight ? "text-slate-500" : "text-white/70")}>
          {author.handle ? `@${author.handle}` : "View profile"}
          {post.created_at
            ? ` · ${formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}`
            : ""}
        </span>
      </span>
    </Link>
  );
}

/**
 * Full-bleed interactive stage for stories that reshare a feed post.
 * Image posts keep the photo clear; caption sits below in a fixed footer band.
 */
export function StorySharedPostStage({ postId, className, onOpenPost, onOpenAuthor }: Props) {
  const [post, setPost] = useState<CommunityPostRow | null>(null);
  const [author, setAuthor] = useState<AuthorMeta | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPost(null);
    setAuthor(null);
    setThumbUrl(null);

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

      const path = row.image_urls?.[0] || null;
      if (path) {
        const urls = await getPostImageSignedUrls([path]);
        if (!cancelled && urls[0]) setThumbUrl(urls[0]);
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
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#d7ebe4] via-[#f6f1e8] to-[#e8f4f1]",
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
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#d7ebe4] via-[#f6f1e8] to-[#e8f4f1] px-8",
          className,
        )}
      >
        <p className="text-center text-sm text-slate-600">This post is no longer available.</p>
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
  const showPhotoCard = Boolean(thumbUrl) && !poll;

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden bg-gradient-to-br from-[#d7ebe4] via-[#f6f1e8] to-[#e8f4f1]",
        className,
      )}
      data-testid="story-shared-post-stage"
    >
      {/* Soft blurred photo wash behind the card (image posts only). */}
      {showPhotoCard && thumbUrl ? (
        <>
          <img
            src={thumbUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#d7ebe4]/88 via-[#f6f1e8]/92 to-[#e8f4f1]/95" />
        </>
      ) : null}

      <button
        type="button"
        className="absolute inset-0 z-[8] cursor-pointer border-0 bg-transparent"
        aria-label="View original post"
        data-testid="button-story-open-post"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPost();
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[9] flex flex-col px-3.5 pb-[max(6.75rem,env(safe-area-inset-bottom))] pt-[max(5.25rem,calc(env(safe-area-inset-top)+4rem))] sm:px-5">
        {showPhotoCard && thumbUrl ? (
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/8">
            {/* Image stays clear — never covered by caption. */}
            <div className="relative min-h-0 flex-[1.35] overflow-hidden bg-slate-100">
              <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              {event ? (
                <div className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                  Event
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 px-3.5 pb-3 pt-3">
              {caption || event?.title ? (
                <p className="line-clamp-4 text-[0.95rem] font-medium leading-snug tracking-tight text-slate-900 sm:text-base">
                  {event && event.title.trim() && caption !== event.title.trim() ? (
                    <>
                      <span className="font-semibold">{event.title.trim()}</span>
                      {caption ? (
                        <>
                          <span className="text-slate-400"> · </span>
                          {renderBodyWithMentions(caption, {})}
                        </>
                      ) : null}
                    </>
                  ) : (
                    renderBodyWithMentions(caption || event?.title || "", {})
                  )}
                </p>
              ) : null}
              <div className="pointer-events-auto border-t border-slate-900/8 pt-2">
                <AuthorChip author={author} post={post} onLight onOpenAuthor={onOpenAuthor} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-1">
            <div className="min-h-0 overflow-hidden">
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
            </div>
            <div className="pointer-events-auto mt-6 rounded-2xl bg-white/75 p-1 shadow-sm ring-1 ring-slate-900/5">
              <AuthorChip author={author} post={post} onLight onOpenAuthor={onOpenAuthor} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
