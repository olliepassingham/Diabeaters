import { Badge } from "@/components/ui/badge";
import { isStaging } from "@/lib/flags";

/** Small chip shown in staging to indicate preview features. */
export function StagingChip() {
  if (!isStaging) return null;
  return (
    <Badge
      variant="outline"
      className="text-xs font-normal border-amber-500/60 text-amber-700 dark:text-amber-400"
      data-testid="staging-chip"
    >
      Preview: this feature is in staging
    </Badge>
  );
}
