import { useEffect, useState } from "react";
import { ArrowRight, Plane } from "lucide-react";
import { Link } from "wouter";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SCENARIO_STATE_CHANGED_EVENT,
  storage,
} from "@/lib/storage";
import { tripStyleLabel } from "@/lib/travel-active-guidance";

function daysUntil(date: string | undefined): number | null {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function HomeTravelContext() {
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
  if (!upcoming && !scenario.travelModeActive) return null;

  const destination = holiday?.destination?.trim() || scenario.travelDestination?.trim() || "Your trip";
  const details: string[] = [];
  if (upcoming && departureDays !== null) {
    details.push(departureDays === 0 ? "Departs today" : `Departs in ${departureDays} days`);
  }
  if (scenario.travelModeActive) {
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

  return (
    <section
      className="animate-fade-in-up px-1 py-3"
      data-testid="home-travel-context"
    >
      <Link
        href="/scenarios/travel"
        className="group flex items-center gap-3 rounded-xl px-1 py-1 outline-none ring-offset-background transition-colors hover:bg-sky-500/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
          <Plane className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700/80 dark:text-sky-300/80">
            {scenario.travelModeActive ? "Travel active" : "Coming up"}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{destination}</span>
          <span className="block truncate text-xs text-muted-foreground">{details.join(" · ")}</span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </section>
  );
}
