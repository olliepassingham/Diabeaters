import type { Dispatch, RefObject, SetStateAction } from "react";
import { BarChart2, Calendar, ImagePlus, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MentionTextarea } from "@/components/community/mention-textarea";
import { Textarea } from "@/components/ui/textarea";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { MAX_POST_IMAGES } from "@/lib/community";
import type { CommunityTopicId } from "@/lib/community";
import type { CommunityTopicRow } from "@/lib/community/topics";
import { eventQuickStartPresets } from "@/lib/community/event-display";
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
  removeComposerImage: (index: number) => void;
  composerImageAlts: string[];
  setComposerImageAlts: Dispatch<SetStateAction<string[]>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickImages: (files: FileList | null) => void;
  pickImagesFromLibraryOnly: () => Promise<void>;
  onPollModeClick: () => void;
  onEventModeClick: () => void;
  composerCanSubmit: boolean;
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
  removeComposerImage,
  composerImageAlts,
  setComposerImageAlts,
  fileInputRef,
  onPickImages,
  pickImagesFromLibraryOnly,
  onPollModeClick,
  onEventModeClick,
  composerCanSubmit,
}: FeedComposerFormBodyProps) {
  const audienceInfo =
    "Posts are shared to the Diabeaters community feed. Avoid personal identifiers. Be kind — report anything unsafe.";

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="feed-topic" className="text-sm font-medium text-foreground">
          Topic
        </Label>
        <Select
          value={composerTopic}
          onValueChange={(v) => setComposerTopic(v as CommunityTopicId)}
          disabled={submitting || !user || !canComposeToFeed}
        >
          <SelectTrigger
            id="feed-topic"
            className="h-11 w-full border-border/60 bg-muted/25 text-foreground dark:bg-muted/30 dark:text-foreground [&>span]:text-foreground"
          >
            <SelectValue placeholder="Choose a topic" />
          </SelectTrigger>
          <SelectContent>
            {orderedTopics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {composerPostKind === "poll" ? (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3 text-foreground">
          <div className="space-y-1">
            <Label htmlFor="feed-poll-q">Poll question</Label>
            <Input
              id="feed-poll-q"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value.slice(0, 500))}
              placeholder="What do you want to ask?"
              disabled={submitting || !user || !canComposeToFeed}
              maxLength={500}
            />
          </div>
          <p className="text-xs text-muted-foreground">2–6 options, each up to 500 characters.</p>
          <div className="space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
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
                />
                {pollOptions.length > 2 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
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
                disabled={submitting || !user || !canComposeToFeed}
                onClick={() => setPollOptions((prev) => [...prev, ""])}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add option
              </Button>
            ) : null}
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
      {composerPostKind !== "event" ? (
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium text-foreground">Post</Label>
          <InlineInfoHint ariaLabel="Who can see this?" content={audienceInfo} />
        </div>
        <MentionTextarea
          value={composer}
          onChange={setComposer}
          currentUserId={user?.id}
          hideHint={false}
          placeholder={
            composerPostKind === "poll"
              ? "Optional intro before the poll…"
              : "Share something on the feed…"
          }
          rows={3}
          maxLength={8000}
          disabled={submitting || !user || !canComposeToFeed}
        />
      </div>
      ) : null}
      {composerPostKind !== "event" ? (
      <p className="text-right text-xs text-muted-foreground tabular-nums">{composer.length} / 8000</p>
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
                    <img src={src} alt="" className="h-full w-full object-cover" />
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
        <div className="space-y-2">
          {composerPreviews.map((src, i) => (
            <div key={src} className="space-y-1">
              <Label htmlFor={`feed-composer-alt-${i}`} className="text-xs">
                {composerPostKind === "event" && i === 0 ? "Cover photo description (optional)" : `Photo ${i + 1} description (optional)`}
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
                placeholder="What’s in this image? Helps people using screen readers."
                disabled={submitting || !user || !canComposeToFeed}
                maxLength={500}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="feed-composer-images"
          disabled={submitting || !user || !canComposeToFeed || composerFiles.length >= MAX_POST_IMAGES}
          onChange={(e) => onPickImages(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting || !user || !canComposeToFeed || composerFiles.length >= MAX_POST_IMAGES}
          onClick={() => void pickImagesFromLibraryOnly()}
          aria-label="Add photos to post"
        >
          <ImagePlus className="h-4 w-4 mr-1.5" />
          {composerPostKind === "event" ? "Cover photo" : "Photo"}
        </Button>
        <Button
          type="button"
          variant={composerPostKind === "poll" ? "default" : "outline"}
          size="sm"
          disabled={submitting || !user}
          onClick={onPollModeClick}
          aria-pressed={composerPostKind === "poll"}
          aria-label={composerPostKind === "poll" ? "Switch to normal post" : "Add poll"}
        >
          <BarChart2 className="h-4 w-4 mr-1.5" />
          Poll
        </Button>
        <Button
          type="button"
          variant={composerPostKind === "event" ? "default" : "outline"}
          size="sm"
          disabled={submitting || !user}
          onClick={onEventModeClick}
          aria-pressed={composerPostKind === "event"}
          aria-label={composerPostKind === "event" ? "Switch to normal post" : "Add event"}
        >
          <Calendar className="h-4 w-4 mr-1.5" />
          Event
        </Button>
        <InlineInfoHint ariaLabel="Photo limits for posts" content={`Up to ${MAX_POST_IMAGES} photos per post, 5MB each.`} />
        <Button type="submit" size="sm" className="ml-auto" disabled={submitting || !composerCanSubmit || !canComposeToFeed}>
          <Send className="h-4 w-4 mr-1.5" />
          {composerPostKind === "event" ? "Share event" : "Post"}
        </Button>
      </div>
    </>
  );
}
