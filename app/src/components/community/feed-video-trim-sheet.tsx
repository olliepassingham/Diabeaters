import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Scissors } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  formatVideoDurationSeconds,
  GUIDED_POST_VIDEO_MAX_SECONDS,
  MAX_POST_VIDEO_SECONDS,
  readVideoFileDurationSeconds,
} from "@/lib/community/feed-video-limits";
import {
  defaultVideoTrimRange,
  preparePostVideo,
  type PreparedPostVideo,
  type VideoTrimRange,
} from "@/lib/community/prepare-post-video";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  file: File | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (prepared: PreparedPostVideo) => void;
};

export function FeedVideoTrimSheet({ open, file, onOpenChange, onConfirm }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<VideoTrimRange>({ startSec: 0, endSec: GUIDED_POST_VIDEO_MAX_SECONDS });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) {
      setObjectUrl(null);
      setDuration(0);
      setError(null);
      setBusy(false);
      setProgress(0);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    let cancelled = false;
    void readVideoFileDurationSeconds(file).then((seconds) => {
      if (cancelled) return;
      const dur = seconds && seconds > 0 ? seconds : 0;
      setDuration(dur);
      setRange(defaultVideoTrimRange(dur || GUIDED_POST_VIDEO_MAX_SECONDS));
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !objectUrl) return;
    video.currentTime = range.startSec;
  }, [objectUrl, range.startSec]);

  const selectedSeconds = Math.max(0, range.endSec - range.startSec);
  const overHardCap = selectedSeconds > MAX_POST_VIDEO_SECONDS + 0.05;
  const overGuide = selectedSeconds > GUIDED_POST_VIDEO_MAX_SECONDS + 0.05;
  const durationLabel = useMemo(() => formatVideoDurationSeconds(selectedSeconds), [selectedSeconds]);

  function updateRange(next: number[]) {
    const start = next[0] ?? 0;
    const end = next[1] ?? start + 1;
    let nextStart = Math.max(0, Math.min(start, Math.max(0, duration - 0.5)));
    let nextEnd = Math.max(nextStart + 0.5, Math.min(end, duration || end));
    if (nextEnd - nextStart > MAX_POST_VIDEO_SECONDS) {
      if (start !== range.startSec) {
        nextStart = Math.max(0, nextEnd - MAX_POST_VIDEO_SECONDS);
      } else {
        nextEnd = nextStart + MAX_POST_VIDEO_SECONDS;
      }
    }
    setRange({ startSec: nextStart, endSec: nextEnd });
    setError(null);
  }

  async function handleConfirm() {
    if (!file || busy || overHardCap) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const prepared = await preparePostVideo(file, range, {
        onProgress: (ratio) => setProgress(ratio),
      });
      onConfirm(prepared);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cut that video.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      title={
        <span className="inline-flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" aria-hidden />
          Cut your clip
        </span>
      }
      description="Drag the handles, then use the cut. Aim for about 60 seconds."
      className="sm:max-w-lg"
      bodyClassName="space-y-4 px-4 pb-5 pt-1"
      handleOnly
    >
      <div className="overflow-hidden rounded-2xl bg-black">
        {objectUrl ? (
          <video
            ref={videoRef}
            src={objectUrl}
            playsInline
            muted
            controls
            className="aspect-[4/5] max-h-[min(52dvh,24rem)] w-full object-contain"
            data-testid="feed-video-trim-preview"
          />
        ) : (
          <div className="flex aspect-[4/5] max-h-[min(52dvh,24rem)] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-hidden />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">{durationLabel} selected</span>
          <span
            className={cn(
              "text-xs",
              overHardCap ? "font-medium text-destructive" : overGuide ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
            )}
          >
            {overHardCap
              ? `Max ${MAX_POST_VIDEO_SECONDS}s`
              : overGuide
                ? `Aim for ~${GUIDED_POST_VIDEO_MAX_SECONDS}s`
                : `Guide ~${GUIDED_POST_VIDEO_MAX_SECONDS}s`}
          </span>
        </div>
        <Slider
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={[range.startSec, range.endSec]}
          onValueChange={updateRange}
          disabled={!duration || busy}
          aria-label="Clip start and end"
          data-testid="feed-video-trim-slider"
        />
        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{formatVideoDurationSeconds(range.startSec)}</span>
          <span>{formatVideoDurationSeconds(duration || range.endSec)}</span>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? (
        <div className="space-y-1.5" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">Cutting clip…</p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 rounded-xl"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 rounded-xl"
          disabled={!file || busy || overHardCap || !duration}
          onClick={() => void handleConfirm()}
          data-testid="button-feed-video-trim-confirm"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Cutting
            </>
          ) : (
            "Use this clip"
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}
