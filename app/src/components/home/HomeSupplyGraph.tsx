import { useMemo } from "react";
import { ChevronRight, Package } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { storage, type Supply } from "@/lib/storage";
import { cn } from "@/lib/utils";

const CHART_MAX_DAYS = 90;

function toneClasses(status: "critical" | "low" | "ok"): string {
  if (status === "critical") return "bg-red-500 shadow-red-500/25";
  if (status === "low") return "bg-amber-500 shadow-amber-500/25";
  return "bg-emerald-500 shadow-emerald-500/20";
}

export function HomeSupplyGraph({ supplies }: { supplies: Supply[] }) {
  const plotted = useMemo(
    () =>
      supplies
        .map((s) => ({
          supply: s,
          days: storage.getDaysRemaining(s),
          status: storage.getSupplyStatus(s),
        }))
        .filter((entry) => entry.days < 999)
        .sort((a, b) => a.days - b.days)
        .slice(0, 6),
    [supplies],
  );

  const shortest = plotted[0] ?? null;

  return (
    <section
      className="border-b border-border/35 py-5"
      data-testid="home-supply-graph"
      aria-labelledby="home-supply-title"
    >
      <div className="mb-4 flex items-start justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
            <h2
              id="home-supply-title"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Supply runway
            </h2>
          </div>
          {shortest ? (
            <p className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight tabular-nums">
              {shortest.days}
              <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                {shortest.days === 1 ? "day shortest" : "days shortest"}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {supplies.length ? "Add usage details for runway estimates" : "No supplies tracked yet"}
            </p>
          )}
        </div>
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full">
          <Link href="/supplies" aria-label="Open Supply Tracker">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      {plotted.length ? (
        <div className="space-y-3 px-1">
          <div className="ml-[7.75rem] flex justify-between text-[10px] tabular-nums text-muted-foreground/70">
            <span>0</span>
            <span>30d</span>
            <span>60d</span>
            <span>90d+</span>
          </div>
          {plotted.map(({ supply, days, status }) => {
            const left = Math.min(100, Math.max(1.5, (days / CHART_MAX_DAYS) * 100));
            return (
              <Link
                key={supply.id}
                href={`/supplies?supply=${encodeURIComponent(supply.id)}`}
                className="group grid min-h-9 grid-cols-[7rem_1fr] items-center gap-3"
              >
                <span className="truncate text-xs font-medium text-foreground/85">{supply.name}</span>
                <span className="relative h-px bg-border/60">
                  <span
                    className="absolute inset-y-[-4px] w-px bg-border/30"
                    style={{ left: "33.333%" }}
                    aria-hidden
                  />
                  <span
                    className="absolute inset-y-[-4px] w-px bg-border/30"
                    style={{ left: "66.666%" }}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_12px_2px] transition-transform group-hover:scale-125",
                      toneClasses(status),
                    )}
                    style={{ left: `${left}%` }}
                    aria-hidden
                  />
                  <span
                    className="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-foreground"
                    style={{ left: `${left}%` }}
                  >
                    {days > CHART_MAX_DAYS ? "90+" : days}d
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <Link
          href="/supplies"
          className="flex min-h-20 items-center justify-center border-y border-dashed border-border/40 text-sm text-primary"
        >
          Open Supply Tracker
        </Link>
      )}
    </section>
  );
}
