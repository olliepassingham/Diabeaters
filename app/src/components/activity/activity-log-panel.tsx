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
  { id: "appointment_past", label: "Clinic" },
];

const CARER_FILTER_CHIPS: FilterChip[] = [
  { id: "all", label: "All" },
  { id: "hypo_treated", label: "Hypos" },
  { id: "scenario_started", label: "Scenarios" },
  { id: "bedtime_check", label: "Bedtime" },
  { id: "appointment_past", label: "Clinic" },
];

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
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              "pressable shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              active ? "chip" : "chip-muted",
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
  const content = (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/20 p-2.5 sm:gap-3 sm:p-3">
      <div className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{timeStr}</div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{entry.title}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
            {ACTIVITY_KIND_LABELS[entry.kind]}
          </Badge>
          {entry.source === "cloud" ? (
            <Badge variant="outline" className="gap-0.5 px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
              <Cloud className="h-2.5 w-2.5" aria-hidden />
              Synced
            </Badge>
          ) : null}
        </div>
        {entry.subtitle ? (
          <p className="text-xs leading-snug text-muted-foreground">{entry.subtitle}</p>
        ) : null}
      </div>
    </div>
  );

  if (linkable && entry.href) {
    return (
      <li data-testid={`item-activity-${entry.id}`}>
        <Link
          href={entry.href}
          className="pressable block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </Link>
      </li>
    );
  }

  return <li data-testid={`item-activity-${entry.id}`}>{content}</li>;
}

export type ActivityLogPanelProps = {
  events: ActivityEvent[];
  variant?: "patient" | "carer";
  /** When false, rows are not links (supporter read-only). */
  linkable?: boolean;
  persistFilter?: boolean;
  emptyHomeHref?: string;
  className?: string;
};

export function ActivityLogPanel({
  events,
  variant = "patient",
  linkable = true,
  persistFilter = true,
  emptyHomeHref = "/",
  className,
}: ActivityLogPanelProps) {
  const filterChips = variant === "carer" ? CARER_FILTER_CHIPS : PATIENT_FILTER_CHIPS;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | undefined>(() => new Date());
  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">(() =>
    persistFilter ? loadStoredActivityFilter() : "all",
  );

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

  const daysWithActivity = useMemo(() => {
    return [...activityDayKeys].map((key) => parseISO(`${key}T12:00:00`));
  }, [activityDayKeys]);

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
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
        const label = format(date, "d MMMM yyyy");
        if (count <= 0) return label;
        return `${label}, ${count} ${count === 1 ? "activity" : "activities"}`;
      },
    }),
    [dayCounts],
  );

  return (
    <Card className={cn("surface-card overflow-hidden border-border/70 shadow-sm", className)}>
      <CardHeader className="space-y-3 px-4 pb-2 pt-4 sm:px-6">
        <ActivityFilterBar chips={filterChips} kindFilter={kindFilter} onChange={handleFilterChange} />
      </CardHeader>

      <CardContent className="space-y-4 px-2 pb-4 pt-0 sm:px-4 sm:pb-5">
        <div className="flex justify-center rounded-xl bg-muted/10 px-0.5 py-1 sm:px-1">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={setSelected}
            modifiers={{ hasActivity: daysWithActivity }}
            modifiersClassNames={{
              hasActivity:
                "relative font-semibold after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-600 dark:after:bg-emerald-500",
            }}
            className="w-full max-w-[min(100%,20rem)] p-1 sm:p-2"
            classNames={{
              months: "w-full",
              month: "w-full space-y-2",
              caption: "relative flex items-center justify-center px-8",
              caption_label: "text-sm font-semibold",
              nav_button: "h-8 w-8",
              table: "w-full",
              head_row: "flex w-full justify-between",
              head_cell: "w-9 text-[0.7rem] font-normal text-muted-foreground sm:text-[0.8rem]",
              row: "mt-1 flex w-full justify-between",
              cell: "relative p-0 text-center",
              day: "h-9 w-9 p-0 text-sm sm:h-10 sm:w-10",
            }}
            labels={calendarLabels}
            data-testid="activity-calendar"
          />
        </div>

        {monthRangeEvents.length === 0 ? (
          <p className="px-2 text-center text-xs text-muted-foreground" data-testid="text-no-activity-month">
            {activeFilterLabel
              ? `No ${activeFilterLabel.toLowerCase()} activity this month.`
              : "No activity this month."}
          </p>
        ) : null}

        <div className="border-t border-border/50 px-2 pt-3 sm:px-1">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <CardTitle className="text-base font-semibold text-foreground sm:text-h3">
              {selectedDayLabel}
            </CardTitle>
            {selected && isSameDay(selected, new Date()) ? (
              <span className="shrink-0 text-xs text-muted-foreground">Today</span>
            ) : selectedDayEvents.length > 0 ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {selectedDayEvents.length}
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
            <ul className="space-y-2" data-testid="list-activity-day">
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
