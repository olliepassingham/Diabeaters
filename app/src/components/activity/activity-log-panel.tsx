import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Cloud, History } from "lucide-react";
import { ActivityCalendarDay } from "@/components/activity/activity-calendar-day";
import { ActivityCalendarContext } from "@/components/activity/activity-calendar-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  ACTIVITY_KIND_LABELS,
  filterActivityEvents,
  getActivityDayKeys,
  groupActivityEventsByDay,
  loadStoredActivityFilter,
  saveStoredActivityFilter,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/activity-history";
import {
  computeStreakStats,
  isStreakFilterKind,
  qualifyingDayKeysForKind,
  streakKindLabel,
  type StreakTrackKind,
} from "@/lib/activity-streaks";
import {
  SCENARIO_CALENDAR_STYLES,
  collectScenarioCalendarDays,
  formatScenarioModesLabel,
  scenarioModesInMonth,
  scenarioModesOnDay,
  type ScenarioCalendarDayMap,
  type ScenarioCalendarMode,
} from "@/lib/scenario-calendar";
import { DIABEATER_SCENARIO_STATE_CHANGED_EVENT } from "@/lib/storage";
import { cn } from "@/lib/utils";

type FilterChip = { id: ActivityKind | "all"; label: string };

const PATIENT_FILTER_CHIPS: FilterChip[] = [
  { id: "all", label: "All" },
  { id: "hypo_treated", label: "Hypos" },
  { id: "scenario_started", label: "Scenarios" },
  { id: "bedtime_check", label: "Bedtime" },
  { id: "exercise_session", label: "Exercise" },
  { id: "ratio_snapshot", label: "Ratios" },
  { id: "supply_event", label: "Supplies" },
  { id: "appointment", label: "Clinic" },
  { id: "adviser_session", label: "Meal planner" },
];

const CARER_FILTER_CHIPS: FilterChip[] = [
  { id: "all", label: "All" },
  { id: "hypo_treated", label: "Hypos" },
  { id: "scenario_started", label: "Scenarios" },
  { id: "bedtime_check", label: "Bedtime" },
  { id: "appointment", label: "Clinic" },
];

const ACTIVITY_ROW_ACCENT: Partial<Record<ActivityKind, string>> = {
  hypo_treated: "from-red-500/80 to-red-500/0",
  scenario_started: "from-orange-500/80 to-orange-500/0",
  scenario_ended: "from-orange-400/70 to-orange-400/0",
  bedtime_check: "from-indigo-500/80 to-indigo-500/0",
  exercise_session: "from-emerald-500/80 to-emerald-500/0",
  ratio_snapshot: "from-sky-500/80 to-sky-500/0",
  supply_event: "from-amber-500/80 to-amber-500/0",
  supply_pickup: "from-amber-400/70 to-amber-400/0",
  appointment: "from-violet-500/80 to-violet-500/0",
  adviser_session: "from-rose-500/80 to-rose-500/0",
};

function isFilterActive(kindFilter: ActivityKind | "all", chip: FilterChip): boolean {
  if (kindFilter === chip.id) return true;
  if (chip.id === "scenario_started") {
    return kindFilter === "scenario_started" || kindFilter === "scenario_ended";
  }
  if (chip.id === "supply_event") {
    return kindFilter === "supply_event" || kindFilter === "supply_pickup";
  }
  return false;
}

function StreakSummaryBar({
  kind,
  stats,
}: {
  kind: StreakTrackKind;
  stats: { current: number; best: number };
}) {
  return (
    <div
      className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm"
      data-testid={`activity-streak-summary-${kind}`}
    >
      <p className="font-medium text-foreground">
        {streakKindLabel(kind)} streak
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Current: <span className="tabular-nums font-medium text-foreground">{stats.current}</span> days · Best:{" "}
        <span className="tabular-nums font-medium text-foreground">{stats.best}</span> days
      </p>
    </div>
  );
}

