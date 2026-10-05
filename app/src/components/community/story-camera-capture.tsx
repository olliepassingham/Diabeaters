import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ImagePlus, RefreshCw, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StoryCameraMode = "photo" | "video";

const MAX_RECORD_MS = 15_000;

type Props = {
  active: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onLibrary: (mode: StoryCameraMode) => void;
};

type Facing = "environment" | "user";

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

async function openCamera(facing: Facing, withAudio: boolean): Promise<MediaStream> {
  const video = { facingMode: { ideal: facing } };
  if (!withAudio) {
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch {
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
  }
}

/**
 * Full-screen story camera. Opens on a photo preview; swipe up for video.
 * Library stays available for something already taken.
 */
export function StoryCameraCapture({ active, onClose, onCapture, onLibrary }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const [mode, setMode] = useState<StoryCameraMode>("photo");
  const [facing, setFacing] = useState<Facing>("environment");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(0);
  const mountedRef = useRef(true);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function clearRecordTimer() {
    if (recordTimerRef.current != null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const resume = () => {
      window.setTimeout(() => {
        if (!mountedRef.current || streamRef.current) return;
        setSession((current) => current + 1);
      }, 250);
    };
    window.addEventListener("focus", resume);
    return () => window.removeEventListener("focus", resume);
  }, [active]);

  useEffect(() => {
    if (!active) {
      stopStream();
      setReady(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This phone can't open the camera here. Choose a photo from your library.");
      return;
    }

    let cancelled = false;
    setError(null);
    setReady(false);
    void openCamera(facing, true)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          void el.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Allow camera access, or choose a photo from your library.");
      });

    return () => {
      cancelled = true;
      clearRecordTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopStream();
    };
  }, [active, facing, session]);

  function switchMode(next: StoryCameraMode) {
    if (recording) return;
    setMode(next);
  }

  function onTouchStart(event: TouchEvent) {
    touchY.current = event.changedTouches[0]?.clientY ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchY.current;
    touchY.current = null;
    if (start == null || recording) return;
    const end = event.changedTouches[0]?.clientY;
    if (end == null) return;
    const delta = start - end;
    if (delta > 48) switchMode("video");
    else if (delta < -48) switchMode("photo");
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `story-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  function stopRecording() {
    clearRecordTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("This phone can't record video in the app. Choose one from your library.");
      return;
    }
    const mime = pickRecorderMime();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (!mountedRef.current) return;
      const type = recorder.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size < 1024) return;
      const ext = type.includes("mp4") ? "mp4" : "webm";
      onCapture(new File([blob], `story-${Date.now()}.${ext}`, { type: type.split(";")[0] || type }));
    };
    recorderRef.current = recorder;
    recorder.start(200);
    setRecording(true);
    setRecordMs(0);
    const started = Date.now();
    recordTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setRecordMs(elapsed);
      if (elapsed >= MAX_RECORD_MS) stopRecording();
    }, 100);
  }

  const secondsLeft = Math.max(0, Math.ceil((MAX_RECORD_MS - recordMs) / 1000));

  return (
    <div
      className="fixed inset-0 z-[140] bg-black text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <video
        ref={videoRef}
        className={cn("h-full w-full object-cover", facing === "user" && "-scale-x-100")}
        autoPlay
        muted
        playsInline
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur-md active:scale-95"
          aria-label="Close story camera"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        {recording ? (
          <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-semibold tabular-nums">{secondsLeft}s</span>
        ) : (
          <span className="text-[11px] font-medium tracking-wide text-white/80">Swipe up for video</span>
        )}
        <span className="h-11 w-11" />
      </div>

      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-3">
        {(["photo", "video"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.16em]",
              mode === item ? "text-white" : "text-white/45",
            )}
            aria-pressed={mode === item}
            onClick={() => switchMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {error ? (
        <p className="absolute inset-x-8 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-white/90">{error}</p>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md active:scale-95"
          aria-label={mode === "video" ? "Choose a video from your library" : "Choose a photo from your library"}
          onClick={() => {
            stopStream();
            setReady(false);
            onLibrary(mode);
          }}
        >
          <ImagePlus className="h-5 w-5" />
        </button>

        <button
          type="button"
          disabled={!ready && !recording}
          className={cn(
            "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white active:scale-95 disabled:opacity-40",
            mode === "video" && "border-red-400",
          )}
          aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Record video"}
          onClick={() => {
            if (mode === "photo") capturePhoto();
            else if (recording) stopRecording();
            else startRecording();
          }}
        >
          {mode === "video" && recording ? (
            <Square className="h-6 w-6 fill-red-500 text-red-500" />
          ) : (
            <span className={cn("h-14 w-14 rounded-full", mode === "video" ? "bg-red-500" : "bg-white")} />
          )}
        </button>

        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-md active:scale-95"
          aria-label="Flip camera"
          disabled={recording}
          onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
