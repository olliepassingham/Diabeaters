type DevNoteProps = {
  note?: string;
  error?: unknown;
};

function formatDevErrorSnippet(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err.length > 200 ? `${err.slice(0, 197)}…` : err;
  if (err instanceof Error) {
    const m = err.message;
    return m.length > 200 ? `${m.slice(0, 197)}…` : m;
  }
  const s = String(err);
  return s.length > 200 ? `${s.slice(0, 197)}…` : s;
}

export function DevNote({ note, error }: DevNoteProps) {
  if (!import.meta.env.DEV) return null;

  const errText = formatDevErrorSnippet(error);
  if (!note && !errText) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] max-w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-amber-600/60 bg-amber-950/95 text-amber-50 p-3 text-[11px] font-mono shadow-lg pointer-events-none"
      data-testid="dev-note"
    >
      {note ? <p className="font-semibold text-amber-200 mb-1">{note}</p> : null}
      {errText ? <p className="break-words opacity-95 leading-snug">{errText}</p> : null}
    </div>
  );
}
