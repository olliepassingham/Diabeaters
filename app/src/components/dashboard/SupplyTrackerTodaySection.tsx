import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ArrowRight,
  Calendar,
  CheckCircle,
  AlertCircle,
  Moon,
} from "lucide-react";
import { Link } from "wouter";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_APPOINTMENTS_CHANGED_EVENT,
  storage,
  type Appointment,
  type HolidayPrep,
  type Supply,
  type ScenarioState,
} from "@/lib/storage";

export function SupplyTrackerTodaySection() {
  const { user } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());
  const [appointmentsTick, setAppointmentsTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onAppt = () => setAppointmentsTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppt);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppt);
    };
  }, [user?.id]);

  const upcomingAppointments: Appointment[] = useMemo(
    () => (user?.id ? storage.getUpcomingAppointmentsForUser(user.id) : []),
    [user?.id, appointmentsTick],
  );

  const criticalSupplies = supplies.filter((s) => storage.getSupplyStatus(s) === "critical");
  const hasActiveScenario = scenarioState.travelModeActive || scenarioState.sickDayActive;
  const hour = new Date().getHours();
  const isEvening = hour >= 19 || hour < 6;

  const parseISODateOnly = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const daysUntil = (dateStr: string | undefined): number | null => {
    const d = parseISODateOnly(dateStr);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusMessage = () => {
    if (criticalSupplies.length > 0) {
      return { type: "warning" as const, message: "Critical supplies need attention" };
    }
    if (scenarioState.sickDayActive) {
      return { type: "info" as const, message: "Sick day mode active" };
    }
    if (scenarioState.travelModeActive) {
      return {
        type: "info" as const,
        message: `Travel mode active${scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ""}`,
      };
    }
    return { type: "ok" as const, message: "All clear for now" };
  };

  const status = getStatusMessage();

  const nextAppointment = upcomingAppointments.find((a) => daysUntil(a.date) !== null) ?? null;
  const nextAppointmentDays = nextAppointment ? daysUntil(nextAppointment.date) : null;
  const showNextAppointment = nextAppointment && nextAppointmentDays !== null && nextAppointmentDays >= 0 && nextAppointmentDays <= 7;

  const holidayPrep: HolidayPrep | null = storage.getHolidayPrep?.() ?? null;
  const departDays = holidayPrep ? daysUntil(holidayPrep.departureDate) : null;
  const showTripCountdown = holidayPrep && departDays !== null && departDays >= 0 && departDays <= 7;
  const travelPlan: unknown = storage.getTravelPlan?.() ?? null;
  const travelType =
    travelPlan &&
    typeof travelPlan === "object" &&
    "travelType" in travelPlan &&
    (travelPlan as { travelType?: unknown }).travelType &&
    (((travelPlan as { travelType?: unknown }).travelType as string) === "domestic" ||
      ((travelPlan as { travelType?: unknown }).travelType as string) === "international")
      ? ((travelPlan as { travelType?: unknown }).travelType as "domestic" | "international")
      : null;

  let worst: "critical" | "low" | "ok" = "ok";
  let minDays: number | null = null;
  if (supplies.length > 0) {
    for (const s of supplies) {
      const d = storage.getDaysRemaining(s);
      if (d >= 999) continue;
      const st = storage.getSupplyStatus(s);
      if (st === "critical") worst = "critical";
      else if (st === "low" && worst === "ok") worst = "low";
      if (minDays === null || d < minDays) minDays = d;
    }
  }

  const supplyBorderTone =
    supplies.length === 0
      ? ""
      : worst === "critical"
        ? "border-red-400/80 bg-red-50/90 dark:bg-red-950/30 dark:border-red-800/60"
        : worst === "low"
          ? "border-amber-400/80 bg-amber-50/80 dark:bg-amber-950/25 dark:border-amber-800/50"
          : "border-border/80 bg-primary-light/40 dark:bg-primary-light/10";

  const supplyTopContent = () => {
    if (supplies.length === 0) {
      return (
        <Link href="/supplies" className="block">
          <CardContent
            className="dashboard-card-hover flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer bg-primary-light/25 dark:bg-primary-light/10 hover:bg-primary-light/35 dark:hover:bg-primary-light/[0.14] transition-colors"
            data-testid="dashboard-supply-tracker-card"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">No supplies yet</p>
                <p className="text-sm text-muted-foreground">Tap to open Supply Tracker and add your stock.</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </CardContent>
        </Link>
      );
    }

    const statusLabel =
      worst === "critical" ? "Low stock — reorder soon" : worst === "low" ? "Some items running low" : "Stock OK";

    const daysLine =
      minDays !== null
        ? `${minDays} day${minDays === 1 ? "" : "s"} until shortest run-out (estimate)`
        : "Open tracker for detailed days remaining";

    return (
      <Link href="/supplies" className="block">
        <CardContent
          className="dashboard-card-hover flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer transition-colors hover:brightness-[0.98] dark:hover:brightness-110"
          data-testid="dashboard-supply-tracker-card"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{statusLabel}</p>
              <p className="text-sm text-muted-foreground">{daysLine}</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Link>
    );
  };

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SupplyTrackerEntryCard />
        <TodayAtAGlanceCard />
      </div>
    </section>
  );
}

