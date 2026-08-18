import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  ChevronRight,
  Cookie,
  Droplets,
  LineChart,
  Moon,
  Pill,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { EmptyState } from "@/components/empty-state";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAppDate, formatAppTime } from "@/lib/region";
import { storage, type HypoTreatment, type UserProfile } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { useHypoAcknowledgementIndex } from "@/hooks/use-hypo-acknowledgement-index";
import {
  formatHypoAcknowledgementSummary,
  type HypoLogAcknowledgementRow,
} from "@/lib/hypo-log-acknowledgements";
import {
  buildHypoHistoryMonths,
  cgmTrendsDurationMinutes,
  classifyHypoTreatment,
  currentHypoMonthKey,
  groupHypoEntriesByDay,
  previousHypoMonthKey,
  type HypoHistoryMonth,
  type HypoTreatmentTypeId,
} from "@/lib/hypo-treatment-history";

const TYPE_TONE: Record<string, { Icon: LucideIcon; bar: string; chip: string }> = {
  glucose_tablets: {
    Icon: Pill,
    bar: "bg-sky-500",
    chip: "bg-sky-500/12 text-sky-900 dark:text-sky-100",
  },
  juice: {
    Icon: Droplets,
    bar: "bg-amber-500",
    chip: "bg-amber-500/12 text-amber-950 dark:text-amber-100",
  },
  gel: {
    Icon: Cookie,
    bar: "bg-violet-500",
    chip: "bg-violet-500/12 text-violet-900 dark:text-violet-100",
  },
  sugary_drink: {
    Icon: Droplets,
    bar: "bg-orange-500",
    chip: "bg-orange-500/12 text-orange-950 dark:text-orange-100",
  },
  sweets: {
    Icon: Cookie,
    bar: "bg-rose-500",
    chip: "bg-rose-500/12 text-rose-900 dark:text-rose-100",
  },
  from_trends: {
    Icon: LineChart,
    bar: "bg-cyan-500",
    chip: "bg-cyan-500/12 text-cyan-950 dark:text-cyan-100",
  },
  quick_log: {
    Icon: Zap,
    bar: "bg-emerald-500",
    chip: "bg-emerald-500/12 text-emerald-900 dark:text-emerald-100",
  },
};

const FALLBACK_TONE = {
  Icon: Cookie,
  bar: "bg-slate-400",
  chip: "bg-muted text-foreground",
};

function typeTone(id: HypoTreatmentTypeId) {
  return TYPE_TONE[id] ?? FALLBACK_TONE;
}

function monthLabel(month: HypoHistoryMonth, profile: UserProfile | null, short = false): string {
  const date = new Date(month.year, month.monthIndex, 1);
  return formatAppDate(
    date,
    profile,
    short ? { month: "short" } : { month: "long", year: "numeric" },
  );
}

function comparisonCopy(
  selected: HypoHistoryMonth,
  previousCount: number,
  previousLabel: string,
): string | null {
  if (previousCount === 0 && selected.count === 0) return null;
  if (previousCount === 0) return `No logs in ${previousLabel}`;
  const delta = selected.count - previousCount;
  if (delta === 0) return `Same as ${previousLabel}`;
  if (delta < 0) return `${Math.abs(delta)} fewer than ${previousLabel}`;
  return `${delta} more than ${previousLabel}`;
}

