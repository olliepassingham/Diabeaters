import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock3, ImagePlus, Loader2, RefreshCw, Send, Video } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StoryOverlayEditor } from "@/components/community/story-overlay-editor";
import { useToast } from "@/hooks/use-toast";
import { clickHiddenFileInput, FILE_INPUT_HIDDEN_CLASS } from "@/lib/click-hidden-file-input";
import { pickSingleImageFromLibrary } from "@/lib/community/pick-post-images";
import {
  insertCommunityStory,
  MAX_STORY_BYTES,
  MAX_STORY_CAPTION_LENGTH,
  MAX_STORY_OVERLAY_TEXT_LENGTH,
  type StoryOverlay,
} from "@/lib/community/stories-supabase";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted?: () => void;
  /** Opens the composer with this file already selected (e.g. share a post photo). */
  prefillFile?: File | null;
  /** Optional credit overlay (e.g. @handle when sharing someone else's post). */
  prefillOverlayText?: string | null;
  /** Feed post this story should link back to (cleared if the user changes media). */
  sourcePostId?: string | null;
};

function MediaPickCard({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[9.5rem] flex-1 flex-col items-center justify-center gap-3 rounded-[1.35rem] border border-border/50 bg-gradient-to-b from-primary/[0.07] to-muted/20 px-3 py-6 text-center shadow-sm outline-none transition-colors hover:border-primary/35 hover:from-primary/[0.11] hover:to-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 text-primary shadow-sm ring-1 ring-border/40 transition-transform group-hover:scale-[1.03]">
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold tracking-tight text-foreground">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export function StoryCreateSheet({
  open,
  onOpenChange,
  onPosted,
  prefillFile,
  prefillOverlayText,
  sourcePostId,
}: Props) {
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [busy, setBusy] = useState(false);
  const [linkedPostId, setLinkedPostId] = useState<string | null>(null);
  const appliedPrefill = useRef<File | null>(null);

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaption("");
    setOverlays([]);
    setLinkedPostId(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  useEffect(() => {
    if (!open) {
      appliedPrefill.current = null;
      return;
    }
    if (!prefillFile || appliedPrefill.current === prefillFile) return;
    appliedPrefill.current = prefillFile;
    setFile(prefillFile);
    setCaption("");
    setLinkedPostId(sourcePostId?.trim() || null);
    const credit = prefillOverlayText?.trim().slice(0, MAX_STORY_OVERLAY_TEXT_LENGTH);
    setOverlays(
      credit
        ? [{ id: crypto.randomUUID(), text: credit, x: 0.5, y: 0.86, style: "pill" }]
        : [],
    );
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(prefillFile);
    });
  }, [open, prefillFile, prefillOverlayText, sourcePostId]);

  function onPick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    applyPickedFile(f);
  }

  function applyPickedFile(f: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setOverlays([]);
    setLinkedPostId(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  async function handlePost() {
    if (!file || busy) return;
    setBusy(true);
    const res = await insertCommunityStory(file, {
      caption: caption.trim() || undefined,
      overlays,
      sourcePostId: linkedPostId,
    });
    setBusy(false);
    if (res.error) {
      toast({ title: "Story failed", description: res.error.message, variant: "destructive" });
      return;
    }
    reset();
    onOpenChange(false);
    onPosted?.();
    toast({ title: "Story shared", description: "Visible for 24 hours." });
  }

  const maxMb = Math.round(MAX_STORY_BYTES / (1024 * 1024));
  const hasMedia = Boolean(preview && file);

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="New story"
      description="Visible for 24 hours on your profile."
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className={FILE_INPUT_HIDDEN_CLASS}
        onChange={(e) => onPick(e.target.files)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className={FILE_INPUT_HIDDEN_CLASS}
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
        {hasMedia ? (
          <div className="space-y-3">
            <StoryOverlayEditor
              overlays={overlays}
              onChange={setOverlays}
              className="mx-auto aspect-[9/16] h-[min(52vh,28rem)] w-auto max-w-full rounded-[1.35rem] border-white/10 shadow-lg"
            >
              {file?.type.startsWith("video/") ? (
                <video src={preview ?? undefined} className="h-full w-full object-contain" controls playsInline />
              ) : (
                <img src={preview ?? undefined} alt="" className="h-full w-full object-contain" />
              )}
            </StoryOverlayEditor>
            <button
              type="button"
              className="mx-auto flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={reset}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Change media
            </button>
            {linkedPostId ? (
              <p className="text-center text-[11px] text-muted-foreground">
                Viewers can open the original post from this story.
              </p>
            ) : null}
            <Textarea
              id="story-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={MAX_STORY_CAPTION_LENGTH}
              placeholder="Add a caption (optional)"
              rows={2}
              className="min-h-[4.25rem] resize-none rounded-2xl border-border/50 bg-muted/20"
            />
            <p className="text-right text-[11px] tabular-nums text-muted-foreground">
              {caption.length}/{MAX_STORY_CAPTION_LENGTH}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex gap-2.5">
              <MediaPickCard
                icon={<ImagePlus className="h-6 w-6" aria-hidden />}
                title="Photo"
                hint="JPG or PNG"
                onClick={() => {
                  void (async () => {
                    const picked = await pickSingleImageFromLibrary(photoInputRef.current);
                    if (picked) applyPickedFile(picked);
                  })();
                }}
              />
              <MediaPickCard
                icon={<Video className="h-6 w-6" aria-hidden />}
                title="Video"
                hint="MP4, MOV, WebM"
                onClick={() => clickHiddenFileInput(videoInputRef.current)}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Friends can rewatch until it expires · up to {maxMb} MB</span>
            </div>
          </div>
        )}
      </div>

      {hasMedia ? (
        <div className="shrink-0 border-t border-border/50 px-4 py-3">
          <Button
            type="button"
            className={cn("h-12 w-full rounded-full text-[15px] font-semibold")}
            disabled={!file || busy}
            onClick={() => void handlePost()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" aria-hidden />
                Share story
              </>
            )}
          </Button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