export function SupplyTrackerEntryCard() {
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  let worst: "critical" | "low" | "ok" = "ok";
  let minDays: number | null = null;
  if (supplies.length > 0) {
    for (const s of supplies) {
      const d = storage.getDaysRemaining(s);
      if (d >= 999) continue;
      const st = storage.getSupplyStatus(s);
      if (st === "critical") worst = "critical";
      else if (st === "low" && worst === "ok") worst = "low";
      if (minDays === null || d < minDays) minDays = d;
    }
  }

  const supplyBorderTone =
    supplies.length === 0
      ? ""
      : worst === "critical"
        ? "border-red-400/80 bg-red-50/90 dark:bg-red-950/30 dark:border-red-800/60"
        : worst === "low"
          ? "border-amber-400/80 bg-amber-50/80 dark:bg-amber-950/25 dark:border-amber-800/50"
          : "border-border/80 bg-primary-light/40 dark:bg-primary-light/10";

  const statusLabel =
    supplies.length === 0
      ? "No supplies yet"
      : worst === "critical"
        ? "Low stock — reorder soon"
        : worst === "low"
          ? "Some items running low"
          : "Stock OK";

  const daysLine =
    supplies.length === 0
      ? "Tap to open Supply Tracker and add your stock."
      : minDays !== null
        ? `${minDays} day${minDays === 1 ? "" : "s"} until shortest run-out (estimate)`
        : "Open tracker for detailed days remaining";

  const outerCardClass =
    supplies.length === 0
      ? "dashboard-card-hover border-border/70 shadow-sm hover:shadow-md dark:border-border/50 overflow-hidden border-2 border-dashed border-muted-foreground/30 rounded-xl"
      : `dashboard-card-hover border-border/70 shadow-sm hover:shadow-md dark:border-border/50 overflow-hidden rounded-xl border ${supplyBorderTone}`;

  const scenarioLine =
    scenarioState.travelModeActive || scenarioState.sickDayActive
      ? "Scenario active"
      : "No scenarios active";

  return (
    <Card className={outerCardClass} data-testid="dashboard-supply-entry-card">
      <Link href="/supplies" className="block">
        <CardContent className="flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer transition-colors hover:brightness-[0.98] dark:hover:brightness-110">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-foreground">{statusLabel}</p>
              <p className="text-sm text-muted-foreground">{daysLine}</p>
              {supplies.length > 0 ? (
                <p className="text-xs text-muted-foreground">{scenarioLine}</p>
              ) : null}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Link>
    </Card>
  );
}

