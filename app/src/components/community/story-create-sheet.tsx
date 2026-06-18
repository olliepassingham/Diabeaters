import { useRef, useState } from "react";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { insertCommunityStory, MAX_STORY_BYTES } from "@/lib/community/stories-supabase";

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
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    reset();
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePost() {
    if (!file || busy) return;
    setBusy(true);
    const res = await insertCommunityStory(file);
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
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-black">
            {file.type.startsWith("video/") ? (
              <video src={preview} className="max-h-64 w-full object-contain" controls playsInline />
            ) : (
              <img src={preview} alt="" className="max-h-64 w-full object-contain" />
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full"
              onClick={reset}
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </Button>
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
