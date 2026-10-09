import type { Dispatch, RefObject, SetStateAction } from "react";
import { BarChart2, Calendar, ImagePlus, Plus, Send, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MentionTextarea } from "@/components/community/mention-textarea";
import { Textarea } from "@/components/ui/textarea";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { MAX_POST_IMAGES, MAX_POST_VIDEO_SECONDS } from "@/lib/community";
import type { CommunityPostAudience, CommunityTopicId } from "@/lib/community";
import type { CommunityTopicRow } from "@/lib/community/topics";
import { eventQuickStartPresets } from "@/lib/community/event-display";
import { clickHiddenFileInput } from "@/lib/click-hidden-file-input";
import { cn } from "@/lib/utils";

export const MAX_POLL_OPTIONS = 6;

export type ComposerPostKind = "standard" | "poll" | "event";

export type FeedComposerFormBodyProps = {
  orderedTopics: readonly CommunityTopicRow[];
  composerTopic: CommunityTopicId;
  setComposerTopic: (v: CommunityTopicId) => void;
  submitting: boolean;
  user: { id: string } | null;
  canComposeToFeed: boolean;
  composerPostKind: ComposerPostKind;
  pollQuestion: string;
  setPollQuestion: (v: string) => void;
  pollOptions: string[];
  setPollOptions: Dispatch<SetStateAction<string[]>>;
  eventTitle: string;
  setEventTitle: (v: string) => void;
  eventStartsAt: string;
  setEventStartsAt: (v: string) => void;
  eventLocation: string;
  setEventLocation: (v: string) => void;
  eventDetails: string;
  setEventDetails: (v: string) => void;
  composer: string;
  setComposer: (v: string) => void;
  composerPreviews: string[];
  composerFiles: File[];
  composerVideoPreview: string | null;
  composerVideoFile: File | null;
  composerVideoDurationSeconds: number | null;
  removeComposerImage: (index: number) => void;
  removeComposerVideo: () => void;
  composerImageAlts: string[];
  setComposerImageAlts: Dispatch<SetStateAction<string[]>>;
  videoInputRef: RefObject<HTMLInputElement>;
  pickImagesFromLibraryOnly: () => Promise<void>;
  onPollModeClick: () => void;
  onEventModeClick: () => void;
  composerCanSubmit: boolean;
  guidedVideoMaxSeconds: number;
  formatVideoDurationSeconds: (totalSeconds: number) => string;
  /** Focus the main text field when the phone sheet opens. */
  autoFocusComposer?: boolean;
  /** Phone sheet puts Post in the header so the keyboard never covers it. */
  hideInlineSubmit?: boolean;
  /** What the send button should say while a post is being prepared or uploaded. */
  submitStatusLabel?: string | null;
  postAudience: CommunityPostAudience;
  setPostAudience: (audience: CommunityPostAudience) => void;
};

