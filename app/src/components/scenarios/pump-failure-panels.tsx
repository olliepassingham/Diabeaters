import { Link } from "wouter";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Package,
  Phone,
  Settings2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readLocalEmergencyProfile } from "@/lib/emergency-sync";
import {
  assessPumpFailureEscalation,
  formatPumpFailureKetones,
  PUMP_FAILURE_TRIAGE_OPTIONS,
  telHrefForPhone,
  type PumpFailureEscalation,
} from "@/lib/pump-failure-guide";
import { pumpSetupCompletion } from "@/lib/pump-supplies";
import { formatAppTime, getKetoneEmergencyCopyForProfile, getProfileRegion } from "@/lib/region";
import {
  EMPTY_PUMP_FAILURE_CHECKLIST,
  storage,
  type PumpFailureChecklist,
  type PumpFailureKetoneLevel,
  type PumpFailureReadingLogEntry,
  type PumpFailureTriageKind,
  type UserProfile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

export function PumpFailureEmergencyCollapsible({
  regionFooter,
  open,
  onOpenChange,
  defaultOpen = false,
}: {
  regionFooter: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={open === undefined ? defaultOpen : undefined}
      className="group rounded-xl border border-destructive/30 bg-destructive/5"
      data-testid="pumpfailure-emergency-collapsible"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        <span className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          When to call emergency services
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-destructive/80 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-destructive/20 px-3.5 pb-3.5 pt-2.5">
        <p className="text-sm leading-relaxed text-destructive/90">
          If you are vomiting, have moderate/large ketones, feel confused, or cannot keep fluids down, seek urgent
          medical help.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{regionFooter}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PumpFailureEscalationBanner({
  ketonesLevel,
  symptoms,
  bgValue,
  bgUnits,
  profile,
}: {
  ketonesLevel: PumpFailureKetoneLevel;
  symptoms?: { vomiting?: boolean; confusion?: boolean };
  bgValue?: number | null;
  bgUnits?: string | null;
  profile: UserProfile | null;
}) {
  const region = getProfileRegion(profile);
  const escalation = assessPumpFailureEscalation({
    ketonesLevel,
    symptoms,
    bgValue,
    bgUnits,
    region,
  });

  if (escalation.level === "none") return null;

  const variant =
    escalation.level === "emergency" ? "destructive" : escalation.level === "urgent" ? "destructive" : "default";

  const borderClass =
    escalation.level === "emergency"
      ? "border-destructive/60 bg-destructive/10"
      : escalation.level === "urgent"
        ? "border-amber-500/50 bg-amber-500/10"
        : "border-primary/30 bg-primary/5";

  return (
    <Alert variant={variant} className={cn("rounded-2xl", borderClass)} data-testid="pumpfailure-escalation">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{escalation.title}</AlertTitle>
      <AlertDescription className="text-small leading-relaxed">{escalation.message}</AlertDescription>
      <p className="mt-2 text-xs text-muted-foreground">{getKetoneEmergencyCopyForProfile(profile).footer}</p>
    </Alert>
  );
}

export function PumpFailureStepCollapsible({
  stepNumber,
  title,
  body,
  tip,
}: {
  stepNumber: number;
  title: string;
  body: string;
  tip?: string | null;
}) {
  return (
    <Collapsible
      className="group rounded-xl border border-border/60 bg-card/80"
      defaultOpen={stepNumber === 1}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl hover:bg-muted/30">
        <span className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {stepNumber}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">{title}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-3">
        <p className="text-small text-muted-foreground leading-relaxed">{body}</p>
        {tip ? <p className="text-xs text-primary mt-2 font-medium">{tip}</p> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PumpFailureBackupToolkit({
  profile,
  embedded = false,
}: {
  profile: UserProfile | null;
  embedded?: boolean;
}) {
  const emergency = readLocalEmergencyProfile();
  const pumpSetup = pumpSetupCompletion(profile, storage.getSupplies());
  const settings = storage.getSettings();
  const hasRatios =
    Boolean(settings.breakfastRatio?.trim()) ||
    Boolean(settings.lunchRatio?.trim()) ||
    Boolean(settings.correctionFactor);
  const primaryTel = telHrefForPhone(emergency.phone);
  const secondaryTel = telHrefForPhone(emergency.phoneSecondary);

  const inner = (
    <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <ToolkitRow
            label="Backup pens tracked"
            value={pumpSetup.tracksBackup ? "Yes — rapid & long in Supplies" : "Not set up yet"}
            ok={pumpSetup.tracksBackup}
            href={pumpSetup.tracksBackup ? "/supplies" : "/supplies"}
            actionLabel={pumpSetup.tracksBackup ? "View supplies" : "Add backup pens"}
          />
          <ToolkitRow
            label="Ratios & correction saved"
            value={hasRatios ? "Saved in Settings" : "Not saved yet"}
            ok={hasRatios}
            href="/settings/ratios"
            actionLabel={hasRatios ? "Open ratios" : "Add ratios"}
          />
        </div>

        {(emergency.contactName.trim() || emergency.phone.trim()) ? (
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emergency contact</p>
            <p className="text-sm font-semibold text-foreground">
              {emergency.contactName.trim() || "Contact"}
              {emergency.relation.trim() ? (
                <span className="font-normal text-muted-foreground"> · {emergency.relation.trim()}</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {primaryTel ? (
                <Button size="sm" variant="default" className="min-h-9" asChild>
                  <a href={primaryTel} data-testid="pumpfailure-call-primary">
                    <Phone className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    Call {emergency.phone.trim()}
                  </a>
                </Button>
              ) : null}
              {secondaryTel ? (
                <Button size="sm" variant="outline" className="min-h-9" asChild>
                  <a href={secondaryTel}>{emergency.phoneSecondary.trim()}</a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full min-h-10 justify-start" asChild>
            <Link href="/settings/emergency">
              <Phone className="h-4 w-4 mr-2 text-primary" aria-hidden />
              Add emergency contact
            </Link>
          </Button>
        )}

        {emergency.medicalInstructions.trim() ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-background/50 p-2.5">
            <span className="font-medium text-foreground">Team notes: </span>
            {emergency.medicalInstructions.trim()}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" className="min-h-9" asChild>
            <Link href="/scenarios/travel">
              <Package className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Travel backup plan
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-9" asChild>
            <Link href="/settings/emergency">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Emergency settings
            </Link>
          </Button>
        </div>
    </div>
  );

  if (embedded) {
    return (
      <div data-testid="pumpfailure-backup-toolkit" className="space-y-3">
        <p className="text-sm text-muted-foreground">Quick links to your plan, contacts, and supplies — not dosing advice.</p>
        {inner}
      </div>
    );
  }

  return (
    <Card variant="glass" className="rounded-2xl border-primary/15" data-testid="pumpfailure-backup-toolkit">
      <CardHeader className="pb-3">
        <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
          <Package className="h-5 w-5 text-primary" aria-hidden />
          Your backup toolkit
        </CardTitle>
        <CardDescription>Quick links to your plan, contacts, and supplies — not dosing advice.</CardDescription>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}

function ToolkitRow({
  label,
  value,
  ok,
  href,
  actionLabel,
}: {
  label: string;
  value: string;
  ok: boolean;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-3 flex flex-col gap-2 min-h-[5.5rem]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <CircleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        )}
      </div>
      <p className="text-sm font-medium text-foreground leading-snug">{value}</p>
      <Button variant="link" className="h-auto p-0 text-xs justify-start" asChild>
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

export function PumpFailureTriagePicker({
  value,
  onChange,
  disabled,
}: {
  value: PumpFailureTriageKind;
  onChange: (v: PumpFailureTriageKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="pumpfailure-triage">
      <Label className="text-sm font-medium">What&apos;s going on?</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as PumpFailureTriageKind)}
        className="grid gap-2"
        disabled={disabled}
      >
        {PUMP_FAILURE_TRIAGE_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            htmlFor={`pumpfailure-triage-${opt.id}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 transition-colors",
              "has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <RadioGroupItem id={`pumpfailure-triage-${opt.id}`} value={opt.id} className="mt-0.5" />
            <span className="space-y-0.5 min-w-0">
              <span className="block text-sm font-medium text-foreground">{opt.title}</span>
              <span className="block text-xs text-muted-foreground leading-relaxed">{opt.description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

export function PumpFailureSymptomToggles({
  symptoms,
  onChange,
}: {
  symptoms: { vomiting?: boolean; confusion?: boolean };
  onChange: (next: { vomiting?: boolean; confusion?: boolean }) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Any of these right now?</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 cursor-pointer">
          <Checkbox
            checked={symptoms.vomiting === true}
            onCheckedChange={(v) => onChange({ ...symptoms, vomiting: v === true })}
            data-testid="pumpfailure-symptom-vomiting"
          />
          <span className="text-sm">Vomiting</span>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 cursor-pointer">
          <Checkbox
            checked={symptoms.confusion === true}
            onCheckedChange={(v) => onChange({ ...symptoms, confusion: v === true })}
            data-testid="pumpfailure-symptom-confusion"
          />
          <span className="text-sm">Confusion / very unwell</span>
        </label>
      </div>
    </div>
  );
}

export function PumpFailureChecklistPanel({
  checklist,
  onChange,
  defaultOpen,
}: {
  checklist: PumpFailureChecklist;
  onChange: (next: PumpFailureChecklist) => void;
  defaultOpen?: boolean;
}) {
  const done = Object.values(checklist).filter(Boolean).length;
  return (
    <Collapsible defaultOpen={defaultOpen} className="group rounded-xl border border-border/60">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4 text-primary shrink-0" aria-hidden />
          Quick checklist
          <Badge variant="secondary" className="rounded-full text-[10px] font-medium">
            {done}/4
          </Badge>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-3">
        <PumpFailureChecklistItems checklist={checklist} onChange={onChange} />
        <p className="text-xs text-muted-foreground mt-3">
          For guidance only — always follow your clinic&apos;s written pump-failure plan.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PumpFailureChecklistItems({
  checklist,
  onChange,
}: {
  checklist: PumpFailureChecklist;
  onChange: (next: PumpFailureChecklist) => void;
}) {
  const items: { key: keyof PumpFailureChecklist; label: string }[] = [
    { key: "checkedKetones", label: "Checked ketones (if available)" },
    { key: "usedBackupInsulin", label: "Switched to backup injections per plan" },
    { key: "changedSetOrSite", label: "Changed infusion set / site (if relevant)" },
    { key: "contactedSupport", label: "Contacted pump support / diabetes team" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <label key={item.key} className="flex items-start gap-2 cursor-pointer">
          <Checkbox
            checked={checklist[item.key]}
            onCheckedChange={(v) => onChange({ ...checklist, [item.key]: v === true })}
            data-testid={`pumpfailure-check-${item.key}`}
          />
          <span className="text-sm leading-snug">{item.label}</span>
        </label>
      ))}
    </div>
  );
}

export function PumpFailureReadingInputs({
  bgInput,
  onBgInputChange,
  bgUnits,
  ketones,
  onKetonesChange,
  idPrefix,
}: {
  bgInput: string;
  onBgInputChange: (v: string) => void;
  bgUnits: "mmol/L" | "mg/dL";
  ketones: PumpFailureKetoneLevel;
  onKetonesChange: (v: PumpFailureKetoneLevel) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-bg`}>Current glucose (optional)</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id={`${idPrefix}-bg`}
            value={bgInput}
            onChange={(e) => onBgInputChange(e.target.value)}
            inputMode="decimal"
            placeholder={bgUnits === "mmol/L" ? "e.g. 14.2" : "e.g. 250"}
            className="sm:max-w-[10rem]"
            data-testid={`${idPrefix}-bg`}
          />
          <span className="inline-flex h-9 items-center rounded-xl border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
            {bgUnits}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-ketones`}>Ketones (if known)</Label>
        <Select value={ketones} onValueChange={(v) => onKetonesChange(v as PumpFailureKetoneLevel)}>
          <SelectTrigger id={`${idPrefix}-ketones`} className="sm:max-w-xs" data-testid={`${idPrefix}-ketones`}>
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
  );
}

export function PumpFailureReadingLog({
  entries,
  profile,
}: {
  entries: PumpFailureReadingLogEntry[];
  profile: UserProfile | null;
}) {
  if (!entries.length) return null;
  return (
    <div className="space-y-2" data-testid="pumpfailure-reading-log">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recheck log</p>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm"
          >
            <span className="text-muted-foreground tabular-nums">
              {formatAppTime(e.atIso, profile, { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {e.bgValue != null && e.bgUnits ? `${e.bgValue} ${e.bgUnits}` : "—"}
              <span className="text-muted-foreground font-normal"> · {formatPumpFailureKetones(e.ketonesLevel)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PumpFailureTriageHint({ triageKind }: { triageKind?: PumpFailureTriageKind }) {
  const hint = PUMP_FAILURE_TRIAGE_OPTIONS.find((o) => o.id === triageKind)?.firstStepHint;
  if (!hint) return null;
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-foreground">
      <span className="font-medium">For your situation: </span>
      {hint}
    </div>
  );
}

export function defaultPumpFailureChecklist(): PumpFailureChecklist {
  return { ...EMPTY_PUMP_FAILURE_CHECKLIST };
}

export type { PumpFailureEscalation };
