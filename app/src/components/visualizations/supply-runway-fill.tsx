import { cn } from "@/lib/utils";

type SupplyRunwayFillProps = {
  /** Width percentage 0–100 for the “remaining” fill */
  fillPercent: number;
  /** critical | low | ok from storage.getSupplyStatus */
  status: "critical" | "low" | "ok";
  className?: string;
};

const statusFill: Record<SupplyRunwayFillProps["status"], string> = {
  critical: "from-red-600 to-red-500 dark:from-red-500 dark:to-red-400",
  low: "from-amber-600 to-amber-400 dark:from-amber-500 dark:to-amber-300",
  ok: "from-emerald-700 to-emerald-500 dark:from-emerald-600 dark:to-emerald-400",
};

/**
 * Runway strip: muted track + gradient fill — pairs with supplies runway copy.
 */
export function SupplyRunwayFill({ fillPercent, status, className }: SupplyRunwayFillProps) {
  const w = Math.min(100, Math.max(2, fillPercent));
  return (
    <div className={cn("relative h-2.5 overflow-hidden rounded-full bg-muted/80 dark:bg-muted/50", className)}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300 motion-reduce:transition-none", statusFill[status])}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}
