import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCommunityTopicOrder } from "@/hooks/use-community-topic-order";
import type { ComposerPostKind, FeedComposerFormBodyProps } from "@/components/community/feed-composer-form-body";
import { MAX_POLL_OPTIONS } from "@/components/community/feed-composer-form-body";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_COMMUNITY_TOPIC,
  FEED_COMPOSER_DRAFT_KEY,
  MAX_POST_IMAGES,
  buildMentionsForPost,
  insertFeedPost,
  readFeedComposerDraft,
  type CommunityPostRow,
  type CommunityTopicId,
} from "@/lib/community";
import { defaultEventStartsAtLocal } from "@/lib/community/event-display";
import { isLikelyImageFile, pickPostImagesFromLibrary } from "@/lib/community/pick-post-images";
import { clickHiddenFileInput } from "@/lib/click-hidden-file-input";
import { canEngageWithCommunityFeed, COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE, useProfile } from "@/lib/profile";

export type UseFeedComposerOptions = {
  /** Called after a successful post (e.g. refresh feed list). */
  onPosted?: (post: CommunityPostRow | null) => void;
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
  const [composerImageAlts, setComposerImageAlts] = useState<string[]>([]);
  const [composerPreviews, setComposerPreviews] = useState<string[]>([]);
  const [composerVideoPreview, setComposerVideoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  const pillPreview = composer.trim() ? composer.trim() : "Share something with the community…";
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
      return;
    }
    const url = URL.createObjectURL(composerVideoFile);
    setComposerVideoPreview(url);
    return () => URL.revokeObjectURL(url);
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

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    setComposerVideoFile(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    const next: File[] = [...composerFiles];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f) continue;
      if (next.length >= MAX_POST_IMAGES) break;
      if (!isLikelyImageFile(f)) continue;
      next.push(f);
    }
    setComposerFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPickVideo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast({ title: "Unsupported file", description: "Choose an MP4, MOV, or WebM video.", variant: "destructive" });
      return;
    }
    setComposerFiles([]);
    setComposerImageAlts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setComposerVideoFile(f);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function removeComposerVideo() {
    setComposerVideoFile(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  async function pickImagesFromLibraryOnly() {
    try {
      const newFiles = await pickPostImagesFromLibrary(composerFiles.length, fileInputRef.current);
      if (newFiles.length > 0) setComposerFiles((prev) => [...prev, ...newFiles].slice(0, MAX_POST_IMAGES));
    } catch (e) {
      clickHiddenFileInput(fileInputRef.current);
      toast({
        title: "Could not open Photos",
        description: e instanceof Error ? e.message : "Try selecting from your camera roll.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeComposerImage(index: number) {
    setComposerFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function resetComposerAfterPost() {
    setComposer("");
    setComposerFiles([]);
    setComposerVideoFile(null);
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
    setSubmitting(true);

    const mentions = await buildMentionsForPost(composer, user.id);

    let res: { data: CommunityPostRow | null; error: Error | null };
    if (composerPostKind === "standard") {
      res = await insertFeedPost({
        kind: "standard",
        topic: composerTopic,
        body: composer,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        videoFile: composerVideoFile ?? undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    } else if (composerPostKind === "poll") {
      res = await insertFeedPost({
        kind: "poll",
        topic: composerTopic,
        body: composer,
        question: pollQuestion,
        options: pollOptions,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    } else {
      const startDate = new Date(eventStartsAt);
      if (Number.isNaN(startDate.getTime())) {
        setSubmitting(false);
        toast({ title: "Invalid date", description: "Choose a valid start date and time.", variant: "destructive" });
        return;
      }
      if (startDate.getTime() < Date.now() - 60_000) {
        setSubmitting(false);
        toast({
          title: "Date is in the past",
          description: "Choose a start time in the future so people know when to show up.",
          variant: "destructive",
        });
        return;
      }
      res = await insertFeedPost({
        kind: "event",
        topic: composerTopic,
        body: composer,
        title: eventTitle,
        startsAt: startDate.toISOString(),
        location: eventLocation.trim() || undefined,
        details: eventDetails.trim() || undefined,
        imageFiles: composerFiles.length ? composerFiles : undefined,
        imageAlts: composerImageAlts,
        mentions,
      });
    }

    setSubmitting(false);
    if (res.error) {
      toast({ title: "Post failed", description: res.error.message, variant: "destructive" });
      return;
    }
    const postedKind = composerPostKind;
    resetComposerAfterPost();
    if (options.closeSheetOnPost !== false) setSheetOpen(false);
    options.onPosted?.(res.data);
    if (!options.suppressPostedToast) {
      toast({
        title:
          options.postedToastTitle ??
          (postedKind === "event" ? "Event shared" : "Posted"),
        description: options.postedToastDescription,
      });
    }
  }

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
    removeComposerImage,
    removeComposerVideo,
    composerImageAlts,
    setComposerImageAlts,
    fileInputRef,
    videoInputRef,
    onPickImages,
    onPickVideo,
    pickImagesFromLibraryOnly,
    onPollModeClick,
    onEventModeClick,
    composerCanSubmit,
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
  };
}
