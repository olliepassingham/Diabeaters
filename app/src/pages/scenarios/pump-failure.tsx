import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Phone, Package, Clock, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { ScenarioToolDisclaimer } from "@/components/disclaimer";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { ScenarioActiveCard } from "@/components/scenarios/ScenarioActiveCard";
import {
  defaultPumpFailureChecklist,
  PumpFailureBackupToolkit,
  PumpFailureChecklistPanel,
  PumpFailureEmergencyCollapsible,
  PumpFailureEscalationBanner,
  PumpFailureReadingInputs,
  PumpFailureReadingLog,
  PumpFailureStepCollapsible,
  PumpFailureSymptomToggles,
  PumpFailureTriageHint,
  PumpFailureTriagePicker,
} from "@/components/scenarios/pump-failure-panels";
import {
  assessPumpFailureEscalation,
  formatPumpFailureKetones,
  parsePumpFailureBgInput,
} from "@/lib/pump-failure-guide";
import { recordLastInteraction } from "@/lib/last-interaction";
import { getKetoneEmergencyCopyForProfile, getProfileRegion } from "@/lib/region";
import { schedulePumpFailureReminders, cancelPumpFailureReminders } from "@/lib/pump-failure-reminders";
import {
  DIABEATER_PROFILE_CHANGED_EVENT,
  storage,
  type PumpFailureChecklist,
  type PumpFailureKetoneLevel,
  type PumpFailureSession,
  type PumpFailureTriageKind,
} from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

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
  return Math.ceil((t - Date.now()) / 60000);
}

function stepTip(index: number, triage: PumpFailureTriageKind | undefined): string | null {
  if (index === 0 && triage === "set_issue") {
    return "Tip: try a new infusion set and site before assuming the pump itself has failed.";
  }
  if (index === 1 && triage === "delivery_stopped") {
    return "Tip: use the backup doses on your written pump-failure plan — see the Backup tab.";
  }
  return null;
}

