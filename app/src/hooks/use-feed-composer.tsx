import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useCommunityTopicOrder } from "@/hooks/use-community-topic-order";
import type { ComposerPostKind, FeedComposerFormBodyProps } from "@/components/community/feed-composer-form-body";
import { MAX_POLL_OPTIONS } from "@/components/community/feed-composer-form-body";
import { FeedVideoTrimSheet } from "@/components/community/feed-video-trim-sheet";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_COMMUNITY_TOPIC,
  FEED_COMPOSER_DRAFT_KEY,
  GUIDED_POST_VIDEO_MAX_SECONDS,
  MAX_POST_IMAGES,
  VIDEO_POST_DEFAULT_CONTENT_NOTE,
  buildMentionsForPost,
  formatVideoDurationSeconds,
  insertFeedPost,
  isLikelyVideoFile,
  readFeedComposerDraft,
  readVideoFileDurationSeconds,
  type CommunityPostRow,
  type CommunityTopicId,
} from "@/lib/community";
import { defaultEventStartsAtLocal } from "@/lib/community/event-display";
import { isLikelyImageFile, pickPostImagesFromLibrary } from "@/lib/community/pick-post-images";
import { preparePostImageFiles } from "@/lib/community/prepare-post-image";
import type { PreparedPostVideo } from "@/lib/community/prepare-post-video";
import {
  beginFilePickerHold,
  clickHiddenFileInput,
  FILE_INPUT_HIDDEN_CLASS,
} from "@/lib/click-hidden-file-input";
import { canEngageWithCommunityFeed, COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE, useProfile } from "@/lib/profile";
import { MAX_POST_VIDEO_BYTES } from "@/lib/community/posts-supabase";

export type UseFeedComposerOptions = {
  /** Called after a successful post (e.g. refresh feed list). `pendingId` matches an optimistic row when one was shown. */
  onPosted?: (post: CommunityPostRow | null, pendingId?: string) => void;
  /** Show a local post immediately, before photos or video finish uploading. */
  onOptimisticPost?: (post: CommunityPostRow) => void;
  /** Remove that local post if sending fails. */
  onOptimisticFailed?: (pendingId: string) => void;
  /** Close the bottom sheet after posting (typical on phone). */
  closeSheetOnPost?: boolean;
  /** Custom toast title on success; defaults to "Posted". */
  postedToastTitle?: string;
  /** Custom toast description on success. */
  postedToastDescription?: string;
  /** When true, skip the default success toast (use `onPosted` for custom toasts). */
  suppressPostedToast?: boolean;
};