function ActivityFilterBar({
  chips,
  kindFilter,
  onChange,
}: {
  chips: FilterChip[];
  kindFilter: ActivityKind | "all";
  onChange: (id: ActivityKind | "all") => void;
}) {
  return (
    <div
      className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filter activity type"
    >
      {chips.map((chip) => {
        const active = isFilterActive(kindFilter, chip);
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={cn(
              "pressable shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150",
              active
                ? "chip scale-[1.02] shadow-sm ring-1 ring-primary/20"
                : "chip-muted hover:bg-muted/50",
            )}
            aria-pressed={active}
            data-testid={`filter-activity-${chip.label.toLowerCase()}`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function ActivityRow({ entry, linkable }: { entry: ActivityEvent; linkable: boolean }) {
  const timeStr = format(parseISO(entry.at), "HH:mm");
  const accent = ACTIVITY_ROW_ACCENT[entry.kind] ?? "from-primary/50 to-primary/0";

  const content = (
    <div className="relative overflow-hidden rounded-2xl border border-border/45 bg-gradient-to-br from-card/90 via-card/70 to-muted/15 shadow-sm">
      <span
        className={cn("pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b", accent)}
        aria-hidden
      />
      <div className="flex items-start gap-3 p-3 pl-3.5 sm:gap-3.5 sm:p-3.5">
        <div className="w-11 shrink-0 pt-0.5 text-center">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {timeStr}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-snug text-foreground">{entry.title}</span>
            <Badge
              variant="secondary"
              className="rounded-md border-border/40 bg-muted/40 px-1.5 py-0 text-[10px] font-medium"
            >
              {ACTIVITY_KIND_LABELS[entry.kind]}
            </Badge>
            {entry.source === "cloud" ? (
              <Badge
                variant="outline"
                className="gap-0.5 rounded-md border-border/50 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
              >
                <Cloud className="h-2.5 w-2.5" aria-hidden />
                Synced
              </Badge>
            ) : null}
          </div>
          {entry.subtitle ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{entry.subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (linkable && entry.href) {
    return (
      <li data-testid={`item-activity-${entry.id}`}>
        <Link
          href={entry.href}
          className="pressable block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {content}
        </Link>
      </li>
    );
  }

  return <li data-testid={`item-activity-${entry.id}`}>{content}</li>;
}

function ScenarioCalendarLegend({ modes }: { modes: ScenarioCalendarMode[] }) {
  if (modes.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1"
      data-testid="activity-scenario-legend"
      aria-label="Active scenario colours"
    >
      {modes.map((mode) => {
        const style = SCENARIO_CALENDAR_STYLES[mode];
        return (
          <span key={mode} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.legendClass)} aria-hidden />
            {style.label}
          </span>
        );
      })}
    </div>
  );
}

function SelectedDayScenarioStrip({ modes }: { modes: ScenarioCalendarMode[] }) {
  if (modes.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5" data-testid="activity-day-scenario-badges">
      {modes.map((mode) => {
        const style = SCENARIO_CALENDAR_STYLES[mode];
        return (
          <span
            key={mode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border bg-muted/25 px-2 py-1 text-[11px]",
              style.chipClass,
            )}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.legendClass)} aria-hidden />
            <span className="text-foreground/85">{style.label}</span>
            <span className="text-muted-foreground">· active</span>
          </span>
        );
      })}
    </div>
  );
}

export type ActivityLogPanelProps = {
  events: ActivityEvent[];
  variant?: "patient" | "carer";
  /** When false, rows are not links (supporter read-only). */
  linkable?: boolean;
  persistFilter?: boolean;
  emptyHomeHref?: string;
  className?: string;
  /** Supporter view: precomputed scenario ranges from cloud rows. Patient view reads local storage when omitted. */
  scenarioCalendarDays?: ScenarioCalendarDayMap;
};

export function ActivityLogPanel({
  events,
  variant = "patient",
  linkable = true,
  persistFilter = true,
  emptyHomeHref = "/",
  className,
  scenarioCalendarDays: scenarioCalendarDaysProp,
}: ActivityLogPanelProps) {
  const filterChips = variant === "carer" ? CARER_FILTER_CHIPS : PATIENT_FILTER_CHIPS;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | undefined>(() => new Date());
  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">(() =>
    persistFilter ? loadStoredActivityFilter() : "all",
  );
  const [scenarioRevision, setScenarioRevision] = useState(0);

  useEffect(() => {
    if (variant !== "patient" || scenarioCalendarDaysProp) return;
    const bump = () => setScenarioRevision((n) => n + 1);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, bump);
  }, [variant, scenarioCalendarDaysProp]);

  const handleFilterChange = useCallback(
    (id: ActivityKind | "all") => {
      setKindFilter(id);
      if (persistFilter) saveStoredActivityFilter(id);
    },
    [persistFilter],
  );

  const filteredEvents = useMemo(
    () => filterActivityEvents(events, kindFilter),
    [events, kindFilter],
  );

  const byDay = useMemo(() => groupActivityEventsByDay(filteredEvents), [filteredEvents]);
  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [key, list] of byDay) counts.set(key, list.length);
    return counts;
  }, [byDay]);

  const activityDayKeys = useMemo(() => getActivityDayKeys(filteredEvents), [filteredEvents]);
  const activityDayKeySet = useMemo(() => new Set(activityDayKeys), [activityDayKeys]);

  const habitDayKeys = useMemo(
    () => ({
      bedtime_check: qualifyingDayKeysForKind(events, "bedtime_check"),
      exercise_session: qualifyingDayKeysForKind(events, "exercise_session"),
    }),
    [events],
  );

  const streakStats = useMemo(() => {
    if (!isStreakFilterKind(kindFilter)) return null;
    return computeStreakStats(events, kindFilter);
  }, [events, kindFilter]);

  const streakRunDayKeys = useMemo(() => {
    if (!streakStats) return new Set<string>();
    return new Set(streakStats.currentRunDayKeys);
  }, [streakStats]);

  const scenarioCalendarDays = useMemo(() => {
    if (scenarioCalendarDaysProp) return scenarioCalendarDaysProp;
    void scenarioRevision;
    return collectScenarioCalendarDays();
  }, [scenarioCalendarDaysProp, scenarioRevision, events]);

  const scenarioLegendModes = useMemo(
    () => scenarioModesInMonth(scenarioCalendarDays, startOfMonth(month), endOfMonth(month)),
    [scenarioCalendarDays, month],
  );

  const calendarContextValue = useMemo(
    () => ({
      scenarioDays: scenarioCalendarDays,
      activityDayKeys: activityDayKeySet,
      habitDayKeys,
      streakRunDayKeys,
    }),
    [scenarioCalendarDays, activityDayKeySet, habitDayKeys, streakRunDayKeys],
  );

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const selectedScenarioModes = selectedKey ? scenarioModesOnDay(scenarioCalendarDays, selectedKey) : [];
  const selectedDayEvents = selectedKey ? (byDay.get(selectedKey) ?? []) : [];

  const monthRangeEvents = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return filteredEvents.filter((e) => {
      const d = parseISO(e.at);
      return d >= startOfDay(start) && d <= end;
    });
  }, [filteredEvents, month]);

  const activeFilterLabel =
    kindFilter === "all" ? null : (filterChips.find((c) => isFilterActive(kindFilter, c))?.label ?? null);

  const selectedDayLabel = selected ? format(selected, "EEE d MMM yyyy") : "Select a day";

  const calendarLabels = useMemo(
    () => ({
      labelDay: (date: Date) => {
        const key = format(date, "yyyy-MM-dd");
        const count = dayCounts.get(key) ?? 0;
        const scenarios = scenarioModesOnDay(scenarioCalendarDays, key);
        const label = format(date, "d MMMM yyyy");
        const parts: string[] = [label];
        if (scenarios.length > 0) {
          parts.push(`${formatScenarioModesLabel(scenarios)} active`);
        }
        if (count > 0) {
          parts.push(`${count} ${count === 1 ? "activity" : "activities"}`);
        }
        return parts.join(", ");
      },
    }),
    [dayCounts, scenarioCalendarDays],
  );

  return (
    <Card
      className={cn(
        "surface-glass-strong overflow-hidden rounded-2xl border-border/50 shadow-lg",
        className,
      )}
    >
      <CardHeader className="space-y-2 border-b border-border/40 bg-gradient-to-b from-muted/15 to-transparent px-4 pb-3 pt-4 sm:px-5">
        <ActivityFilterBar chips={filterChips} kindFilter={kindFilter} onChange={handleFilterChange} />
      </CardHeader>

      <CardContent className="space-y-4 px-3 pb-4 pt-4 sm:px-4 sm:pb-5">
        {streakStats && isStreakFilterKind(kindFilter) ? (
          <StreakSummaryBar kind={kindFilter} stats={streakStats} />
        ) : null}

        <ActivityCalendarContext.Provider value={calendarContextValue}>
          <div
            className={cn(
              "rounded-2xl border border-border/45 p-2 sm:p-3",
              "bg-gradient-to-b from-muted/25 via-card/40 to-muted/10",
              "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
            )}
          >
            <Calendar
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={setSelected}
              components={{ Day: ActivityCalendarDay }}
              className="w-full max-w-[min(100%,21rem)] p-0.5 sm:p-1"
              classNames={{
                months: "w-full",
                month: "w-full space-y-3",
                caption: "relative mb-1 flex items-center justify-center px-10",
                caption_label: "text-sm font-semibold tracking-tight text-foreground",
                nav_button: cn(
                  "h-8 w-8 rounded-xl border border-border/50 bg-card/60 shadow-sm",
                  "hover:bg-muted/60",
                ),
                table: "w-full border-collapse",
                head_row: "flex w-full justify-between",
                head_cell:
                  "w-11 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground/80 sm:text-[0.7rem]",
                row: "mt-0.5 flex w-full justify-between",
                cell: "relative p-0 text-center",
                day: "h-11 w-11",
                day_selected:
                  "bg-primary/10 font-medium text-primary ring-1 ring-primary/25 hover:bg-primary/15 focus:bg-primary/15",
                day_today: "text-primary",
                day_outside: "text-muted-foreground opacity-50",
              }}
              labels={calendarLabels}
              data-testid="activity-calendar"
            />
          </div>
        </ActivityCalendarContext.Provider>

        <ScenarioCalendarLegend modes={scenarioLegendModes} />

        {monthRangeEvents.length === 0 ? (
          <p className="px-2 text-center text-xs text-muted-foreground" data-testid="text-no-activity-month">
            {activeFilterLabel
              ? `No ${activeFilterLabel.toLowerCase()} activity this month.`
              : "No activity this month."}
          </p>
        ) : null}

        <div
          className={cn(
            "rounded-2xl border border-border/45 bg-gradient-to-b from-muted/12 to-transparent p-3 sm:p-4",
            "shadow-sm",
          )}
        >
          <SelectedDayScenarioStrip modes={selectedScenarioModes} />

          <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-border/35 pb-2.5">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-h3">
              {selectedDayLabel}
            </CardTitle>
            {selected && isSameDay(selected, new Date()) ? (
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                Today
              </span>
            ) : selectedDayEvents.length > 0 ? (
              <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {selectedDayEvents.length} {selectedDayEvents.length === 1 ? "entry" : "entries"}
              </span>
            ) : null}
          </div>

          {selectedDayEvents.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nothing logged this day"
              description={
                kindFilter === "all"
                  ? variant === "carer"
                    ? "Nothing shared for this day yet."
                    : "Try another date, or log from home when something happens."
                  : `No ${activeFilterLabel?.toLowerCase() ?? "matching"} entries — try All or another day.`
              }
            >
              {kindFilter !== "all" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => handleFilterChange("all")}>
                  Show all
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={emptyHomeHref}>Back</Link>
                </Button>
              )}
            </EmptyState>
          ) : (
            <ul className="space-y-2.5" data-testid="list-activity-day">
              {selectedDayEvents.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} linkable={linkable} />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