export default function PumpFailurePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(() => storage.getProfile());
  const bgUnits: "mmol/L" | "mg/dL" = profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";

  useEffect(() => {
    const onProfile = () => setProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  const [sc, setSc] = useState(() => storage.getScenarioState());
  const [session, setSession] = useState<PumpFailureSession | null>(() => storage.getPumpFailureSession());
  const [activeTab, setActiveTab] = useState("now");
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const [triageKind, setTriageKind] = useState<PumpFailureTriageKind>("delivery_stopped");
  const [bgInput, setBgInput] = useState("");
  const [ketones, setKetones] = useState<PumpFailureKetoneLevel>("unknown");
  const [symptoms, setSymptoms] = useState<{ vomiting?: boolean; confusion?: boolean }>({});
  const [checklist, setChecklist] = useState<PumpFailureChecklist>(() => defaultPumpFailureChecklist());

  const [recheckBg, setRecheckBg] = useState("");
  const [recheckKetones, setRecheckKetones] = useState<PumpFailureKetoneLevel>("unknown");

  const isActive = sc.pumpFailureActive;

  const displayBg = isActive ? session?.bgValue ?? null : parsePumpFailureBgInput(bgInput);
  const displayBgUnits = isActive ? session?.bgUnits ?? bgUnits : bgUnits;
  const displayKetones = isActive ? session?.ketonesLevel ?? "unknown" : ketones;
  const displaySymptoms = isActive ? session?.symptoms ?? {} : symptoms;
  const displayChecklist = isActive ? session?.checklist ?? defaultPumpFailureChecklist() : checklist;
  const displayTriage = isActive ? session?.triageKind : triageKind;

  const escalation = useMemo(
    () =>
      assessPumpFailureEscalation({
        ketonesLevel: displayKetones,
        symptoms: displaySymptoms,
        bgValue: displayBg,
        bgUnits: displayBgUnits,
        region: getProfileRegion(profile),
      }),
    [displayKetones, displaySymptoms, displayBg, displayBgUnits, profile],
  );

  const regionFooter = getKetoneEmergencyCopyForProfile(profile).footer;
  const emergencyDefaultOpen =
    escalation.level === "emergency" ||
    displaySymptoms.vomiting === true ||
    displaySymptoms.confusion === true;

  useEffect(() => {
    if (storage.getScenarioState().pumpFailureActive) {
      recordLastInteraction("scenario:pump-failure");
    }
  }, []);

  useEffect(() => {
    if (isActive) setActiveTab("now");
  }, [isActive]);

  useEffect(() => {
    if (emergencyDefaultOpen) setEmergencyOpen(true);
  }, [emergencyDefaultOpen]);

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

  const refreshSession = () => {
    setSession(storage.getPumpFailureSession());
    setSc(storage.getScenarioState());
  };

  const startActive = async () => {
    const bg = parsePumpFailureBgInput(bgInput);
    const created = storage.activatePumpFailureMode({
      bgValue: bg,
      bgUnits,
      ketonesLevel: ketones,
      symptoms,
      triageKind,
      checklist,
    });
    setSession(created);
    setSc(storage.getScenarioState());
    setActiveTab("now");
    try {
      await schedulePumpFailureReminders(created);
      toast({ title: "Pump failure mode started", description: "Reminders are scheduled. Work through the steps below." });
    } catch {
      toast({
        title: "Pump failure mode started",
        description: "Couldn’t schedule reminder notifications, but mode is active.",
      });
    }
  };

  const endActive = async () => {
    const s = storage.getPumpFailureSession();
    try {
      if (s) await cancelPumpFailureReminders(s.id);
    } catch {
      // non-blocking
    }
    storage.endPumpFailureMode();
    setSession(null);
    setSc(storage.getScenarioState());
    setRecheckBg("");
    setRecheckKetones("unknown");
  };

  const saveRecheck = () => {
    const bg = parsePumpFailureBgInput(recheckBg);
    if (bg == null && recheckKetones === "unknown") {
      toast({
        title: "Add a reading",
        description: "Enter glucose and/or choose ketones before saving.",
        variant: "destructive",
      });
      return;
    }
    const next = storage.addPumpFailureReading({
      bgValue: bg,
      bgUnits,
      ketonesLevel: recheckKetones,
    });
    if (!next) return;
    setSession(next);
    setRecheckBg("");
    setRecheckKetones("unknown");
    toast({ title: "Reading saved", description: "Keep monitoring per your clinic plan." });
  };

  const updateChecklist = (next: PumpFailureChecklist) => {
    if (isActive) {
      storage.updatePumpFailureSession({ checklist: next });
      refreshSession();
    } else {
      setChecklist(next);
    }
  };

  const updateSymptoms = (next: { vomiting?: boolean; confusion?: boolean }) => {
    if (isActive) {
      storage.updatePumpFailureSession({ symptoms: next });
      refreshSession();
    } else {
      setSymptoms(next);
    }
  };

  const activeModePanel = (
    <Card variant="glass" className="rounded-2xl border-border/60 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Clock className="h-4 w-4 text-primary" aria-hidden />
          {isActive ? "Active mode" : "Start active mode"}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {isActive
            ? "Timers and recheck reminders while you work through your plan."
            : "Optional timers to recheck glucose and ketones."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActive ? (
          <>
            <ScenarioActiveCard
              title="Pump failure mode is active"
              badgeText="Active"
              tone="amber"
              icon={<Clock className="h-4 w-4 text-primary" aria-hidden />}
              facts={[
                {
                  label: "Next reminder",
                  value: upcoming[0]?.atIso ? (
                    <span className="tabular-nums">{minutesUntil(upcoming[0].atIso) ?? "—"}m</span>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Ketones",
                  value: formatPumpFailureKetones(session?.ketonesLevel),
                },
                {
                  label: "Glucose",
                  value:
                    session?.bgValue != null && session?.bgUnits
                      ? `${session.bgValue} ${session.bgUnits}`
                      : "Not set",
                },
              ]}
            />

            <PumpFailureTriageHint triageKind={displayTriage} />
            <PumpFailureSymptomToggles symptoms={displaySymptoms} onChange={updateSymptoms} />

            <Collapsible className="group rounded-xl border border-border/60">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-medium hover:bg-muted/30 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Log a recheck
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border/60 px-3.5 pb-3.5 pt-3 space-y-3">
                <PumpFailureReadingInputs
                  idPrefix="pumpfailure-recheck"
                  bgInput={recheckBg}
                  onBgInputChange={setRecheckBg}
                  bgUnits={bgUnits}
                  ketones={recheckKetones}
                  onKetonesChange={setRecheckKetones}
                />
                <Button onClick={saveRecheck} className="w-full min-h-11" data-testid="button-pumpfailure-save-recheck">
                  Save recheck
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <PumpFailureReadingLog entries={session?.readingLog ?? []} profile={profile} />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void endActive()} data-testid="button-pumpfailure-end">
                <Power className="h-4 w-4 mr-2" aria-hidden />
                End mode
              </Button>
              <Button asChild variant="secondary" data-testid="button-pumpfailure-open-sickday">
                <Link href="/sick-day">Open sick day mode</Link>
              </Button>
            </div>

            {session && upcoming.length > 0 ? (
              <Collapsible className="group rounded-xl border border-border/60">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/30 rounded-xl">
                  Upcoming reminders ({upcoming.length})
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border/60 px-3.5 pb-3 pt-2 space-y-1.5">
                  {upcoming.slice(0, 4).map((r) => (
                    <div
                      key={`${r.kind}-${r.atIso}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2"
                    >
                      <span className="text-sm capitalize">{r.kind.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(r.atIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </>
        ) : (
          <>
            <PumpFailureTriagePicker value={triageKind} onChange={setTriageKind} />
            <PumpFailureTriageHint triageKind={triageKind} />
            <PumpFailureSymptomToggles symptoms={symptoms} onChange={setSymptoms} />
            <PumpFailureReadingInputs
              idPrefix="pumpfailure-start"
              bgInput={bgInput}
              onBgInputChange={setBgInput}
              bgUnits={bgUnits}
              ketones={ketones}
              onKetonesChange={setKetones}
            />
            <Button onClick={() => void startActive()} className="w-full min-h-11" data-testid="button-pumpfailure-start">
              Start pump failure mode
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Reminders: glucose at 1h and 2h · ketones at 2h · morning review
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4">
      <PageHeader
        leading={<PageBackButton />}
        title="Pump failure"
        description="When delivery stops — steps, timers, and backup links. Follow your clinic's plan."
        actions={<ScenarioCoachLink topic="pump-failure" />}
      />

      <PumpFailureEmergencyCollapsible
        regionFooter={regionFooter}
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="now" className="min-h-10 px-2 text-xs sm:text-sm" data-testid="pumpfailure-tab-now">
            Do now
          </TabsTrigger>
          <TabsTrigger value="steps" className="min-h-10 px-2 text-xs sm:text-sm" data-testid="pumpfailure-tab-steps">
            Steps
          </TabsTrigger>
          <TabsTrigger value="backup" className="min-h-10 px-2 text-xs sm:text-sm" data-testid="pumpfailure-tab-backup">
            Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="now" className="mt-0 space-y-4">
          {escalation.level !== "none" ? (
            <PumpFailureEscalationBanner
              ketonesLevel={displayKetones}
              symptoms={displaySymptoms}
              bgValue={displayBg}
              bgUnits={displayBgUnits}
              profile={profile}
            />
          ) : null}
          {activeModePanel}
        </TabsContent>

        <TabsContent value="steps" className="mt-0 space-y-4">
          <PumpFailureChecklistPanel
            checklist={displayChecklist}
            onChange={updateChecklist}
            defaultOpen={isActive}
          />
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <PumpFailureStepCollapsible
                key={s.title}
                stepNumber={i + 1}
                title={s.title}
                body={s.body}
                tip={stepTip(i, displayTriage)}
              />
            ))}
          </div>
          <Collapsible className="group rounded-xl border border-border/60 bg-muted/10">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30 rounded-xl">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" aria-hidden />
                What to keep accessible
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
              <ul className="list-disc list-inside text-small text-muted-foreground space-y-1.5">
                <li>Spare rapid-acting and long-acting insulin pens (in date)</li>
                <li>Pen needles and a written backup dose plan</li>
                <li>Glucose tabs or juice for hypos</li>
                <li>Ketone strips if you use them</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="backup" className="mt-0 space-y-4">
          <Card variant="glass" className="rounded-2xl shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" aria-hidden />
                Your backup toolkit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PumpFailureBackupToolkit profile={profile} embedded />
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="min-h-10" asChild>
              <Link href="/scenarios/travel">
                <Package className="h-4 w-4 mr-2" aria-hidden />
                Travel packing
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="min-h-10" asChild>
              <Link href="/supplies">Supply tracker</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            Add diabetes team and pump manufacturer numbers in{" "}
            <Link href="/settings/emergency" className="text-primary underline-offset-2 hover:underline">
              Emergency settings
            </Link>
            .
          </p>
        </TabsContent>
      </Tabs>

      <footer className="space-y-4 border-t border-border/40 pt-5">
        <ScenarioToolDisclaimer />
        <MedicalSourcesLink anchor="sickday" />
      </footer>
    </PageShell>
  );
}
