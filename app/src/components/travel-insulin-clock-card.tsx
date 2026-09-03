import { useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  const heading =
    hours > 0 ? `${hours}h ${dirLabel}` : "Time zone";

  return (
    <Card
      className={cn("overflow-hidden rounded-[1.35rem] border-sky-500/30 shadow-none", className)}
      data-testid="card-travel-insulin-clock"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Insulin times</p>
            <p className="text-base font-semibold leading-snug text-foreground">{heading}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {hasStarted
                ? "Times below are destination local time. Not a dose change — only when the clock says to inject."
                : "Turn Travel on when you leave or board. Then this card shows today's injection time in local time."}
            </p>
          </div>
        </div>

        {isPumpUser ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
            <p className="text-sm font-semibold text-foreground">Pump clock</p>
            <p className="mt-1 text-sm leading-snug text-foreground/85">
              Keep the pump on home time for the travel day, then switch to local time. Check basal rates with your
              team before you go — the app does not change pump settings.
            </p>
          </div>
        ) : todayEntries.length > 0 ? (
          todayEntries.map((row, idx) => (
            <div
              key={`${row.doseLabel}-${idx}`}
              className="rounded-xl border border-border/50 bg-background/80 px-3 py-3"
              data-testid={idx === 0 ? "text-today-injection-time" : `text-today-injection-time-${idx + 1}`}
            >
              <p className="text-xs font-medium text-muted-foreground">{row.doseLabel}</p>
              <p className="mt-1 font-display text-[2.25rem] font-bold leading-none tabular-nums tracking-tight">
                {row.localTime}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Local time · {row.homeTime} at home · {row.label}
              </p>
              <p className="mt-1 text-sm leading-snug text-foreground/85">{row.note}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Set your usual long-acting time in Settings so we can show a day-by-day clock here.
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
                  <ol key={schedule.doseLabel} className="mt-2 space-y-2">
                    {schedule.rows.map((row) => (
                      <li
                        key={`${schedule.doseLabel}-${row.day}-${row.label}`}
                        className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/25 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-foreground">{row.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {row.localTime}
                          <span className="ml-1 font-normal text-muted-foreground">local</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ))
              : null}
          </div>
        ) : null}

        <p className="text-[11px] leading-snug text-muted-foreground">
          Not medical advice. Shift about 1–2 hours per day. Confirm the plan with your diabetes team.
        </p>
      </CardContent>
    </Card>
  );
}
