import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bell,
  Calendar,
  Plus,
  Clock,
  MapPin,
  Check,
  Trash2,
  Eye,
  Stethoscope,
  Heart,
  Footprints,
  TestTube,
  Cpu,
  ChevronRight,
} from "lucide-react";
import { storage, Appointment, AppointmentType } from "@/lib/storage";
import { format, isAfter, isBefore, addDays, differenceInCalendarDays } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { syncAppointments } from "@/lib/appointments-supabase";
import { rescheduleAppointmentReminders } from "@/lib/appointment-reminders";
import { cn } from "@/lib/utils";

const APPOINTMENT_TYPES: {
  value: AppointmentType;
  label: string;
  shortLabel: string;
  icon: typeof Calendar;
  accent: string;
}[] = [
  {
    value: "clinic",
    label: "Diabetes clinic",
    shortLabel: "Clinic",
    icon: Stethoscope,
    accent: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    value: "eye_check",
    label: "Eye check",
    shortLabel: "Eyes",
    icon: Eye,
    accent: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    value: "foot_check",
    label: "Foot check",
    shortLabel: "Feet",
    icon: Footprints,
    accent: "bg-amber-500/10 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  },
  {
    value: "blood_test",
    label: "Blood test",
    shortLabel: "Blood",
    icon: TestTube,
    accent: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    value: "pump_review",
    label: "Pump review",
    shortLabel: "Pump",
    icon: Cpu,
    accent: "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    value: "other",
    label: "Other",
    shortLabel: "Other",
    icon: Calendar,
    accent: "bg-muted text-muted-foreground",
  },
];

function getTypeMeta(type: AppointmentType) {
  return APPOINTMENT_TYPES.find((t) => t.value === type) ?? APPOINTMENT_TYPES[APPOINTMENT_TYPES.length - 1];
}

function parseAppointmentDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusPill(appointment: Appointment, today: Date) {
  if (appointment.isCompleted) {
    return (
      <span className="chip border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        Done
      </span>
    );
  }
  const appointmentDate = parseAppointmentDate(appointment.date);
  if (!appointmentDate) {
    return <span className="chip chip-muted">TBC</span>;
  }
  const daysUntil = differenceInCalendarDays(appointmentDate, today);

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
    <span className="chip border-blue-200/70 bg-blue-50/80 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
      {daysUntil}d
    </span>
  );
}

