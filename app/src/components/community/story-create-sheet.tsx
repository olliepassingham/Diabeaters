import { useRef, useState } from "react";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StoryOverlayEditor } from "@/components/community/story-overlay-editor";
import { useToast } from "@/hooks/use-toast";
import {
  insertCommunityStory,
  MAX_STORY_BYTES,
  MAX_STORY_CAPTION_LENGTH,
  type StoryOverlay,
} from "@/lib/community/stories-supabase";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted?: () => void;
};

export function StoryCreateSheet({ open, onOpenChange, onPosted }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaption("");
    setOverlays([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setOverlays([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePost() {
    if (!file || busy) return;
    setBusy(true);
    const res = await insertCommunityStory(file, {
      caption: caption.trim() || undefined,
      overlays,
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

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Add to your story"
      description="Share a quick photo or video — visible for 24 hours. Friends can rewatch from your profile until it expires."
      bodyClassName="overflow-y-auto overscroll-contain px-4 pb-4"
    >
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          className="sr-only"
          onChange={(e) => onPick(e.target.files)}
        />
        {preview && file ? (
          <div className="space-y-3">
            <StoryOverlayEditor overlays={overlays} onChange={setOverlays}>
              {file.type.startsWith("video/") ? (
                <video src={preview} className="max-h-64 w-full object-contain" controls playsInline />
              ) : (
                <img src={preview} alt="" className="max-h-64 w-full object-contain" />
              )}
            </StoryOverlayEditor>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={reset}
            >
              <X className="h-4 w-4" />
              Change media
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="story-caption">Caption (optional)</Label>
              <Textarea
                id="story-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={MAX_STORY_CAPTION_LENGTH}
                placeholder="Add context or a question for friends…"
                rows={2}
                className="min-h-[4.5rem] resize-none"
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {caption.length}/{MAX_STORY_CAPTION_LENGTH}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />
              Photo
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Video className="h-4 w-4" />
              Video
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Max {maxMb}MB · MP4, MOV, WebM, or JPG/PNG</p>
        <Button type="button" className="w-full" disabled={!file || busy} onClick={() => void handlePost()}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            "Share story"
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}
