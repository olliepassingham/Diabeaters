import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  emptyPharmacyHours,
  PHARMACY_DAY_KEYS,
  storage,
  type Pharmacy,
  type PharmacyDayKey,
  type PharmacyHoursDay,
} from "@/lib/storage";
import { pharmacyDayLabel } from "@/lib/pharmacy";
import { syncPharmacyToCloud } from "@/lib/clinical-prefs-cloud-sync";
import { useAuth } from "@/lib/auth-context";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink } from "./shared";
import { Save, Building2, Trash2, Pencil, Copy } from "lucide-react";

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "17:30";

type DayState = {
  closed: boolean;
  open: string;
  close: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
};

type FormState = {
  name: string;
  phone: string;
  addressLine: string;
  notes: string;
  days: Record<PharmacyDayKey, DayState>;
};

type PageMode = "view" | "edit";

function blankDayState(): DayState {
  return {
    closed: false,
    open: DEFAULT_OPEN,
    close: DEFAULT_CLOSE,
    breakEnabled: false,
    breakStart: "13:00",
    breakEnd: "14:00",
  };
}

function dayStateFromHours(day: PharmacyHoursDay | undefined): DayState {
  if (!day) return { ...blankDayState(), closed: true };
  if (day.closed) return { ...blankDayState(), closed: true };
  return {
    closed: false,
    open: day.open ?? DEFAULT_OPEN,
    close: day.close ?? DEFAULT_CLOSE,
    breakEnabled: !!(day.break?.start && day.break?.end),
    breakStart: day.break?.start ?? "13:00",
    breakEnd: day.break?.end ?? "14:00",
  };
}

function formStateFromPharmacy(p: Pharmacy | null): FormState {
  const days = {} as Record<PharmacyDayKey, DayState>;
  for (const key of PHARMACY_DAY_KEYS) {
    days[key] = dayStateFromHours(p?.hours[key]);
  }
  if (!p) {
    days.sat = { ...blankDayState(), closed: true };
    days.sun = { ...blankDayState(), closed: true };
  }
  return {
    name: p?.name ?? "",
    phone: p?.phone ?? "",
    addressLine: p?.addressLine ?? "",
    notes: p?.notes ?? "",
    days,
  };
}

function dayStateToHours(state: DayState): PharmacyHoursDay {
  if (state.closed) return { closed: true };
  const out: PharmacyHoursDay = { open: state.open, close: state.close };
  if (state.breakEnabled && state.breakStart && state.breakEnd) {
    out.break = { start: state.breakStart, end: state.breakEnd };
  }
  return out;
}

function formatDaySummary(state: DayState): string {
  if (state.closed) return "Closed";
  if (state.breakEnabled) return `${state.open}–${state.breakStart}, ${state.breakEnd}–${state.close}`;
  return `${state.open}–${state.close}`;
}