export function useFeedComposer(options: UseFeedComposerOptions = {}) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const orderedTopics = useCommunityTopicOrder();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(readFeedComposerDraft()?.body?.trim());
    } catch {
      return false;
    }
  });
  const [composerTopic, setComposerTopic] = useState<CommunityTopicId>(
    () => readFeedComposerDraft()?.topic ?? DEFAULT_COMMUNITY_TOPIC,
  );
  const [composer, setComposer] = useState(() => readFeedComposerDraft()?.body ?? "");
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [composerVideoFile, setComposerVideoFile] = useState<File | null>(null);
  const [composerVideoPosterFile, setComposerVideoPosterFile] = useState<File | null>(null);
  const [composerVideoDurationSeconds, setComposerVideoDurationSeconds] = useState<number | null>(null);
  const [trimSourceFile, setTrimSourceFile] = useState<File | null>(null);
  const [trimSheetOpen, setTrimSheetOpen] = useState(false);
  const [composerImageAlts, setComposerImageAlts] = useState<string[]>([]);
  const [composerPreviews, setComposerPreviews] = useState<string[]>([]);
  const [composerVideoPreview, setComposerVideoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusLabel, setSubmitStatusLabel] = useState<string | null>(null);
  const [composerPostKind, setComposerPostKind] = useState<ComposerPostKind>("standard");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const hasFeedHandle = Boolean(profile?.public_handle?.trim());
  const canComposeToFeed =
    Boolean(user?.id) && !profileLoading && canEngageWithCommunityFeed(profile);

  const pillPreview = composer.trim()
    ? composer.trim()
    : composerVideoFile
      ? "Share a 30–60s tip from your day…"
      : "Write a post…";
  const avatarDisplayName = (profile?.full_name ?? user?.email ?? "You").trim() || "You";
  const avatarPath = profile?.avatar_url ?? null;
  const profileHref = user?.id ? `/community/profile/${encodeURIComponent(user.id)}` : undefined;

  useEffect(() => {
    const urls = composerFiles.map((f) => URL.createObjectURL(f));
    setComposerPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [composerFiles]);

  useEffect(() => {
    if (!composerVideoFile) {
      setComposerVideoPreview(null);
      setComposerVideoDurationSeconds(null);
      return;
    }
    const url = URL.createObjectURL(composerVideoFile);
    setComposerVideoPreview(url);
    let cancelled = false;
    void readVideoFileDurationSeconds(composerVideoFile).then((duration) => {
      if (!cancelled) setComposerVideoDurationSeconds(duration);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [composerVideoFile]);

  useEffect(() => {
    setComposerImageAlts((prev) => {
      const n = composerFiles.length;
      if (prev.length === n) return prev;
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  }, [composerFiles.length]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (!composer.trim()) {
          localStorage.removeItem(FEED_COMPOSER_DRAFT_KEY);
          return;
        }
        localStorage.setItem(
          FEED_COMPOSER_DRAFT_KEY,
          JSON.stringify({ body: composer, topic: composerTopic }),
        );
      } catch {
        /* quota / private mode */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [composer, composerTopic]);

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    // Snapshot before any clears or awaits — FileList is live on some phones.
    const list = Array.from(files);
    setComposerVideoFile(null);
    setComposerVideoPosterFile(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    const raw: File[] = [];
    for (const f of list) {
      if (!f) continue;
      if (composerFiles.length + raw.length >= MAX_POST_IMAGES) break;
      if (!isLikelyImageFile(f)) continue;
      raw.push(f);
    }
    const picked = raw.slice();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (picked.length === 0) {
      toast({
        title: "Couldn't add that photo",
        description: "Choose a JPG, PNG, or HEIC image.",
        variant: "destructive",
      });
      return;
    }

    // Keep / reopen the composer so the attach is visible after the OS picker closes.
    setSheetOpen(true);
    setComposerFiles((prev) => [...prev, ...picked].slice(0, MAX_POST_IMAGES));

    const prepared = await preparePostImageFiles(picked);
    if (prepared.error) {
      toast({
        title: "Photo too large",
        description: prepared.error.message,
        variant: "destructive",
      });
    }
    setComposerFiles((prev) => {
      const kept = prev.filter((f) => !picked.includes(f));
      return [...kept, ...prepared.files].slice(0, MAX_POST_IMAGES);
    });
  }

  async function onPickVideo(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (!f) return;
    // Keep a stable File reference before clearing the input.
    const picked = f;
    if (!isLikelyVideoFile(picked)) {
      toast({ title: "Unsupported file", description: "Choose an MP4, MOV, or WebM video.", variant: "destructive" });
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (picked.size > MAX_POST_VIDEO_BYTES) {
      toast({
        title: "Video too large",
        description: "Keep the file to 50MB or smaller.",
        variant: "destructive",
      });
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    // Keep the composer open under the trim sheet after the OS picker closes.
    setSheetOpen(true);
    setTrimSourceFile(picked);
    setTrimSheetOpen(true);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function onTrimConfirm(prepared: PreparedPostVideo) {
    setComposerFiles([]);
    setComposerImageAlts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setComposerVideoFile(prepared.video);
    setComposerVideoPosterFile(prepared.poster);
    if (composerTopic === DEFAULT_COMMUNITY_TOPIC) {
      setComposerTopic("tips-what-worked");
    }
    setTrimSourceFile(null);
    setSheetOpen(true);
  }

  function removeComposerVideo() {
    setComposerVideoFile(null);
    setComposerVideoPosterFile(null);
    setComposerVideoDurationSeconds(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  async function pickImagesFromLibraryOnly() {
    // Nested hold: keep the sheet open while Camera returns AND while we compress/apply.
    const endHold = Capacitor.isNativePlatform() ? beginFilePickerHold() : () => {};
    try {
      const newFiles = await pickPostImagesFromLibrary(composerFiles.length, fileInputRef.current);
      if (newFiles.length > 0) {
        setSheetOpen(true);
        setComposerFiles((prev) => [...prev, ...newFiles].slice(0, MAX_POST_IMAGES));
        const prepared = await preparePostImageFiles(newFiles);
        if (prepared.error) {
          toast({
            title: "Photo too large",
            description: prepared.error.message,
            variant: "destructive",
          });
        }
        setComposerFiles((prev) => {
          const kept = prev.filter((f) => !newFiles.includes(f));
          return [...kept, ...prepared.files].slice(0, MAX_POST_IMAGES);
        });
        // Native path returned files — safe to reset the fallback input.
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      // Web path: pickPostImagesFromLibrary only clicks the input and returns [].
      // Do not clear the input here — that races the system picker and drops the first selection.
    } catch (e) {
      clickHiddenFileInput(fileInputRef.current);
      toast({
        title: "Could not open Photos",
        description: e instanceof Error ? e.message : "Try selecting from your camera roll.",
        variant: "destructive",
      });
    } finally {
      endHold();
    }
  }

  function removeComposerImage(index: number) {
    setComposerFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function resetComposerAfterPost() {
    setComposer("");
    setComposerFiles([]);
    setComposerVideoFile(null);
    setComposerVideoPosterFile(null);
    setComposerVideoDurationSeconds(null);
    setComposerImageAlts([]);
    setComposerPostKind("standard");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setEventTitle("");
    setEventStartsAt("");
    setEventLocation("");
    setEventDetails("");
    try {
      localStorage.removeItem(FEED_COMPOSER_DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  function onPollModeClick() {
    if (composerPostKind === "poll") {
      setComposerPostKind("standard");
      return;
    }
    setEventTitle("");
    setEventStartsAt("");
    setEventLocation("");
    setEventDetails("");
    setComposerPostKind("poll");
  }

  function onEventModeClick() {
    if (composerPostKind === "event") {
      setComposerPostKind("standard");
      return;
    }
    setPollQuestion("");
    setPollOptions(["", ""]);
    if (!eventStartsAt.trim()) {
      setEventStartsAt(defaultEventStartsAtLocal());
    }
    setComposerPostKind("event");
  }

  const composerCanSubmit = useMemo(() => {
    if (!user) return false;
    if (composerPostKind === "standard") {
      const t = composer.trim();
      return Boolean(t || composerFiles.length > 0 || composerVideoFile);
    }
    if (composerPostKind === "poll") {
      const q = pollQuestion.trim();
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      return q.length > 0 && opts.length >= 2 && opts.length <= MAX_POLL_OPTIONS;
    }
    const titleOk = eventTitle.trim().length > 0;
    const whenOk = eventStartsAt.trim().length > 0;
    return titleOk && whenOk;
  }, [user, composerPostKind, composer, composerFiles.length, composerVideoFile, pollQuestion, pollOptions, eventTitle, eventStartsAt]);

  const composerExpandSignal = useMemo(() => {
    if (composer.trim()) return true;
    if (composerFiles.length > 0) return true;
    if (composerVideoFile) return true;
    if (composerPostKind !== "standard") return true;
    return false;
  }, [composer, composerFiles.length, composerVideoFile, composerPostKind]);

  function buildOptimisticPost(
    pendingId: string,
    imageUrls: string[],
    videoUrl: string | null,
    mentions: { userIds: string[]; mentionMap: Record<string, string> },
  ): CommunityPostRow {
    const trimmed = composer.trim();
    let body = trimmed;
    let postExtra: CommunityPostRow["post_extra"] = null;
    if (composerPostKind === "poll") {
      const question = pollQuestion.trim();
      body = trimmed || question;
      postExtra = {
        question,
        options: pollOptions.map((option) => option.trim()).filter(Boolean),
      };
    } else if (composerPostKind === "event") {
      const title = eventTitle.trim();
      body = trimmed || title;
      const extra: { title: string; starts_at: string; location?: string; details?: string } = {
        title,
        starts_at: new Date(eventStartsAt).toISOString(),
      };
      const location = eventLocation.trim();
      const details = eventDetails.trim();
      if (location) extra.location = location;
      if (details) extra.details = details;
      postExtra = extra;
    }
    return {
      id: pendingId,
      author_id: user?.id ?? "",
      body,
      topic: composerTopic,
      image_urls: videoUrl ? [] : imageUrls,
      image_alt_texts: composerImageAlts,
      video_url: videoUrl,
      video_poster_url: null,
      content_note: composerVideoFile ? VIDEO_POST_DEFAULT_CONTENT_NOTE : null,
      post_kind: composerPostKind,
      post_extra: postExtra,
      mention_map: mentions.mentionMap,
      mentioned_user_ids: mentions.userIds,
      is_reported: false,
      comment_count: 0,
      like_count: 0,
      liked_by_me: false,
      interested_count: 0,
      interested_by_me: false,
      saved_by_me: false,
      created_at: new Date().toISOString(),
      author_preview: {
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        public_handle: profile?.public_handle ?? null,
      },
    };
  }

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!user || !composerCanSubmit) return;
    if (!canComposeToFeed) {
      toast({
        title: "Set up your public profile",
        description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (composerPostKind === "event") {
      const startDate = new Date(eventStartsAt);
      if (Number.isNaN(startDate.getTime())) {
        toast({ title: "Invalid date", description: "Choose a valid start date and time.", variant: "destructive" });
        return;
      }
      if (startDate.getTime() < Date.now() - 60_000) {
        toast({
          title: "Date is in the past",
          description: "Choose a start time in the future so people know when to show up.",
          variant: "destructive",
        });
        return;
      }
    }
    setSubmitting(true);
    setSubmitStatusLabel(
      composerFiles.length > 0 ? "Preparing…" : composerVideoFile ? "Uploading…" : "Posting…",
    );

    let pendingId: string | null = null;
    try {
      const mentions = await buildMentionsForPost(composer, user.id);

      let imageFiles = composerFiles;
      if (imageFiles.length > 0) {
        const prepared = await preparePostImageFiles(imageFiles);
        imageFiles = prepared.files;
        if (prepared.error) {
          const canContinueWithoutPhotos =
            Boolean(composer.trim()) || Boolean(composerVideoFile) || imageFiles.length > 0;
          toast({
            title: imageFiles.length > 0 ? "Some photos skipped" : "Photos couldn't be attached",
            description: prepared.error.message,
            variant: "destructive",
          });
          if (!canContinueWithoutPhotos) return;
        }
        if (imageFiles.length !== composerFiles.length) {
          setComposerFiles(imageFiles);
        }
      }

      setSubmitStatusLabel(
        composerVideoFile ? "Uploading…" : imageFiles.length > 0 ? "Uploading…" : "Posting…",
      );

      if (options.onOptimisticPost) {
        pendingId = `pending:${crypto.randomUUID()}`;
        const localImageUrls = imageFiles.map((file) => URL.createObjectURL(file));
        const localVideoUrl = composerVideoFile ? URL.createObjectURL(composerVideoFile) : null;
        options.onOptimisticPost(buildOptimisticPost(pendingId, localImageUrls, localVideoUrl, mentions));
        if (options.closeSheetOnPost !== false) setSheetOpen(false);
      }

      let res: { data: CommunityPostRow | null; error: Error | null };
      if (composerPostKind === "standard") {
        res = await insertFeedPost({
          kind: "standard",
          topic: composerTopic,
          body: composer,
          imageFiles: imageFiles.length ? imageFiles : undefined,
          videoFile: composerVideoFile ?? undefined,
          videoPosterFile: composerVideoPosterFile ?? undefined,
          imageAlts: composerImageAlts,
          contentNote: composerVideoFile ? VIDEO_POST_DEFAULT_CONTENT_NOTE : null,
          mentions,
        });
      } else if (composerPostKind === "poll") {
        res = await insertFeedPost({
          kind: "poll",
          topic: composerTopic,
          body: composer,
          question: pollQuestion,
          options: pollOptions,
          imageFiles: imageFiles.length ? imageFiles : undefined,
          imageAlts: composerImageAlts,
          mentions,
        });
      } else {
        res = await insertFeedPost({
          kind: "event",
          topic: composerTopic,
          body: composer,
          title: eventTitle,
          startsAt: new Date(eventStartsAt).toISOString(),
          location: eventLocation.trim() || undefined,
          details: eventDetails.trim() || undefined,
          imageFiles: imageFiles.length ? imageFiles : undefined,
          imageAlts: composerImageAlts,
          mentions,
        });
      }

      if (res.error) {
        if (pendingId) {
          options.onOptimisticFailed?.(pendingId);
          if (options.closeSheetOnPost !== false) setSheetOpen(true);
        }
        toast({ title: "Post failed", description: res.error.message, variant: "destructive" });
        return;
      }
      const postedKind = composerPostKind;
      resetComposerAfterPost();
      if (!pendingId && options.closeSheetOnPost !== false) setSheetOpen(false);
      options.onPosted?.(res.data, pendingId ?? undefined);
      if (!options.suppressPostedToast) {
        toast({
          title:
            options.postedToastTitle ??
            (postedKind === "event" ? "Event shared" : "Posted"),
          description: options.postedToastDescription,
        });
      }
    } catch (err) {
      if (pendingId) {
        options.onOptimisticFailed?.(pendingId);
        if (options.closeSheetOnPost !== false) setSheetOpen(true);
      }
      toast({
        title: "Post failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setSubmitStatusLabel(null);
    }
  }

  const imagesDisabled =
    submitting ||
    !user ||
    !canComposeToFeed ||
    composerFiles.length >= MAX_POST_IMAGES ||
    Boolean(composerVideoFile);
  const videoDisabled =
    submitting ||
    !user ||
    !canComposeToFeed ||
    composerPostKind !== "standard" ||
    Boolean(composerVideoFile) ||
    composerFiles.length > 0;

  // Keep file inputs mounted outside the drawer so a dismiss race cannot destroy
  // them mid-picker (that used to drop the first photo/video selection on phones).
  const mediaFileInputs: ReactNode =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className={FILE_INPUT_HIDDEN_CLASS}
              id="feed-composer-images"
              disabled={imagesDisabled}
              onChange={(e) => {
                const list = e.target.files;
                void onPickImages(list);
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className={FILE_INPUT_HIDDEN_CLASS}
              id="feed-composer-video"
              disabled={videoDisabled}
              onChange={(e) => {
                const list = e.target.files;
                void onPickVideo(list);
              }}
            />
          </>,
          document.body,
        )
      : null;

  const videoTrimSheet: ReactNode = (
    <FeedVideoTrimSheet
      open={trimSheetOpen}
      file={trimSourceFile}
      onOpenChange={(next) => {
        setTrimSheetOpen(next);
        if (!next) setTrimSourceFile(null);
      }}
      onConfirm={onTrimConfirm}
    />
  );

  const composerExtras: ReactNode = (
    <>
      {mediaFileInputs}
      {videoTrimSheet}
    </>
  );

  const formBodyProps: FeedComposerFormBodyProps = {
    orderedTopics,
    composerTopic,
    setComposerTopic,
    submitting,
    user: user ? { id: user.id } : null,
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
    guidedVideoMaxSeconds: GUIDED_POST_VIDEO_MAX_SECONDS,
    formatVideoDurationSeconds,
    submitStatusLabel,
  };

  return {
    sheetOpen,
    setSheetOpen,
    pillPreview,
    avatarDisplayName,
    avatarPath,
    profileHref,
    hasFeedHandle,
    canComposeToFeed,
    submitting,
    composerExpandSignal,
    formBodyProps,
    handlePost,
    composer,
    videoTrimSheet,
    composerExtras,
  };
}
