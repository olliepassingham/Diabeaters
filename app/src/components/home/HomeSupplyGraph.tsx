import { useMemo } from "react";
import { ChevronRight, Package } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SupplyRunwayFill } from "@/components/visualizations/supply-runway-fill";
import { storage, type Supply } from "@/lib/storage";
import { cn } from "@/lib/utils";

const CHART_MAX_DAYS = 90;

function daysLabel(days: number): string {
  if (days > CHART_MAX_DAYS) return "90+d";
  return `${days}d`;
}

export function HomeSupplyGraph({
  supplies,
  embedded = false,
}: {
  supplies: Supply[];
  /** Inside a home widget section, which already spans the phone width. */
  embedded?: boolean;
}) {
  const plotted = useMemo(
    () =>
      supplies
        .map((s) => ({
          supply: s,
          days: storage.getDaysRemaining(s),
          status: storage.getSupplyStatus(s) as "critical" | "low" | "ok",
        }))
        .filter((entry) => entry.days < 999)
        .sort((a, b) => a.days - b.days)
        .slice(0, 6),
    [supplies],
  );

  const shortest = plotted[0] ?? null;
  const tone =
    shortest?.status === "critical"
      ? "critical"
      : shortest?.status === "low"
        ? "low"
        : "ok";

  return (
    <section
      className={cn(
        "animate-fade-in-up py-1",
        // Break out of main px-4 / md:px-6 so the runway spans the phone width.
        // Skipped when a home widget section already provides that span.
        !embedded && "-mx-4 w-[calc(100%+2rem)] md:-mx-6 md:w-[calc(100%+3rem)]",
      )}
      data-testid="home-supply-graph"
      aria-labelledby="home-supply-title"
    >
      <div
        className={cn(
          "border-y border-border/40 px-4 py-2.5 md:px-6",
          embedded ? "bg-transparent" : "bg-muted/20 dark:bg-muted/10",
          tone === "critical" && "border-red-500/25 bg-red-500/[0.05] dark:bg-red-950/20",
          tone === "low" && "border-amber-500/25 bg-amber-500/[0.05] dark:bg-amber-950/15",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h2
                id="home-supply-title"
                className="font-sans text-[15px] font-semibold leading-tight tracking-normal text-foreground"
              >
                Supply runway
              </h2>
            </div>
            {shortest ? (
              <p className="mt-0.5 truncate text-[13px] leading-snug text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">
                  {shortest.days > CHART_MAX_DAYS ? "90+" : shortest.days}{" "}
                  {shortest.days === 1 ? "day" : "days"}
                </span>
                {" · "}
                {shortest.supply.name}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {supplies.length ? "Add usage details for runway estimates" : "No supplies tracked yet"}
              </p>
            )}
          </div>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
            <Link href="/supplies" aria-label="Open Supply Tracker">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>

        {plotted.length ? (
          <ul className="mt-2 space-y-2">
            {plotted.map(({ supply, days, status }) => {
              const fillPercent =
                days > CHART_MAX_DAYS ? 100 : Math.min(100, Math.max(2, (days / CHART_MAX_DAYS) * 100));
              return (
                <li key={supply.id}>
                  <Link
                    href={`/supplies?supply=${encodeURIComponent(supply.id)}`}
                    className="block rounded-lg py-0.5 transition-colors hover:bg-background/35"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {supply.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[13px] font-medium tabular-nums",
                          status === "critical" && "text-red-600 dark:text-red-400",
                          status === "low" && "text-amber-700 dark:text-amber-400",
                          status === "ok" && "text-muted-foreground",
                        )}
                      >
                        {daysLabel(days)}
                      </span>
                    </div>
                    <SupplyRunwayFill fillPercent={fillPercent} status={status} className="mt-1 h-1.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Link
            href="/supplies"
            className="mt-2 flex min-h-10 items-center justify-center rounded-xl border border-dashed border-border/50 text-sm font-medium text-primary"
          >
            Open Supply Tracker
          </Link>
        )}
      </div>
    </section>
  );
}