export default function SettingsPharmacyPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: supporterSession, loading: supporterLoading } = useLinkedPatient();

  const [form, setForm] = useState<FormState>(() => formStateFromPharmacy(null));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hadExisting, setHadExisting] = useState(false);
  const [mode, setMode] = useState<PageMode>("edit");

  useEffect(() => {
    const existing = storage.getPharmacy();
    setForm(formStateFromPharmacy(existing));
    setHadExisting(!!existing);
    setMode(existing ? "view" : "edit");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (supporterLoading) return;
    if (supporterSession) setLocation("/settings", { replace: true });
  }, [supporterLoading, supporterSession, setLocation]);

  const updateDay = (key: PharmacyDayKey, patch: Partial<DayState>) => {
    setForm((prev) => ({
      ...prev,
      days: { ...prev.days, [key]: { ...prev.days[key], ...patch } },
    }));
  };

  const copyFromPrevDay = (key: PharmacyDayKey) => {
    const idx = PHARMACY_DAY_KEYS.indexOf(key);
    if (idx <= 0) return;
    const prevKey = PHARMACY_DAY_KEYS[idx - 1]!;
    setForm((prev) => ({
      ...prev,
      days: { ...prev.days, [key]: { ...prev.days[prevKey] } },
    }));
    toast({
      title: "Copied hours",
      description: `Copied ${pharmacyDayLabel(prevKey, "short")} to ${pharmacyDayLabel(key, "short")}.`,
    });
  };

  const handleClear = () => {
    storage.savePharmacy(null);
    if (user?.id) void syncPharmacyToCloud(user.id);
    setForm(formStateFromPharmacy(null));
    setHadExisting(false);
    setMode("edit");
    toast({ title: "Pharmacy cleared", description: "Your saved pharmacy details were removed from this device." });
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({
        title: "Pharmacy name required",
        description: "Add at least a name so we can show it on Supplies.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const hours = emptyPharmacyHours();
    for (const key of PHARMACY_DAY_KEYS) {
      hours[key] = dayStateToHours(form.days[key]);
    }
    const next: Pharmacy = {
      name: trimmedName,
      phone: form.phone.trim() || undefined,
      addressLine: form.addressLine.trim() || undefined,
      notes: form.notes.trim() || undefined,
      hours,
      updatedAt: new Date().toISOString(),
    };
    storage.savePharmacy(next);
    setHadExisting(true);
    let cloudErr: Error | null = null;
    if (user?.id) {
      const r = await syncPharmacyToCloud(user.id);
      cloudErr = r.error;
    }
    setSaving(false);
    if (cloudErr) {
      toast({
        title: "Saved on this device",
        description: `Could not sync to your account: ${cloudErr.message}`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Pharmacy saved",
      description: "Opening hours will be used on Supplies and Travel.",
    });
    setMode("view");
  };

  const showSupporterRedirecting = supporterLoading || supporterSession;

  const dayRows = useMemo(
    () =>
      PHARMACY_DAY_KEYS.map((key) => ({
        key,
        label: pharmacyDayLabel(key),
        state: form.days[key],
      })),
    [form.days],
  );

  const savedCard = (
    <div className="space-y-4" data-testid="pharmacy-saved-summary">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{form.name.trim() || "Your pharmacy"}</p>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {form.phone.trim() ? <p>{form.phone.trim()}</p> : null}
            {form.addressLine.trim() ? <p>{form.addressLine.trim()}</p> : null}
            {form.notes.trim() ? <p className="italic">{form.notes.trim()}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setMode("edit")}
            data-testid="button-pharmacy-edit"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {hadExisting ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground hover:text-destructive"
              data-testid="button-pharmacy-clear"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opening hours</p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {dayRows.map(({ key, label, state }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 px-3 py-2">
              <span className="text-xs font-medium text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDaySummary(state)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        title="Your pharmacy"
        description="Save your usual pharmacy and weekly opening hours so the app can suggest realistic collect-by dates."
      />

      {showSupporterRedirecting ? (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="space-y-6 p-6 pb-32 md:pb-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="text-base font-semibold tracking-tight">Pharmacy details</h2>
            </div>

            {mode === "view" && hadExisting ? (
              savedCard
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-name">Name</Label>
                    <Input
                      id="pharmacy-name"
                      placeholder="e.g. Boots, High Street"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      data-testid="input-pharmacy-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-phone">Phone (optional)</Label>
                    <Input
                      id="pharmacy-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="e.g. 0161 123 4567"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      data-testid="input-pharmacy-phone"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="pharmacy-address">Address line (optional)</Label>
                    <Input
                      id="pharmacy-address"
                      placeholder="e.g. 123 High Street, Manchester"
                      value={form.addressLine}
                      onChange={(e) => setForm((p) => ({ ...p, addressLine: e.target.value }))}
                      data-testid="input-pharmacy-address"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="pharmacy-notes">Notes (optional)</Label>
                    <Textarea
                      id="pharmacy-notes"
                      rows={2}
                      placeholder="Anything to remember — e.g. 'closed bank holidays'"
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      data-testid="input-pharmacy-notes"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-border/50 pt-5">
                  <div>
                    <p className="text-sm font-semibold">Opening hours</p>
                    <p className="text-xs text-muted-foreground">
                      Times use 24-hour clock in your local time. Bank holidays aren't tracked yet — adjust manually if needed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {dayRows.map(({ key, label, state }) => {
                      const idx = PHARMACY_DAY_KEYS.indexOf(key);
                      const prevKey = idx > 0 ? PHARMACY_DAY_KEYS[idx - 1] : null;
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-border/60 bg-background/50 p-3"
                          data-testid={`pharmacy-day-${key}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium leading-tight">{label}</p>
                                {prevKey ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => copyFromPrevDay(key)}
                                    data-testid={`pharmacy-day-${key}-copy-prev`}
                                  >
                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                    Copy {pharmacyDayLabel(prevKey, "short")}
                                  </Button>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatDaySummary(state)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{state.closed ? "Closed" : "Open"}</span>
                              <Switch
                                checked={!state.closed}
                                onCheckedChange={(v) => updateDay(key, { closed: !v })}
                                aria-label={`${label} open`}
                                data-testid={`pharmacy-day-${key}-toggle`}
                              />
                            </div>
                          </div>

                          {!state.closed ? (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor={`open-${key}`} className="text-xs text-muted-foreground">
                                  Opens
                                </Label>
                                <Input
                                  id={`open-${key}`}
                                  type="time"
                                  value={state.open}
                                  onChange={(e) => updateDay(key, { open: e.target.value })}
                                  data-testid={`pharmacy-day-${key}-open`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`close-${key}`} className="text-xs text-muted-foreground">
                                  Closes
                                </Label>
                                <Input
                                  id={`close-${key}`}
                                  type="time"
                                  value={state.close}
                                  onChange={(e) => updateDay(key, { close: e.target.value })}
                                  data-testid={`pharmacy-day-${key}-close`}
                                />
                              </div>

                              <div className="col-span-2 flex items-center gap-2 pt-1">
                                <Switch
                                  checked={state.breakEnabled}
                                  onCheckedChange={(v) => updateDay(key, { breakEnabled: v })}
                                  aria-label={`${label} lunch break`}
                                  data-testid={`pharmacy-day-${key}-break-toggle`}
                                />
                                <Label className="text-xs text-muted-foreground">Lunch break</Label>
                              </div>
                              {state.breakEnabled ? (
                                <>
                                  <div className="space-y-1">
                                    <Label htmlFor={`break-start-${key}`} className="text-xs text-muted-foreground">
                                      Break starts
                                    </Label>
                                    <Input
                                      id={`break-start-${key}`}
                                      type="time"
                                      value={state.breakStart}
                                      onChange={(e) => updateDay(key, { breakStart: e.target.value })}
                                      data-testid={`pharmacy-day-${key}-break-start`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`break-end-${key}`} className="text-xs text-muted-foreground">
                                      Break ends
                                    </Label>
                                    <Input
                                      id={`break-end-${key}`}
                                      type="time"
                                      value={state.breakEnd}
                                      onChange={(e) => updateDay(key, { breakEnd: e.target.value })}
                                      data-testid={`pharmacy-day-${key}-break-end`}
                                    />
                                  </div>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-5">
                  {hadExisting ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClear}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid="button-pharmacy-clear"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear pharmacy
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!loaded || saving}
                    data-testid="button-pharmacy-save"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save pharmacy
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
