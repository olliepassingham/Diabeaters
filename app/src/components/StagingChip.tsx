import { Badge } from "@/components/ui/badge";
import { isStaging } from "@/lib/flags";

/** Small chip shown in staging to indicate preview features. */
export function StagingChip() {
  if (!isStaging) return null;
  return (
    <Badge
      variant="outline"
      className="chip border-amber-500/55 bg-amber-50/70 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/25 dark:text-amber-200"
      data-testid="staging-chip"
    >
      Preview: this feature is in staging
    </Badge>
  );
}