function DateBlock({ dateStr }: { dateStr: string }) {
  const d = parseAppointmentDate(dateStr);
  if (!d) {
    return (
      <div className="flex min-w-[3.5rem] flex-col items-center justify-center rounded-2xl border border-border/70 bg-muted/30 px-2.5 py-2.5">
        <span className="text-sm font-medium text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-[3.5rem] flex-col items-center justify-center rounded-2xl border border-border/70 bg-card px-2.5 py-2.5 shadow-sm">
      <span className="font-display text-2xl font-bold tabular-nums leading-none text-foreground">
        {format(d, "d")}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {format(d, "MMM")}
      </span>
    </div>
  );
}

function UpcomingAppointmentCard({
  appointment,
  today,
  onComplete,
  onDelete,
}: {
  appointment: Appointment;
  today: Date;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = getTypeMeta(appointment.type);
  const Icon = meta.icon;
  const d = parseAppointmentDate(appointment.date);

  return (
    <article
      className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-colors hover:border-blue-500/25"
      data-testid={`appointment-card-${appointment.id}`}
    >
      <div className="flex gap-3 p-4">
        <DateBlock dateStr={appointment.date} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
                {appointment.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    meta.accent,
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" aria-hidden />
                  {meta.shortLabel}
                </span>
                {statusPill(appointment, today)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {d ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {format(d, "EEE d MMM yyyy")}
              </span>
            ) : null}
            {appointment.time ? (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {appointment.time}
              </span>
            ) : null}
            {appointment.location ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{appointment.location}</span>
              </span>
            ) : null}
          </div>

          {appointment.notes ? (
            <p className="rounded-xl border border-border/50 bg-muted/25 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              {appointment.notes}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border/50 bg-muted/15 px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          className="min-h-9 flex-1 rounded-xl"
          onClick={() => onComplete(appointment.id)}
          data-testid={`button-complete-${appointment.id}`}
        >
          <Check className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Mark done
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-9 rounded-xl text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(appointment.id)}
          data-testid={`button-delete-${appointment.id}`}
          aria-label="Delete appointment"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </article>
  );
}

const CHECKUP_TIPS = [
  { icon: Eye, label: "Eye screening", cadence: "Every 1–2 years" },
  { icon: Footprints, label: "Foot check", cadence: "Annually" },
  { icon: TestTube, label: "HbA1c blood test", cadence: "Every 3–6 months" },
  { icon: Heart, label: "BP & cholesterol", cadence: "Annually" },
] as const;

export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AppointmentType>("clinic");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    trackFeatureEngagement("appointments");
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setAppointments([]);
      return;
    }
    const uid = user.id;
    setAppointments(storage.getAppointmentsForUser(uid));
    void syncAppointments({ throttleMs: 0 }).then(() => {
      setAppointments(storage.getAppointmentsForUser(uid));
    });
    void rescheduleAppointmentReminders(storage.getAppointmentsForUser(uid));
  }, [user?.id]);

  const handleAdd = async () => {
    if (!title || !date || !user?.id) return;

    storage.addAppointment({
      title,
      type,
      date,
      time: time || undefined,
      location: location || undefined,
      notes: notes || undefined,
      isCompleted: false,
    });

    setAppointments(storage.getAppointmentsForUser(user.id));
    setIsAddOpen(false);
    resetForm();
    await syncAppointments();
    await rescheduleAppointmentReminders(storage.getAppointmentsForUser(user.id));
  };

  const resetForm = () => {
    setTitle("");
    setType("clinic");
    setDate("");
    setTime("");
    setLocation("");
    setNotes("");
  };

  const handleComplete = async (id: string) => {
    if (!user?.id) return;
    storage.updateAppointment(id, { isCompleted: true });
    setAppointments(storage.getAppointmentsForUser(user.id));
    await syncAppointments();
    await rescheduleAppointmentReminders(storage.getAppointmentsForUser(user.id));
  };

  const requestDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!user?.id || !pendingDeleteId) return;
    setDeleteBusy(true);
    try {
      storage.deleteAppointment(pendingDeleteId);
      setAppointments(storage.getAppointmentsForUser(user.id));
      await syncAppointments();
      await rescheduleAppointmentReminders(storage.getAppointmentsForUser(user.id));
    } finally {
      setDeleteBusy(false);
      setPendingDeleteId(null);
    }
  };

  const pendingDeleteAppointment = pendingDeleteId
    ? appointments.find((a) => a.id === pendingDeleteId) ?? null
    : null;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => !a.isCompleted && isAfter(new Date(a.date), addDays(today, -1)))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [appointments, today],
  );

  const pastAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.isCompleted || isBefore(new Date(a.date), today))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [appointments, today],
  );

  const nextAppointment = upcomingAppointments[0] ?? null;
  const moreUpcoming = upcomingAppointments.slice(1);
  const nextDays = nextAppointment
    ? differenceInCalendarDays(parseAppointmentDate(nextAppointment.date) ?? today, today)
    : null;

  return (
    <PageShell variant="standard" density="compact" className="max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          className="min-w-0 flex-1"
          leading={<PageBackButton />}
          title="Appointments"
          description="Clinic visits, screenings, and check-ups in one place"
          actions={
            <PageInfoDialog title="About Appointments" description="Keep track of your diabetes healthcare visits">
              <InfoSection title="Adding appointments">
                <p>
                  Tap Add to schedule clinic visits, eye checks, foot checks, blood tests, pump reviews, or other
                  appointments.
                </p>
              </InfoSection>
              <InfoSection title="Reminders">
                <p>
                  Turn on appointment reminders in Settings → Notifications. Supporters can also be notified if you
                  allow it.
                </p>
              </InfoSection>
              <InfoSection title="Marking complete">
                <p>After you attend, tap Mark done to move the visit to your history.</p>
              </InfoSection>
            </PageInfoDialog>
          }
        />

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-11 shrink-0 rounded-2xl px-4 shadow-sm" data-testid="button-add-appointment">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add appointment</DialogTitle>
              <DialogDescription>Schedule a diabetes-related visit or check-up</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  className="rounded-xl"
                  placeholder="e.g. Annual diabetes review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-appointment-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {APPOINTMENT_TYPES.map((t) => {
                    const TypeIcon = t.icon;
                    const selected = type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        className={cn(
                          "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-center text-xs font-semibold transition-all",
                          selected
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                            : "border-border/70 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40",
                        )}
                        onClick={() => setType(t.value)}
                        data-testid={t.value === "clinic" ? "select-appointment-type" : undefined}
                      >
                        <TypeIcon className="h-4 w-4 shrink-0" aria-hidden />
                        {t.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    className="rounded-xl"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    data-testid="input-appointment-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    className="rounded-xl"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    data-testid="input-appointment-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  className="rounded-xl"
                  placeholder="e.g. City Hospital"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-appointment-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  className="min-h-[88px] rounded-xl"
                  placeholder="Questions to ask, things to bring…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-appointment-notes"
                />
              </div>

              <Button
                onClick={() => void handleAdd()}
                className="h-12 w-full rounded-2xl"
                disabled={!title || !date}
                data-testid="button-save-appointment"
              >
                Save appointment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Hero / next up */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl px-5 py-5 shadow-sm ring-1",
          nextAppointment
            ? "bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white ring-blue-500/30"
            : "border border-dashed border-border/70 bg-muted/20 text-foreground ring-transparent",
        )}
        data-testid={nextAppointment ? `appointment-card-${nextAppointment.id}` : undefined}
      >
        {nextAppointment ? (
          <>
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl"
              aria-hidden
            />
            <div className="relative space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">Next up</p>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-display text-2xl font-bold leading-tight">{nextAppointment.title}</p>
                  <p className="text-sm text-blue-50">
                    {parseAppointmentDate(nextAppointment.date)
                      ? format(parseAppointmentDate(nextAppointment.date)!, "EEEE d MMMM")
                      : "Date TBC"}
                    {nextAppointment.time ? ` · ${nextAppointment.time}` : ""}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/15 px-3 py-2 text-center ring-1 ring-white/20">
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {nextDays !== null && nextDays <= 0 ? "Today" : nextDays}
                  </p>
                  {nextDays !== null && nextDays > 0 ? (
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-100">
                      {nextDays === 1 ? "day" : "days"}
                    </p>
                  ) : null}
                </div>
              </div>
              {nextAppointment.location ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-blue-50">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {nextAppointment.location}
                </p>
              ) : null}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="min-h-9 flex-1 rounded-xl bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25"
                  onClick={() => void handleComplete(nextAppointment.id)}
                  data-testid={`button-complete-${nextAppointment.id}`}
                >
                  <Check className="mr-1.5 h-4 w-4" aria-hidden />
                  Mark done
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-9 rounded-xl text-blue-50 hover:bg-white/10 hover:text-white"
                  onClick={() => requestDelete(nextAppointment.id)}
                  data-testid={`button-delete-${nextAppointment.id}`}
                  aria-label="Delete appointment"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center sm:flex-row sm:text-left">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-display text-lg font-semibold">No upcoming visits</p>
              <p className="text-sm text-muted-foreground">
                Add your clinic, eye, and foot appointments so reminders and supporters stay in sync.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 rounded-2xl"
              onClick={() => setIsAddOpen(true)}
              data-testid="button-add-first-appointment"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Add appointment
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bell className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>Evening-before and 2-hour reminders</span>
        </div>
        <Button variant="link" className="h-auto shrink-0 px-0 text-foreground" asChild>
          <Link href="/settings/notifications">
            Settings
            <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      {upcomingAppointments.length === 0 && pastAppointments.length === 0 ? null : (
        <>
          {moreUpcoming.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 px-0.5">
                <h2 className="font-display text-lg font-semibold text-foreground">Also coming up</h2>
                <p className="text-sm text-muted-foreground">{moreUpcoming.length} more</p>
              </div>
              <div className="space-y-3">
                {moreUpcoming.map((appointment) => (
                  <UpcomingAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    today={today}
                    onComplete={handleComplete}
                    onDelete={requestDelete}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {pastAppointments.length > 0 ? (
            <section className="space-y-3">
              <h2 className="px-0.5 font-display text-lg font-semibold text-muted-foreground">History</h2>
              <Card className="rounded-3xl border-border/60 shadow-sm">
                <CardContent className="divide-y divide-border/50 p-0">
                  {pastAppointments.slice(0, 8).map((appointment) => {
                    const meta = getTypeMeta(appointment.type);
                    const Icon = meta.icon;
                    const d = parseAppointmentDate(appointment.date);
                    return (
                      <div
                        key={appointment.id}
                        className="flex items-center gap-3 px-4 py-3"
                        data-testid={`appointment-past-${appointment.id}`}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            meta.accent,
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{appointment.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {d ? format(d, "d MMM yyyy") : "Date unknown"}
                            {appointment.isCompleted ? " · Completed" : ""}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 text-muted-foreground"
                          onClick={() => requestDelete(appointment.id)}
                          data-testid={`button-delete-past-${appointment.id}`}
                          aria-label="Delete appointment"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          ) : null}
        </>
      )}

      <Card className="rounded-3xl border-border/60 bg-muted/10 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">Recommended check-ups</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Typical Type 1 diabetes screening intervals in the UK</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CHECKUP_TIPS.map((tip) => {
              const TipIcon = tip.icon;
              return (
                <div
                  key={tip.label}
                  className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/80 px-3 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <TipIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{tip.label}</p>
                    <p className="text-xs text-muted-foreground">{tip.cadence}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => {
          if (!o && !deleteBusy) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-delete-appointment-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAppointment
                ? `This will remove "${pendingDeleteAppointment.title}" from your appointments. This cannot be undone.`
                : "This will remove the appointment. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy} data-testid="button-delete-appointment-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
              data-testid="button-delete-appointment-confirm"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
