import { useState, useEffect, useCallback } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Clock, MapPin } from "lucide-react";
import { Link } from "wouter";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_APPOINTMENTS_CHANGED_EVENT,
  isAppointmentsStorageKey,
  storage,
  Appointment,
} from "@/lib/storage";
import { format } from "date-fns";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { cn } from "@/lib/utils";
import { syncAppointments } from "@/lib/appointments-supabase";
import { useAuth } from "@/lib/auth-context";
import { WidgetHeaderIcon, widgetContentClass, widgetHeaderClass } from "./widget-header";

function parseAppointmentDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusPill(appointment: Appointment) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const appointmentDate = parseAppointmentDate(appointment.date);
  if (!appointmentDate) {
    return (
      <span className="chip chip-muted">
        TBC
      </span>
    );
  }
  const daysUntil = Math.ceil((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 0) {
    return (
      <span className="chip border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
        Today
      </span>
    );
  }
  if (daysUntil <= 7) {
    return (
      <span className="chip border-amber-200/70 bg-amber-50/80 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        This week
      </span>
    );
  }
  return (
    <span className="chip chip-muted">
      {daysUntil}d
    </span>
  );
}

export function AppointmentsWidget(props: DashboardWidgetLayoutProps) {
  const { user } = useAuth();
  const compact = isCompactLayout(props);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUpcoming = useCallback(() => {
    try {
      const uid = user?.id;
      if (!uid) {
        setAppointments([]);
        setError(null);
        return;
      }
      const upcoming = storage.getUpcomingAppointmentsForUser(uid);
      setAppointments(Array.isArray(upcoming) ? upcoming.slice(0, 3) : []);
      setError(null);
    } catch {
      setError("Could not load appointments.");
      setAppointments([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUpcoming();
    void syncAppointments({ throttleMs: 0 }).then(() => loadUpcoming());

    const onFocus = () => {
      void syncAppointments().then(() => loadUpcoming());
    };
    const onStorage = (e: StorageEvent) => {
      if (isAppointmentsStorageKey(e.key)) loadUpcoming();
    };
    const onActiveUser = () => {
      void syncAppointments({ throttleMs: 0 }).then(() => loadUpcoming());
    };
    const onAppointmentsChanged = () => loadUpcoming();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncAppointments().then(() => loadUpcoming());
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, onActiveUser);
    window.addEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppointmentsChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, onActiveUser);
      window.removeEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppointmentsChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadUpcoming]);

  if (error) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-appointments">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Appointments</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-body text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (appointments === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-appointments">
        <CardContent className="p-4 md:p-6">
          <p className="text-body text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const list = compact ? appointments.slice(0, 2) : appointments;

  if (appointments.length === 0) {
    return (
      <WidgetCard accent="tracking" className="overflow-visible" data-testid="widget-appointments">
        <div className="flex items-center gap-2 px-4 py-2.5 md:px-6">
          <WidgetHeaderIcon icon={Calendar} />
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Appointments</span>
            {" · "}
            No upcoming
          </p>
          <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 rounded-full px-3 text-sm font-medium">
            <Link href="/appointments" data-testid="button-add-appointment-widget">
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              Add
            </Link>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard accent="tracking" className="overflow-visible" data-testid="widget-appointments">
      <CardHeader className={widgetHeaderClass}>
        <div>
          <Link href="/appointments">
            <div className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <WidgetHeaderIcon icon={Calendar} />
              <CardTitle className="text-base font-semibold leading-tight text-foreground">
                {compact ? "Appts" : "Appointments"}
              </CardTitle>
            </div>
          </Link>
        </div>
      </CardHeader>
      <CardContent className={cn(widgetContentClass, "flex flex-col gap-2")}>
          <div>
            {list.map((appointment) => {
              const d = parseAppointmentDate(appointment.date);
              return (
                <div
                  key={appointment.id}
                  className="pressable flex gap-3 px-1 py-3 transition-colors hover:bg-muted/40"
                  data-testid={`widget-appointment-${appointment.id}`}
                >
                  <div
                    className={cn(
                      "flex min-w-[3.25rem] flex-col items-center justify-center rounded-xl bg-muted/50 px-2 py-2",
                    )}
                  >
                    {d ? (
                      <>
                        <span className="text-2xl font-semibold tabular-nums text-foreground leading-none">
                          {format(d, "d")}
                        </span>
                        <span className="mt-1 text-[13px] font-medium text-muted-foreground">{format(d, "MMM")}</span>
                      </>
                    ) : (
                      <span className="text-small font-medium text-muted-foreground text-center">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-body text-foreground truncate">{appointment.title || "Appointment"}</span>
                      {statusPill(appointment)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-small text-muted-foreground">
                      {d && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(d, "EEE d MMM")}
                        </span>
                      )}
                      {appointment.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {appointment.time}
                        </span>
                      )}
                      {appointment.location && (
                        <span className="flex items-center gap-1 min-w-0 truncate">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {appointment.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      </CardContent>
    </WidgetCard>
  );
}
