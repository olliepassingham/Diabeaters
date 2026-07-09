import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { cn } from "@/lib/utils";

function parseBgField(value: string): number | null {
  const n = parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** True when the typed BG field matches the latest CGM prefill (within unit tolerance). */
export function bgFieldMatchesCgm(bgValue: string, prefill: BgPrefillResult | null | undefined): boolean {
  if (!prefill?.fromCgm) return false;
  const field = parseBgField(bgValue);
  const cgm = prefill.reading?.value ?? parseBgField(prefill.value);
  if (field == null || cgm == null) return false;
  const units = prefill.reading?.units ?? "mmol/L";
  const tolerance = units === "mmol/L" ? 0.08 : 3;
  return Math.abs(field - cgm) <= tolerance;
}

type CgmReadingSourceNoteProps = {
  prefill: BgPrefillResult | null | undefined;
  bgValue: string;
  className?: string;
};

/** Shown when exercise suggestions are driven by a live CGM reading. */
export function CgmReadingSourceNote({ prefill, bgValue, className }: CgmReadingSourceNoteProps) {
  if (!prefill?.fromCgm || !bgFieldMatchesCgm(bgValue, prefill)) return null;

  return (
    <p
      className={cn("text-[11px] leading-snug text-muted-foreground", className)}
      data-testid="cgm-reading-source-note"
    >
      BG from {prefill.source}. Confirm on your CGM or receiver before treating.
    </p>
  );
}