export function FeedComposerFormBody({
  orderedTopics,
  composerTopic,
  setComposerTopic,
  submitting,
  user,
  canComposeToFeed,
  composerPostKind,
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
  eventTitle,
  setEventTitle,
  eventStartsAt,
  setEventStartsAt,
  eventLocation,
  setEventLocation,
  eventDetails,
  setEventDetails,
  composer,
  setComposer,
  composerPreviews,
  composerFiles,
  composerVideoPreview,
  composerVideoFile,
  composerVideoDurationSeconds,
  removeComposerImage,
  removeComposerVideo,
  composerImageAlts,
  setComposerImageAlts,
  videoInputRef,
  pickImagesFromLibraryOnly,
  onPollModeClick,
  onEventModeClick,
  composerCanSubmit,
  guidedVideoMaxSeconds,
  formatVideoDurationSeconds,
  autoFocusComposer = false,
  hideInlineSubmit = false,
  submitStatusLabel = null,
  postAudience,
  setPostAudience,
}: FeedComposerFormBodyProps) {
  const audienceInfo =
    "Posts are shared to the Diabeaters community feed. Avoid personal identifiers. Be kind — report anything unsafe.";
  const standardPlaceholder = composerVideoFile
    ? "Share a 30–60s tip from your day…"
    : "Share something…";
  const videoDurationOverGuide =
    composerVideoDurationSeconds != null && composerVideoDurationSeconds > guidedVideoMaxSeconds;

  const topicDisabled = submitting || !user || !canComposeToFeed;

  return (
    <>
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Topic"
      >
        {orderedTopics.map((t) => {
          const selected = composerTopic === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={topicDisabled}
              onClick={() => setComposerTopic(t.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                selected
                  ? "bg-foreground text-background"
                  : "bg-muted/80 text-muted-foreground active:bg-muted",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {composerPostKind === "poll" ? (
        <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.05] to-muted/15 p-3.5 text-foreground dark:from-primary/[0.08]">
          <p className="font-display text-sm font-semibold tracking-tight">Create a poll</p>

          <div className="min-w-0 space-y-1">
            <Label htmlFor="feed-poll-q">Question</Label>
            <Input
              id="feed-poll-q"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value.slice(0, 500))}
              placeholder="What do you want to ask?"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Options</Label>
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold tabular-nums text-primary"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <Input
                  value={opt}
                  onChange={(e) =>
                    setPollOptions((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value.slice(0, 500);
                      return next;
                    })
                  }
                  placeholder={`Option ${i + 1}`}
                  disabled={submitting || !user || !canComposeToFeed}
                  maxLength={500}
                  aria-label={`Poll option ${i + 1}`}
                  className="h-10"
                />
                {pollOptions.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={submitting || !user || !canComposeToFeed}
                    onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full text-xs"
                disabled={submitting || !user || !canComposeToFeed}
                onClick={() => setPollOptions((prev) => [...prev, ""])}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add option
              </Button>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1 border-t border-border/40 pt-2">
            <Label htmlFor="feed-poll-intro">Short intro (optional)</Label>
            <MentionTextarea
              value={composer}
              onChange={setComposer}
              currentUserId={user?.id}
              hideHint
              placeholder="A quick note that appears above the poll…"
              rows={2}
              maxLength={8000}
              disabled={submitting || !user || !canComposeToFeed}
            />
          </div>
        </div>
      ) : null}
      {composerPostKind === "event" ? (
        <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.05] to-muted/15 p-3.5 text-foreground dark:from-primary/[0.08]">
          <div className="space-y-1">
            <p className="font-display text-sm font-semibold tracking-tight">Create an event</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Cover photo</Label>
            {composerPreviews.length > 0 ? (
              <div className="relative overflow-hidden rounded-xl border border-border/50">
                <img src={composerPreviews[0]} alt="" className="h-32 w-full object-cover sm:h-36" />
                <button
                  type="button"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm"
                  onClick={() => removeComposerImage(0)}
                  disabled={submitting}
                  aria-label="Remove cover photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-background/50 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-background/80"
                disabled={submitting || !user || !canComposeToFeed || composerFiles.length >= MAX_POST_IMAGES}
                onClick={() => void pickImagesFromLibraryOnly()}
              >
                <ImagePlus className="h-5 w-5 text-primary/70" aria-hidden />
                Add a cover photo
              </button>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <Label htmlFor="feed-event-title">Event name</Label>
            <Input
              id="feed-event-title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value.slice(0, 500))}
              placeholder="e.g. London T1D coffee meetup"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
              className="h-11"
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="feed-event-start">When</Label>
            <Input
              id="feed-event-start"
              type="datetime-local"
              value={eventStartsAt}
              onChange={(e) => setEventStartsAt(e.target.value)}
              disabled={submitting || !user || !canComposeToFeed}
              className="feed-datetime-input min-w-0 max-w-full text-base text-foreground dark:[color-scheme:dark]"
            />
            <div className="flex flex-wrap gap-1.5">
              {eventQuickStartPresets().map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    eventStartsAt === preset.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/50 bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                  disabled={submitting || !user || !canComposeToFeed}
                  onClick={() => setEventStartsAt(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            <Label htmlFor="feed-event-loc">Where (optional)</Label>
            <Input
              id="feed-event-loc"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value.slice(0, 500))}
              placeholder="Park name, city, or venue"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
              className="h-11"
            />
          </div>

          <div className="min-w-0 space-y-1">
            <Label htmlFor="feed-event-details">About this event</Label>
            <Textarea
              id="feed-event-details"
              value={eventDetails}
              onChange={(e) => setEventDetails(e.target.value.slice(0, 2000))}
              placeholder="Who is it for? What should people bring?"
              rows={3}
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={2000}
              className="surface-field min-h-[5rem] rounded-xl"
            />
          </div>

          <div className="min-w-0 space-y-1 border-t border-border/40 pt-2">
            <Label htmlFor="feed-event-intro">Short intro (optional)</Label>
            <MentionTextarea
              value={composer}
              onChange={setComposer}
              currentUserId={user?.id}
              hideHint
              placeholder="A quick note that appears above the event card…"
              rows={2}
              maxLength={8000}
              disabled={submitting || !user || !canComposeToFeed}
            />
          </div>
        </div>
      ) : null}
      {composerPostKind === "standard" ? (
      <div className="min-w-0">
        <MentionTextarea
          value={composer}
          onChange={setComposer}
          currentUserId={user?.id}
          hideHint
          bare
          autoGrow
          maxGrowPx={320}
          autoFocus={autoFocusComposer}
          placeholder={standardPlaceholder}
          rows={6}
          maxLength={8000}
          disabled={submitting || !user || !canComposeToFeed}
          className="min-h-[9.5rem] px-0.5 text-[17px] leading-snug"
        />
        <div className="flex items-center justify-end gap-2 pt-0.5">
          {composer.length > 0 ? (
            <p className="text-[11px] tabular-nums text-muted-foreground">{composer.length}/8000</p>
          ) : (
            <InlineInfoHint ariaLabel="Who can see this?" content={audienceInfo} />
          )}
        </div>
      </div>
      ) : null}
      {composerVideoPreview && composerPostKind === "standard" ? (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Attached video</p>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={removeComposerVideo}
              disabled={submitting}
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/70 bg-black">
            <video src={composerVideoPreview} controls playsInline preload="metadata" className="max-h-64 w-full" />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Aim for about {guidedVideoMaxSeconds}s. Shows in Watch and on the Feed.
            {composerVideoDurationSeconds != null
              ? ` ${formatVideoDurationSeconds(composerVideoDurationSeconds)}.`
              : null}
            {videoDurationOverGuide ? ` Max ${MAX_POST_VIDEO_SECONDS}s.` : null}
          </p>
          {composerVideoFile?.name ? (
            <p className="truncate text-[11px] text-muted-foreground" title={composerVideoFile.name}>
              {composerVideoFile.name}
            </p>
          ) : null}
        </div>
      ) : null}
      {composerPreviews.length > 0 && composerPostKind !== "event" ? (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 p-3 sm:p-3.5">
          <p className="text-xs font-medium text-muted-foreground">
            Attached photos
            <span className="ml-1.5 tabular-nums text-foreground/80">({composerPreviews.length})</span>
          </p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:thin]">
            {composerPreviews.map((src, i) => {
              const name = composerFiles[i]?.name?.trim() || `Photo ${i + 1}`;
              return (
                <div key={`${src}-${i}`} className="relative w-[5.5rem] shrink-0 sm:w-24">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm">
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeComposerImage(i)}
                      aria-label={`Remove ${name}`}
                      disabled={submitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p
                    className="mt-1.5 truncate text-center text-[10px] leading-tight text-muted-foreground sm:text-xs"
                    title={name}
                  >
                    {name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {composerPreviews.length > 0 ? (
        <details className="rounded-2xl border border-border/50 bg-muted/20">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[13px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
            Add photo descriptions
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {composerPreviews.map((src, i) => (
              <div key={src} className="space-y-1">
                <Label htmlFor={`feed-composer-alt-${i}`} className="text-xs">
                  {composerPostKind === "event" && i === 0 ? "Cover photo" : `Photo ${i + 1}`}
                </Label>
                <Input
                  id={`feed-composer-alt-${i}`}
                  value={composerImageAlts[i] ?? ""}
                  onChange={(e) =>
                    setComposerImageAlts((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value.slice(0, 500);
                      return next;
                    })
                  }
                  placeholder="What’s in this image?"
                  disabled={submitting || !user || !canComposeToFeed}
                  maxLength={500}
                  className="h-10"
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <div className="flex items-start gap-2" role="radiogroup" aria-label="Who can see this post">
        {(
          [
            ["everyone", "Everyone"],
            ["followers", "Followers"],
          ] as const
        ).map(([id, label]) => {
          const selected = postAudience === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={submitting || !user || !canComposeToFeed}
              onClick={() => setPostAudience(id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                selected ? "bg-foreground text-background" : "bg-muted/80 text-muted-foreground active:bg-muted",
              )}
            >
              {label}
            </button>
          );
        })}
        <p className="min-w-0 flex-1 pt-1 text-[11px] leading-snug text-muted-foreground">
          {postAudience === "followers"
            ? "Only people who follow you can see this. Your profile stays public."
            : "Anyone in the community can see this."}
        </p>
      </div>
      <div
        className={cn(
          "sticky bottom-0 z-10 mt-auto flex items-center gap-1 border-t border-border/40 bg-background/95 py-2 backdrop-blur-md",
          hideInlineSubmit
            ? "-mx-4 px-3 pb-[max(0.55rem,calc(env(safe-area-inset-bottom,0px)-var(--keyboard-inset-bottom,0px)))]"
            : "pt-3",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full text-foreground"
          disabled={
            submitting ||
            !user ||
            !canComposeToFeed ||
            composerFiles.length >= MAX_POST_IMAGES ||
            Boolean(composerVideoFile)
          }
          onClick={() => void pickImagesFromLibraryOnly()}
          aria-label={composerPostKind === "event" ? "Add a cover photo" : "Add photos to post"}
        >
          <ImagePlus className="h-5 w-5" />
        </Button>
        {composerPostKind === "standard" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-foreground"
            disabled={
              submitting ||
              !user ||
              !canComposeToFeed ||
              Boolean(composerVideoFile) ||
              composerFiles.length > 0
            }
            onClick={() => clickHiddenFileInput(videoInputRef.current)}
            aria-label="Add video to post"
          >
            <Video className="h-5 w-5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant={composerPostKind === "poll" ? "secondary" : "ghost"}
          size="icon"
          className="h-11 w-11 rounded-full"
          disabled={submitting || !user}
          onClick={onPollModeClick}
          aria-pressed={composerPostKind === "poll"}
          aria-label={composerPostKind === "poll" ? "Switch to normal post" : "Add poll"}
        >
          <BarChart2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant={composerPostKind === "event" ? "secondary" : "ghost"}
          size="icon"
          className="h-11 w-11 rounded-full"
          disabled={submitting || !user}
          onClick={onEventModeClick}
          aria-pressed={composerPostKind === "event"}
          aria-label={composerPostKind === "event" ? "Switch to normal post" : "Add event"}
        >
          <Calendar className="h-5 w-5" />
        </Button>
        <InlineInfoHint
          ariaLabel="Media limits for posts"
          content={`Up to ${MAX_POST_IMAGES} photos (5MB each) or one short video (~${guidedVideoMaxSeconds}s, max ${MAX_POST_VIDEO_SECONDS}s, MP4/MOV/WebM). After you pick a video you can cut the length.`}
        />
        {hideInlineSubmit ? null : (
          <Button
            type="submit"
            className="ml-auto h-10 rounded-full px-4 text-sm font-semibold"
            disabled={submitting || !composerCanSubmit || !canComposeToFeed}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {submitting
              ? submitStatusLabel ?? "Posting…"
              : composerPostKind === "event"
                ? "Share event"
                : composerPostKind === "poll"
                  ? "Share poll"
                  : "Post"}
          </Button>
        )}
      </div>
    </>
  );
}
