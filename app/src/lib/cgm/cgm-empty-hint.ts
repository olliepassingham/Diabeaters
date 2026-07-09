import { CGM_PREFILL_STALE_AGE_MINUTES } from "@/lib/cgm/v1-scope";

/** Hint when a CGM source is enabled but no recent reading is available for prefill. */
export function getCgmEmptyHint(): string {
  const hours = CGM_PREFILL_STALE_AGE_MINUTES / 60;
  return `No recent blood glucose (last ${hours} hours). Check Settings → CGM, or enter manually.`;
}