export function TodayAtAGlanceCard() {
  const { user } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => storage.getScenarioState());
  const [appointmentsTick, setAppointmentsTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onAppt = () => setAppointmentsTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppt);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppt);
    };
  }, [user?.id]);

  const upcomingAppointments: Appointment[] = useMemo(
    () => (user?.id ? storage.getUpcomingAppointmentsForUser(user.id) : []),
    [user?.id, appointmentsTick],
  );

  const criticalSupplies = supplies.filter((s) => storage.getSupplyStatus(s) === "critical");
  const hasActiveScenario = scenarioState.travelModeActive || scenarioState.sickDayActive;
  const hour = new Date().getHours();
  const isEvening = hour >= 19 || hour < 6;

  const parseISODateOnly = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const daysUntil = (dateStr: string | undefined): number | null => {
    const d = parseISODateOnly(dateStr);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusMessage = () => {
    if (criticalSupplies.length > 0) {
      return { type: "warning" as const, message: "Critical supplies need attention" };
    }
    if (scenarioState.sickDayActive) {
      return { type: "info" as const, message: "Sick day mode active" };
    }
    if (scenarioState.travelModeActive) {
      return {
        type: "info" as const,
        message: `Travel mode active${scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ""}`,
      };
    }
    return { type: "ok" as const, message: "All clear for now" };
  };

  const status = getStatusMessage();

  const nextAppointment = upcomingAppointments.find((a) => daysUntil(a.date) !== null) ?? null;
  const nextAppointmentDays = nextAppointment ? daysUntil(nextAppointment.date) : null;
  const showNextAppointment = nextAppointment && nextAppointmentDays !== null && nextAppointmentDays >= 0 && nextAppointmentDays <= 7;

  const holidayPrep: HolidayPrep | null = storage.getHolidayPrep?.() ?? null;
  const departDays = holidayPrep ? daysUntil(holidayPrep.departureDate) : null;
  const showTripCountdown = holidayPrep && departDays !== null && departDays >= 0 && departDays <= 7;
  const travelPlan: unknown = storage.getTravelPlan?.() ?? null;
  const travelType =
    travelPlan &&
    typeof travelPlan === "object" &&
    "travelType" in travelPlan &&
    (travelPlan as { travelType?: unknown }).travelType &&
    (((travelPlan as { travelType?: unknown }).travelType as string) === "domestic" ||
      ((travelPlan as { travelType?: unknown }).travelType as string) === "international")
      ? ((travelPlan as { travelType?: unknown }).travelType as "domestic" | "international")
      : null;

  return (
    <Card
      className="dashboard-card-hover border-border/70 shadow-sm hover:shadow-md dark:border-border/50 rounded-xl overflow-hidden"
      data-testid="dashboard-today-card"
    >
      <CardContent className="px-3 py-3 md:px-4 md:py-4 space-y-3" data-testid="dashboard-today-inline">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Today</span>
          </div>
          <Badge
            variant={status.type === "warning" ? "destructive" : status.type === "info" ? "secondary" : "outline"}
            className="shrink-0 text-xs font-normal"
          >
            {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </Badge>
        </div>

        <div className="flex items-start gap-2">
          {status.type === "warning" ? (
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0 mt-0.5" aria-hidden />
          )}
          <span className="text-sm text-foreground leading-snug" data-testid="text-today-status">
            {status.message}
          </span>
        </div>

        <div className="pl-6 space-y-1" data-testid="dashboard-today-extras">
          {showNextAppointment ? (
            <Link href="/appointments">
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/40 cursor-pointer"
                data-testid="dashboard-today-next-appointment"
              >
                <div className="min-w-0">
                  <span className="text-muted-foreground">Next:</span>{" "}
                  <span className="font-medium text-foreground truncate">
                    {nextAppointment.title || "Appointment"}
                  </span>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {parseISODateOnly(nextAppointment.date)
                    ? `${parseISODateOnly(nextAppointment.date)!.toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}${nextAppointment.time ? ` • ${String(nextAppointment.time)}` : ""}${
                        typeof nextAppointmentDays === "number"
                          ? nextAppointmentDays === 0
                            ? " • today"
                            : nextAppointmentDays === 1
                              ? " • in 1d"
                              : ` • in ${nextAppointmentDays}d`
                          : ""
                      }`
                    : ""}
                </div>
              </div>
            </Link>
          ) : (
            <div className="text-sm text-muted-foreground" data-testid="dashboard-today-no-appointments">
              No appointments this week
            </div>
          )}

          {showTripCountdown ? (
            <Link href="/scenarios/travel">
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/40 cursor-pointer"
                data-testid="dashboard-today-trip-countdown"
              >
                <div className="min-w-0 text-muted-foreground truncate">
                  {holidayPrep?.destination?.trim()
                    ? `Trip: ${holidayPrep.destination.trim()}${travelType ? ` (${travelType})` : ""}`
                    : "Trip"}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {departDays === 0 ? "today" : `in ${departDays}d`}
                </div>
              </div>
            </Link>
          ) : null}
        </div>

        {hasActiveScenario && (
          <div className="space-y-2">
            {scenarioState.travelModeActive && (
              <div className="rounded-lg bg-blue-50/90 p-2.5 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                Travel mode until{" "}
                {scenarioState.travelEndDate ? new Date(scenarioState.travelEndDate).toLocaleDateString("en-GB") : "unspecified"}
              </div>
            )}
            {scenarioState.sickDayActive && (
              <div className="rounded-lg bg-orange-50/90 p-2.5 text-sm text-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
                Sick day — {scenarioState.sickDaySeverity || "moderate"} severity
              </div>
            )}
          </div>
        )}

        {criticalSupplies.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Running low</p>
            {criticalSupplies.slice(0, 3).map((supply) => (
              <div key={supply.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">{supply.name}</span>
                <Badge variant="destructive" className="shrink-0 text-xs">
                  {storage.getDaysRemaining(supply)}d left
                </Badge>
              </div>
            ))}
          </div>
        )}

        {isEvening && (
          <Link href="/scenarios/bedtime" className="block">
            <div
              className="flex items-center gap-2 rounded-lg bg-indigo-50/90 p-2.5 text-sm text-indigo-900 transition-colors hover:bg-indigo-100/90 dark:bg-indigo-950/35 dark:text-indigo-100 dark:hover:bg-indigo-950/50 cursor-pointer"
              data-testid="card-evening-bedtime"
            >
              <Moon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0">Bedtime check</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-70" aria-hidden />
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
