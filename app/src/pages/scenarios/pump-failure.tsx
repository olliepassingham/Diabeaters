import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Syringe, AlertTriangle, Phone, Package, ChevronDown, Clock, Power } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Disclaimer } from "@/components/disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { storage, type PumpFailureSession } from "@/lib/storage";
import { schedulePumpFailureReminders, cancelPumpFailureReminders } from "@/lib/pump-failure-reminders";

const STEPS = [
  {
    title: "Stay calm and check ketones",
    body: "If you have blood or urine ketone strips, check now. Rising ketones with high glucose need urgent medical advice.",
  },
  {
    title: "Switch to injected insulin",
    body: "Use your backup rapid-acting pen for meals and corrections, and your long-acting pen for basal — use doses your care team gave you for pump failure. If you don’t have a written plan, contact your team or urgent care.",
  },
  {
    title: "Hydrate and monitor often",
    body: "Check glucose every 1–2 hours until stable. Drink water unless you’ve been told to restrict fluids.",
  },
  {
    title: "Replace or fix the pump",
    body: "Call your pump company’s helpline. Keep pens and needles with you until the pump is working again.",
  },
];

function minutesUntil(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Math.ceil((t - Date.now()) / 60000);
  return diff;
}

export default function PumpFailurePage() {
  const [sc, setSc] = useState(() => storage.getScenarioState());
  const [session, setSession] = useState<PumpFailureSession | null>(() => storage.getPumpFailureSession());

  const [bgInput, setBgInput] = useState("");
  const [bgUnits, setBgUnits] = useState<"mmol/L" | "mg/dL">("mmol/L");
  const [ketones, setKetones] = useState<PumpFailureSession["ketonesLevel"]>("unknown");
  const [checklist, setChecklist] = useState({
    checkedKetones: false,
    usedBackupInsulin: false,
    changedSetOrSite: false,
    contactedSupport: false,
  });

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSc(storage.getScenarioState());
      setSession(storage.getPumpFailureSession());
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  const upcoming = useMemo(() => {
    if (!session) return [];
    const now = Date.now();
    return session.reminders
      .map((r) => ({ ...r, ms: new Date(r.atIso).getTime() }))
      .filter((r) => Number.isFinite(r.ms) && r.ms > now)
      .sort((a, b) => a.ms - b.ms);
  }, [session]);

  const startActive = async () => {
    const bg = (() => {
      const t = bgInput.trim().replace(",", ".");
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();

    const created = storage.activatePumpFailureMode({
      bgValue: bg,
      bgUnits,
      ketonesLevel: ketones,
    });
    setSession(created);
    setSc(storage.getScenarioState());
    await schedulePumpFailureReminders(created);
  };

  const endActive = async () => {
    const s = storage.getPumpFailureSession();
    if (s) await cancelPumpFailureReminders(s.id);
    storage.endPumpFailureMode();
    setSession(null);
    setSc(storage.getScenarioState());
  };

  return (
    <PageShell variant="standard" className="space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Pump or infusion failure"
        description="Emergency-style steps when delivery stops unexpectedly. This is educational — always follow your clinic's written backup plan."
      />

      <Disclaimer className="text-xs border border-border/60 rounded-lg p-3 bg-muted/20" />

      <Alert variant="destructive" className="border-destructive/50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Emergency</AlertTitle>
        <AlertDescription className="text-small">
          If you are vomiting, have moderate/large ketones, or cannot keep fluids down, seek urgent medical help or call your local emergency number.
        </AlertDescription>
      </Alert>

      <Card className="rounded-xl border-border/80">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            Active mode (timers)
          </CardTitle>
          <CardDescription>
            Start this if you want reminders to recheck glucose/ketones while you work through your pump-failure plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sc.pumpFailureActive ? (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-sm font-medium">Pump failure mode is active</p>
                {upcoming[0]?.atIso ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Next reminder in{" "}
                    <span className="font-semibold tabular-nums">
                      {minutesUntil(upcoming[0].atIso) ?? "—"}m
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">No upcoming reminders.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={endActive} data-testid="button-pumpfailure-end">
                  <Power className="h-4 w-4 mr-2" />
                  End mode
                </Button>
                <Button asChild variant="secondary" data-testid="button-pumpfailure-open-sickday">
                  <Link href="/sick-day">Open Sick Day Mode</Link>
                </Button>
              </div>
              {session ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                  <div className="space-y-1">
                    {upcoming.slice(0, 4).map((r) => (
                      <div key={`${r.kind}-${r.atIso}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                        <span className="text-sm capitalize">{r.kind.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(r.atIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="pumpfailure-bg">Current glucose (optional)</Label>
                  <Input
                    id="pumpfailure-bg"
                    value={bgInput}
                    onChange={(e) => setBgInput(e.target.value)}
                    inputMode="decimal"
                    placeholder={bgUnits === "mmol/L" ? "e.g. 14.2" : "e.g. 250"}
                    data-testid="input-pumpfailure-bg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Units</Label>
                  <Select value={bgUnits} onValueChange={(v) => setBgUnits(v as any)}>
                    <SelectTrigger data-testid="select-pumpfailure-bg-units">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mmol/L">mmol/L</SelectItem>
                      <SelectItem value="mg/dL">mg/dL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ketones (if known)</Label>
                  <Select value={ketones ?? "unknown"} onValueChange={(v) => setKetones(v as any)}>
                    <SelectTrigger data-testid="select-pumpfailure-ketones">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="trace">Trace</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => void startActive()} className="w-full" data-testid="button-pumpfailure-start">
                Start pump failure mode
              </Button>
              <p className="text-xs text-muted-foreground">
                Reminders: glucose recheck at 1h and 2h, ketones recheck at 2h, then a next‑morning review.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/80">
        <CardHeader>
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <Syringe className="h-6 w-6 text-primary" />
            Step-by-step
          </CardTitle>
          <CardDescription>Work through these in order</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible className="group rounded-xl border border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden />
                Quick checklist (tap to expand)
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={checklist.checkedKetones}
                    onCheckedChange={(v) => setChecklist((p) => ({ ...p, checkedKetones: v === true }))}
                  />
                  <span className="text-sm leading-snug">Checked ketones (if available)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={checklist.usedBackupInsulin}
                    onCheckedChange={(v) => setChecklist((p) => ({ ...p, usedBackupInsulin: v === true }))}
                  />
                  <span className="text-sm leading-snug">Switched to backup injections per plan</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={checklist.changedSetOrSite}
                    onCheckedChange={(v) => setChecklist((p) => ({ ...p, changedSetOrSite: v === true }))}
                  />
                  <span className="text-sm leading-snug">Changed infusion set / site (if relevant)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={checklist.contactedSupport}
                    onCheckedChange={(v) => setChecklist((p) => ({ ...p, contactedSupport: v === true }))}
                  />
                  <span className="text-sm leading-snug">Contacted pump support / diabetes team</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                This checklist is for guidance only — always follow your clinic’s written pump-failure plan.
              </p>
            </CollapsibleContent>
          </Collapsible>

          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-small font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <h2 className="text-h3 font-semibold text-foreground">{s.title}</h2>
                <p className="text-small text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}

          <Collapsible className="group rounded-xl border border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary shrink-0" aria-hidden />
                What to keep accessible
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
              <ul className="list-disc list-inside text-small text-muted-foreground space-y-2">
                <li>Spare rapid-acting and long-acting insulin pens (in date)</li>
                <li>Pen needles and a written backup dose plan</li>
                <li>Glucose tabs or juice for hypos</li>
                <li>Ketone strips if you use them</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/scenarios/travel">
            <Package className="h-4 w-4 mr-2" />
            Travel packing &amp; backup
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/supplies">
            Supply tracker
          </Link>
        </Button>
      </div>

      <p className="text-tiny text-muted-foreground flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 shrink-0" />
        Save your diabetes team and pump manufacturer numbers in your phone.
      </p>

      <MedicalSourcesLink anchor="sickday" />
    </PageShell>
  );
}
