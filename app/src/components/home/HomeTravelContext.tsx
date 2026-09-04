import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Plane } from "lucide-react";
import { Link } from "wouter";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
} from "@/lib/storage";
import { tripStyleLabel } from "@/lib/travel-active-guidance";
import { cn } from "@/lib/utils";

function daysUntil(date: string | undefined): number | null {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function useHomeTravelPresence(): {
  visible: boolean;
  destination: string;
  eyebrow: string;
  details: string;
  active: boolean;
  departureDays: number | null;
} {
  const [, refresh] = useState(0);

  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    const onVisibility = () => {
      if (document.visibilityState === "visible") update();
    };
    window.addEventListener("focus", update);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, update);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, update);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, update);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const scenario = storage.getScenarioState();
  const holiday = storage.getHolidayPrep?.() ?? null;
  const departureDays = daysUntil(holiday?.departureDate);
  const upcoming = departureDays !== null && departureDays >= 0 && departureDays <= 7;
  const active = Boolean(scenario.travelModeActive);
  const visible = upcoming || active;

  const destination = holiday?.destination?.trim() || scenario.travelDestination?.trim() || "Your trip";
  const details: string[] = [];
  if (upcoming && departureDays !== null) {
    details.push(
      departureDays === 0 ? "Departs today" : departureDays === 1 ? "Departs tomorrow" : `Departs in ${departureDays} days`,
    );
  }
  if (active) {
    details.push(
      scenario.travelEndDate
        ? `Active until ${new Date(scenario.travelEndDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}`
        : "Travel mode active",
    );
  }
  const style = tripStyleLabel(scenario.travelTripStyle);
  if (style) details.push(style);

  return {
    visible,
    destination,
    eyebrow: active ? "Travel active" : "Coming up",
    details: details.join(" · "),
    active,
    departureDays,
  };
}

/** Compact travel tile for the Home Next-up panel. */
export function HomeTravelContext({ embedded = false }: { embedded?: boolean } = {}) {
  const travel = useHomeTravelPresence();
  if (!travel.visible) return null;

  const link = (
    <Link
      href="/scenarios/travel"
      className={cn(
        "group flex items-center gap-3 outline-none ring-offset-background transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        embedded
          ? "rounded-2xl bg-sky-500/[0.07] px-3.5 py-3 ring-1 ring-sky-500/15 hover:bg-sky-500/[0.11]"
          : "rounded-xl px-1 py-1 hover:bg-sky-500/[0.04]",
      )}
      data-testid="home-travel-context"
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center text-sky-600 dark:text-sky-300",
          embedded ? "h-10 w-10 rounded-xl bg-sky-500/15" : "h-10 w-10 rounded-2xl bg-sky-500/10",
        )}
      >
        <Plane className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700/80 dark:text-sky-300/80">
          {travel.eyebrow}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{travel.destination}</span>
        {travel.details ? (
          <span className="block truncate text-xs text-muted-foreground">{travel.details}</span>
        ) : null}
      </span>
      {embedded && travel.departureDays !== null && travel.departureDays >= 0 && !travel.active ? (
        <span className="flex h-11 min-w-[2.75rem] flex-col items-center justify-center rounded-xl bg-background/80 px-2 text-center ring-1 ring-border/40">
          <span className="font-display text-lg font-bold leading-none tabular-nums text-foreground">
            {travel.departureDays}
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {travel.departureDays === 1 ? "day" : "days"}
          </span>
        </span>
      ) : (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
    </Link>
  );

  if (embedded) return link;

  return (
    <section className="animate-fade-in-up px-1 py-3" data-testid="home-travel-context-wrap">
      {link}
    </section>
  );
}

export function HomeNextUpShell({
  children,
  hasContent,
}: {
  children: ReactNode;
  hasContent: boolean;
}) {
  if (!hasContent) return null;
  return (
    <section
      className="animate-fade-in-up space-y-2.5 px-0.5 py-2"
      style={{ animationDelay: "60ms" }}
      data-testid="home-next-up"
    >
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next up</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
