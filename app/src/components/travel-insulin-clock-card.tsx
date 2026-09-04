import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BasalAdjustmentRow } from "@/lib/travel-insulin-clock";

type DoseRow = BasalAdjustmentRow & { doseLabel: string };

type Props = {
  hours: number;
  direction: "east" | "west" | "none";
  isPumpUser: boolean;
  todayEntries: DoseRow[];
  schedules: { doseLabel: string; rows: BasalAdjustmentRow[] }[];
  hasStarted: boolean;
  className?: string;
};

export function TravelInsulinClockCard({
  hours,
  direction,
  isPumpUser,
  todayEntries,
  schedules,
  hasStarted,
  className,
}: Props) {
  const [showAllDays, setShowAllDays] = useState(false);
  const dirLabel = direction === "east" ? "ahead" : direction === "west" ? "behind" : "";
  const heading = hours > 0 ? `${hours}h ${dirLabel}` : "Time zone";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[1.5rem] border border-sky-500/25 bg-gradient-to-b from-sky-500/[0.12] via-card to-card",
        className,
      )}
      data-testid="card-travel-insulin-clock"
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Clock className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700/80 dark:text-sky-300/90">
              Insulin times
            </p>
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">{heading}</p>
          </div>
        </div>

        {isPumpUser ? (
          <div className="rounded-2xl bg-background/70 px-3.5 py-3 ring-1 ring-border/50">
            <p className="text-sm font-semibold text-foreground">Pump clock</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Keep home time on travel day, then switch to local. Confirm basal changes with your team — this app
              doesn&apos;t change pump settings.
            </p>
          </div>
        ) : todayEntries.length > 0 ? (
          todayEntries.map((row, idx) => (
            <div
              key={`${row.doseLabel}-${idx}`}
              className="rounded-2xl bg-background/80 px-4 py-4 text-center ring-1 ring-border/50"
              data-testid={idx === 0 ? "text-today-injection-time" : `text-today-injection-time-${idx + 1}`}
            >
              <p className="text-xs font-medium text-muted-foreground">{row.doseLabel}</p>
              <p className="mt-1.5 font-display text-[3rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
                {row.localTime}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Local · {row.homeTime} home · {row.label}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasStarted
              ? "Add your usual long-acting time in Settings to see today's local clock."
              : "Add your usual long-acting time in Settings — local times appear when Travel is on."}
          </p>
        )}

        {!isPumpUser && schedules.some((s) => s.rows.length > 1) ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full rounded-xl text-sm"
              onClick={() => setShowAllDays((v) => !v)}
              data-testid="button-insulin-clock-all-days"
            >
              {showAllDays ? "Hide day-by-day" : "See every day"}
            </Button>
            {showAllDays
              ? schedules.map((schedule) => (
                  <ol key={schedule.doseLabel} className="mt-1 space-y-1.5">
                    {schedule.rows.map((row) => (
                      <li
                        key={`${schedule.doseLabel}-${row.day}-${row.label}`}
                        className="flex items-baseline justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2.5"
                      >
                        <span className="text-sm font-medium text-foreground">{row.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{row.localTime}</span>
                      </li>
                    ))}
                  </ol>
                ))
              : null}
          </div>
        ) : null}

        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          Not medical advice · confirm with your diabetes team
        </p>
      </div>
    </section>
  );
}