export default function HypoHistoryPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(() => storage.getProfile() ?? null);
  const [entries, setEntries] = useState<HypoTreatment[]>(() => storage.getHypoTreatments());
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<HypoTreatmentTypeId | "all">("all");

  const cloudHypoIds = useMemo(
    () =>
      entries
        .map((entry) => entry.supabaseHypoLogId)
        .filter((id): id is string => Boolean(id)),
    [entries],
  );
  const { byHypoId } = useHypoAcknowledgementIndex(cloudHypoIds, user?.id);

  const refresh = useCallback(() => {
    setProfile(storage.getProfile() ?? null);
    setEntries(storage.getHypoTreatments());
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const months = useMemo(() => buildHypoHistoryMonths(entries), [entries]);
  const currentKey = currentHypoMonthKey();

  useEffect(() => {
    if (months.length === 0) {
      setSelectedMonthKey(null);
      return;
    }
    setSelectedMonthKey((prev) => {
      if (prev && months.some((month) => month.key === prev)) return prev;
      const withLogs = months.find((month) => month.count > 0);
      return withLogs?.key ?? months[0]!.key;
    });
  }, [months]);

  const selectedMonth = months.find((month) => month.key === selectedMonthKey) ?? months[0] ?? null;
  const previousKey = selectedMonth ? previousHypoMonthKey(selectedMonth.key) : null;
  const previousMonth = previousKey ? months.find((month) => month.key === previousKey) : undefined;
  const previousCount = previousMonth?.count ?? 0;
  const previousShortLabel = previousKey
    ? formatAppDate(
        new Date(Number(previousKey.slice(0, 4)), Number(previousKey.slice(5, 7)) - 1, 1),
        profile,
        { month: "short" },
      )
    : "";

  const filteredEntries = useMemo(() => {
    if (!selectedMonth) return [];
    if (typeFilter === "all") return selectedMonth.entries;
    return selectedMonth.entries.filter((entry) => classifyHypoTreatment(entry).id === typeFilter);
  }, [selectedMonth, typeFilter]);

  const dayGroups = useMemo(() => groupHypoEntriesByDay(filteredEntries), [filteredEntries]);
  const bgUnitsLabel: "mmol/L" | "mg/dL" = profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const isCurrentMonth = selectedMonth?.key === currentKey;
  const compare = selectedMonth ? comparisonCopy(selectedMonth, previousCount, previousShortLabel) : null;

  useEffect(() => {
    if (!selectedMonth || typeFilter === "all") return;
    if (!selectedMonth.types.some((type) => type.id === typeFilter)) setTypeFilter("all");
  }, [selectedMonth, typeFilter]);

  return (
    <PageShell variant="standard" className="mx-auto max-w-lg space-y-5">
      <PageHeader
        leading={<PageBackButton />}
        title="Hypo history"
        actions={
          <>
            <PageInfoDialog
              compact
              title="Hypo history"
              description="A private log of treatments you record in the app — educational only."
            >
              <InfoSection title="What is saved">
                <p>
                  Treatments you log from Home (including quick “treated a hypo”) stay on this device. When you are
                  signed in with cloud enabled, copies are also saved for linked supporters where sharing allows.
                </p>
              </InfoSection>
              <InfoSection title="From trends">
                <p>Possible lows added from glucose trends are a record only — they do not notify supporters.</p>
              </InfoSection>
              <InfoSection title="Not clinic notes">
                <p>This is not a substitute for downloads or records your diabetes team provides.</p>
              </InfoSection>
            </PageInfoDialog>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href="/tools/hypo-help">Hypo help</Link>
            </Button>
          </>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No hypos logged yet"
          description="When you log a treatment from Home, it will show up here by month and type."
        >
          <Button asChild variant="default" size="sm">
            <Link href="/">Back to home</Link>
          </Button>
        </EmptyState>
      ) : selectedMonth ? (
        <>
          <section
            className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-sky-500/[0.08] via-card to-card p-4 shadow-sm"
            data-testid="hypo-history-month-summary"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isCurrentMonth ? "This month" : monthLabel(selectedMonth, profile)}
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-4xl font-semibold leading-none tracking-tight text-foreground">
                  {selectedMonth.count}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedMonth.count === 1 ? "hypo logged" : "hypos logged"}
                </p>
              </div>
              {selectedMonth.overnightCount > 0 ? (
                <p className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-900 dark:text-violet-100">
                  <Moon className="h-3.5 w-3.5" aria-hidden />
                  {selectedMonth.overnightCount} overnight
                </p>
              ) : null}
            </div>
            {compare ? <p className="mt-3 text-xs leading-snug text-muted-foreground">{compare}</p> : null}
          </section>

          {months.length > 1 ? (
            <div
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Month"
            >
              {months.map((month) => {
                const active = month.key === selectedMonth.key;
                return (
                  <button
                    key={month.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setSelectedMonthKey(month.key);
                      setTypeFilter("all");
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
                      active
                        ? "border-foreground/15 bg-foreground text-background"
                        : "border-border/70 bg-background text-muted-foreground",
                    )}
                    data-testid={`hypo-history-month-${month.key}`}
                  >
                    {monthLabel(month, profile, true)}
                    <span className="ml-1 tabular-nums opacity-80">{month.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedMonth.count > 0 ? (
            <section className="space-y-2.5" data-testid="hypo-history-types">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">By treatment</h2>
                {typeFilter !== "all" ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary"
                    onClick={() => setTypeFilter("all")}
                  >
                    Show all
                  </button>
                ) : null}
              </div>
              {selectedMonth.count > 1 ? (
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {selectedMonth.types.map((type) => (
                    <span
                      key={type.id}
                      className={cn("h-full min-w-[4px]", typeTone(type.id).bar)}
                      style={{ width: `${(type.count / selectedMonth.count) * 100}%` }}
                    />
                  ))}
                </div>
              ) : null}
              <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
                {selectedMonth.types.map((type) => {
                  const { Icon, chip } = typeTone(type.id);
                  const active = typeFilter === type.id;
                  return (
                    <li key={type.id}>
                      <button
                        type="button"
                        onClick={() => setTypeFilter(active ? "all" : type.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full min-h-11 items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                          active ? "bg-muted/60" : "hover:bg-muted/30",
                        )}
                        data-testid={`hypo-history-type-${String(type.id)}`}
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chip)}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{type.label}</span>
                        <span className="tabular-nums text-sm font-semibold text-foreground">{type.count}</span>
                        <ChevronRight
                          className={cn("h-4 w-4 text-muted-foreground transition-transform", active && "rotate-90")}
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No hypos logged {isCurrentMonth ? "this month" : `in ${monthLabel(selectedMonth, profile)}`}.
            </p>
          )}

          {selectedMonth.count > 0 ? (
            <section className="space-y-3" data-testid="list-hypo-history-page">
              <h2 className="text-sm font-semibold text-foreground">
                {typeFilter === "all"
                  ? "Logged this month"
                  : selectedMonth.types.find((type) => type.id === typeFilter)?.label ?? "Logged this month"}
              </h2>
              {dayGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching logs in this month.</p>
              ) : (
                dayGroups.map((group) => {
                  const dayDate = new Date(`${group.dayKey}T12:00:00`);
                  return (
                    <div key={group.dayKey} className="space-y-1.5">
                      <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {formatAppDate(dayDate, profile, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                        {group.entries.map((entry, index) => (
                          <HypoHistoryRow
                            key={entry.id}
                            entry={entry}
                            index={index}
                            profile={profile}
                            bgUnitsLabel={bgUnitsLabel}
                            ackSummary={ackSummaryFor(entry, byHypoId)}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {entries.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/tools/activity" className="font-medium text-primary underline-offset-4 hover:underline">
            Full activity log
          </Link>
        </p>
      ) : null}
    </PageShell>
  );
}

function ackSummaryFor(
  entry: HypoTreatment,
  byHypoId: Map<string, HypoLogAcknowledgementRow[]>,
): string | null {
  const acks = entry.supabaseHypoLogId ? byHypoId.get(entry.supabaseHypoLogId) ?? [] : [];
  const latestAck = acks.length > 0 ? acks[acks.length - 1] : null;
  if (!latestAck) return null;
  return formatHypoAcknowledgementSummary(acks, {
    relativeWhen: formatDistanceToNowStrict(new Date(latestAck.acknowledged_at), {
      addSuffix: true,
    }),
  });
}

function HypoHistoryRow({
  entry,
  index,
  profile,
  bgUnitsLabel,
  ackSummary,
}: {
  entry: HypoTreatment;
  index: number;
  profile: UserProfile | null;
  bgUnitsLabel: "mmol/L" | "mg/dL";
  ackSummary: string | null;
}) {
  const classified = classifyHypoTreatment(entry);
  const date = new Date(entry.timestamp);
  const timeStr = formatAppTime(date, profile, { hour: "2-digit", minute: "2-digit" });
  const durationMin = cgmTrendsDurationMinutes(entry.notes);
  const personalNotes =
    classified.id === "from_trends" || classified.id === "quick_log" ? null : entry.notes?.trim() || null;

  return (
    <li
      className={cn("flex items-start gap-3 px-3.5 py-2.5", index > 0 && "border-t border-border/50")}
      data-testid={`item-hypo-history-${entry.id}`}
    >
      <p className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{timeStr}</p>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{classified.label}</p>
          {entry.glucoseLevel !== undefined ? (
            <p className="shrink-0 text-sm tabular-nums text-foreground">
              {entry.glucoseLevel}
              <span className="ml-0.5 text-xs text-muted-foreground">{bgUnitsLabel}</span>
            </p>
          ) : null}
        </div>
        {durationMin != null ? (
          <p className="text-xs text-muted-foreground">~{durationMin} min below target</p>
        ) : null}
        {personalNotes ? <p className="text-xs leading-snug text-muted-foreground">{personalNotes}</p> : null}
        {entry.followUpGlucose !== undefined && entry.followUpTime ? (
          <p className="text-xs text-muted-foreground">
            Recheck {formatAppTime(entry.followUpTime, profile, { hour: "2-digit", minute: "2-digit" })}:{" "}
            {entry.followUpGlucose} {bgUnitsLabel}
          </p>
        ) : null}
        {ackSummary ? (
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{ackSummary}</p>
        ) : entry.carerNotified ? (
          <p className="text-[11px] text-muted-foreground">Supporters notified</p>
        ) : null}
      </div>
    </li>
  );
}
