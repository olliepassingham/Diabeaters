import { Calendar, ExternalLink, Heart, MapPin } from "lucide-react";

import { CommunityPostImageGrid } from "@/components/community/community-post-image-grid";
import { Button } from "@/components/ui/button";
import {
  buildMapsSearchUrl,
  eventTimingLabel,
  formatEventWhen,
  getEventTiming,
} from "@/lib/community/event-display";
import type { CommunityEventExtra } from "@/lib/community/post-kinds";
import { cn } from "@/lib/utils";

export function FeedEventCard({
  event,
  imagePaths,
  imageAltTexts,
  interestedCount = 0,
  interestedByMe = false,
  viewerCanReact = false,
  onInterested,
  onShowInterested,
  className,
}: {
  event: CommunityEventExtra;
  imagePaths: string[];
  imageAltTexts?: string[];
  interestedCount?: number;
  interestedByMe?: boolean;
  viewerCanReact?: boolean;
  onInterested?: () => void;
  onShowInterested?: () => void;
  className?: string;
}) {
  const timing = getEventTiming(event.starts_at);
  const isPast = timing === "past";
  const mapsUrl = event.location?.trim() ? buildMapsSearchUrl(event.location) : null;
  const canMarkInterest = viewerCanReact && !isPast;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm ring-1 ring-border/40",
        isPast
          ? "border-border/50 bg-muted/15 opacity-90"
          : "border-primary/20 bg-gradient-to-b from-primary/[0.06] to-muted/15 dark:from-primary/10 dark:to-muted/10",
        className,
      )}
    >
      {imagePaths.length > 0 ? (
        <CommunityPostImageGrid
          paths={imagePaths}
          altTexts={imageAltTexts}
          variant="event-banner"
          eventTitle={event.title}
        />
      ) : (
        <div
          className={cn(
            "flex h-28 items-center justify-center bg-gradient-to-br sm:h-32",
            isPast ? "from-muted/40 to-muted/20" : "from-primary/15 via-primary/5 to-muted/20",
          )}
          aria-hidden
        >
          <Calendar className={cn("h-10 w-10", isPast ? "text-muted-foreground/50" : "text-primary/40")} />
        </div>
      )}

      <div className="space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-display text-base font-semibold leading-snug tracking-tight text-foreground">
              {event.title}
            </p>
            <p className="text-sm text-muted-foreground">{formatEventWhen(event.starts_at)}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              isPast
                ? "bg-muted text-muted-foreground"
                : timing === "today" || timing === "tomorrow"
                  ? "bg-primary/15 text-primary"
                  : "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
            )}
          >
            {eventTimingLabel(timing, event.starts_at)}
          </span>
        </div>

        {event.location?.trim() ? (
          <a
            href={mapsUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-start gap-1.5 text-sm text-foreground/90 underline-offset-4 hover:text-primary hover:underline"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 break-words">{event.location.trim()}</span>
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" aria-hidden />
          </a>
        ) : null}

        {event.details?.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{event.details.trim()}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            type="button"
            variant={interestedByMe ? "default" : "outline"}
            size="sm"
            className="h-8 rounded-full text-xs"
            disabled={!canMarkInterest}
            aria-pressed={interestedByMe}
            aria-label={
              isPast
                ? "This event has passed"
                : interestedByMe
                  ? "Remove interest"
                  : "Mark interested"
            }
            title={isPast ? "This event has passed" : undefined}
            onClick={onInterested}
          >
            <Heart className={cn("mr-1.5 h-3.5 w-3.5", interestedByMe && "fill-current")} aria-hidden />
            Interested
          </Button>
          {interestedCount > 0 && onShowInterested ? (
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={onShowInterested}
            >
              {interestedCount} {interestedCount === 1 ? "person" : "people"} interested
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
