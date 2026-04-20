import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Calculator,
  TrendingUp,
  Repeat,
  Droplet,
  Package,
  BookOpen,
  Lightbulb,
  Calendar,
  HeartPulse,
  Map as MapIcon,
  ChevronRight,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { PageHeader, PageShell } from "@/components/layout";
import { HubLoadingSkeleton } from "@/components/empty-state";
import { CURATED_RESOURCES, type CuratedResource } from "@/lib/curated-resources.ts";
import { openExternalUrl } from "@/lib/open-external-url";
import { cn } from "@/lib/utils";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

type ToolDef = {
  id: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

/**
 * Patient tools hub — each tool appears in exactly one section (no duplicate rows).
 */
const PATIENT_TOOLS: ToolDef[] = [
  {
    id: "insulin-calculator",
    href: "/adviser?tab=meal",
    icon: Calculator,
    title: "Meal & ratios",
    description: "Meal bolus ideas from your saved carb ratios, plus ratio review and the ratio adviser.",
  },
  {
    id: "correction-helper",
    href: "/tools/correction",
    icon: TrendingUp,
    title: "Correction helper",
    description: "Estimate a correction dose from your ISF; links to Ratios, Meal, Bedtime, Sick day.",
  },
  {
    id: "hypo-help",
    href: "/tools/hypo-help",
    icon: Droplet,
    title: "Hypo help",
    description: "Fast-acting carbs to treat a low from current and target BG.",
  },
  {
    id: "routines",
    href: "/tools/routines",
    icon: Repeat,
    title: "Routines",
    description: "Saved workouts and meal patterns for quick reuse.",
  },
  {
    id: "appointments",
    href: "/appointments",
    icon: Calendar,
    title: "Appointments",
    description: "Clinic visits and check-ups in one place.",
  },
  {
    id: "supply-tracker",
    href: "/supplies",
    icon: Package,
    title: "Supply tracker",
    description: "Stock, days remaining, and low-stock awareness.",
  },
  {
    id: "education",
    href: "/education",
    icon: BookOpen,
    title: "Education",
    description: "A–Z glossary of type 1 diabetes and app terms.",
  },
  {
    id: "tips",
    href: "/tools/tips",
    icon: Lightbulb,
    title: "Tips",
    description: "Tip of the day and a bigger library of practical reminders.",
  },
];

export const CARER_TOOLS: ToolDef[] = [
  {
    id: "hypo-help",
    href: "/tools/hypo-help",
    icon: Droplet,
    title: "Hypo help",
    description: "Fast-acting carbs guidance from current and target BG. Educational only.",
  },
  {
    id: "education",
    href: "/education",
    icon: BookOpen,
    title: "Education",
    description: "A–Z glossary of type 1 diabetes and app terms.",
  },
];

function ToolCard({
  href,
  icon: Icon,
  title,
  description,
  layout = "default",
}: Omit<ToolDef, "id"> & { layout?: "default" | "compact" }) {
  const cardClass =
    layout === "compact"
      ? "pressable card-interactive flex h-full min-h-[9.5rem] w-full cursor-pointer flex-col gap-2 rounded-2xl sm:min-h-[10.5rem]"
      : "pressable card-interactive flex h-full min-h-[10.5rem] w-full cursor-pointer flex-col gap-3 rounded-2xl md:min-h-[11.75rem]";
  const pad = layout === "compact" ? "p-5 sm:p-6" : "p-6 sm:p-7";
  return (
    <Link
      href={href}
      className="pressable group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card variant="glass" className={cardClass}>
        <CardContent className={cn("flex h-full flex-col gap-3", pad)}>
          <div className="flex flex-1 items-start gap-3 sm:gap-4">
            <Icon className="mt-0.5 h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-h3 font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                {description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Full-width horizontal strip for a single “Learn” tool on patient hub. */
function LearnToolRow({ href, icon: Icon, title, description }: Omit<ToolDef, "id">) {
  return (
    <Link
      href={href}
      className="pressable group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card variant="glass" className="pressable card-interactive cursor-pointer rounded-2xl border border-border/50">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="flex items-start gap-4 sm:items-center">
            <Icon className="h-9 w-9 shrink-0 text-primary sm:h-10 sm:w-10" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-h3 font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                {description}
              </p>
            </div>
          </div>
          <ChevronRight
            className="hidden h-6 w-6 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
            aria-hidden
          />
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-h3 font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function ToolsAboutDialog({ hubVariant }: { hubVariant: "patient" | "carer" }) {
  return (
    <PageInfoDialog
      title="About Tools"
      description="Calculators, tracking, and learning resources. Educational only — always follow your care team’s advice."
    >
      {hubVariant === "carer" ? (
        <>
          <InfoSection title="Supporter tools">
            <p>General education and hypo guidance. Always follow the care team’s plan for the person you support.</p>
          </InfoSection>
          <InfoSection title="News & resources">
            <p>Curated updates and trusted reading — preview here, then open the official site.</p>
          </InfoSection>
        </>
      ) : (
        <>
          <InfoSection title="Act now">
            <p>Meal doses, corrections, and fast hypo help when you need an answer.</p>
          </InfoSection>
          <InfoSection title="Plan">
            <p>Set up once, then reuse when you need it.</p>
          </InfoSection>
          <InfoSection title="Learn">
            <p>Clear explanations you can come back to anytime.</p>
          </InfoSection>
          <InfoSection title="News & resources">
            <p>Curated updates and trusted reading — preview here, then open the official site.</p>
          </InfoSection>
        </>
      )}
    </PageInfoDialog>
  );
}

function ResourcePreviewDialog({
  resource,
  open,
  onOpenChange,
}: {
  resource: CuratedResource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {resource ? (
        <DialogContent className="max-h-[min(90vh,36rem)] overflow-y-auto sm:max-w-lg" data-testid="resource-preview-dialog">
          <DialogHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{resource.source}</p>
            <DialogTitle className="text-left text-base leading-snug sm:text-lg">{resource.title}</DialogTitle>
            {resource.tag ? (
              <span className="inline-flex w-fit rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {resource.tag}
              </span>
            ) : null}
            <DialogDescription className="text-left text-sm text-muted-foreground">{resource.dateLabel}</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-foreground">{resource.description}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Opens the official site in your browser. You can return to Diabeaters anytime.
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                openExternalUrl(resource.href);
                onOpenChange(false);
              }}
              data-testid="resource-open-external"
            >
              Open on {resource.source}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ToolsHubPage({
  tools = PATIENT_TOOLS,
  hubVariant = "patient",
}: {
  tools?: ToolDef[];
  hubVariant?: "patient" | "carer";
}) {
  const [previewResource, setPreviewResource] = useState<CuratedResource | null>(null);
  const byId = new Map(tools.map((t) => [t.id, t] as const));

  const actNowIds =
    hubVariant === "carer" ? (["hypo-help"] as const) : (["insulin-calculator", "hypo-help", "correction-helper"] as const);
  const actNow = actNowIds.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const plan = (["routines", "appointments", "supply-tracker"] as const)
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const learn = (["education", "tips"] as const).map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const supporterTools = hubVariant === "carer" ? ([...actNow, ...learn] as ToolDef[]) : [];

  return (
    <PageShell variant="standard" className="max-w-5xl space-y-10">
      <PageHeader className="max-w-2xl" title="Tools" actions={<ToolsAboutDialog hubVariant={hubVariant} />} />

      {hubVariant === "carer" && supporterTools.length > 0 ? (
        <section className="space-y-4" aria-label="Supporter tools" data-testid="tools-section-supporter">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden />
            <SectionHeader title="Supporter tools" />
          </div>
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" aria-label="Supporter tools">
            {supporterTools.map((t, idx) => (
              <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 40}ms` }}>
                <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} layout="compact" />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {actNow.length > 0 ? (
            <section className="space-y-4" aria-label="Act now tools" data-testid="tools-section-act-now">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" aria-hidden />
                <SectionHeader title="Act now" />
              </div>
              <ul
                className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6"
                aria-label="Act now"
              >
                {actNow.map((t, idx) => (
                  <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 30}ms` }}>
                    <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} layout="compact" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plan.length > 0 ? (
            <section className="space-y-4" aria-label="Plan tools" data-testid="tools-section-plan">
              <div className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-primary" aria-hidden />
                <SectionHeader title="Plan" />
              </div>
              <ul
                className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7"
                aria-label="Plan"
              >
                {plan.map((t, idx) => (
                  <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 30}ms` }}>
                    <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {learn.length > 0 ? (
            <section className="space-y-4" aria-label="Learn tools" data-testid="tools-section-learn">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" aria-hidden />
                <SectionHeader title="Learn" />
              </div>
              <ul className="list-none space-y-4" aria-label="Learn">
                {learn.map((t, idx) => (
                  <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 30}ms` }}>
                    <LearnToolRow href={t.href} icon={t.icon} title={t.title} description={t.description} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {CURATED_RESOURCES.length > 0 && (
        <section className="space-y-4" aria-label="News and resources" data-testid="tools-section-resources">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            <SectionHeader title="News & resources" />
          </div>

          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2" aria-label="News & resources">
            {CURATED_RESOURCES.slice(0, 6).map((r, idx) => (
              <li key={r.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 25}ms` }}>
                <button
                  type="button"
                  onClick={() => setPreviewResource(r)}
                  className="group block h-full w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={`Preview ${r.title} (${r.source})`}
                  data-testid={`resource-${r.id}`}
                >
                  <Card
                    variant="glass"
                    className="pressable card-interactive flex h-full min-h-[9.5rem] flex-col gap-2 rounded-2xl"
                  >
                    <CardContent className="flex h-full flex-col gap-2 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.source}</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground leading-snug">{r.title}</h3>
                        </div>
                        {r.tag ? <span className="chip chip-muted shrink-0">{r.tag}</span> : null}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{r.description}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <p className="text-xs text-muted-foreground">{r.dateLabel}</p>
                        <span className="text-xs font-medium text-primary">Preview</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResourcePreviewDialog
        resource={previewResource}
        open={previewResource != null}
        onOpenChange={(o) => {
          if (!o) setPreviewResource(null);
        }}
      />
    </PageShell>
  );
}

export function CarerToolsPlaceholder() {
  return (
    <PageShell variant="narrow" className="space-y-4">
      <PageHeader title="Tools" />
      <Alert className="rounded-2xl border-border/60 shadow-sm">
        <AlertDescription className="text-sm leading-relaxed text-muted-foreground">
          Only general tools are shown here. Use <strong>Supporter Mode</strong> for read-only information about the person
          you support.{" "}
          <Link href="/education" className="font-medium text-foreground underline underline-offset-4">
            Education
          </Link>{" "}
          has general topics anyone can read.
        </AlertDescription>
      </Alert>
    </PageShell>
  );
}

/** Patients see the hub; Supporter Mode sessions see read-only messaging; carer-signup flows redirect away. */
export default function ToolsPage() {
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
  const [, setLocation] = useLocation();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");
  const tileCount = isCarerMode ? CARER_TOOLS.length : PATIENT_TOOLS.length;

  useEffect(() => {
    if (loading) return;
    if (!isCarerMode && (hasCarerIntent() || hasPendingCarer())) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, setLocation]);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  if (loading) {
    return (
      <PageShell variant="standard" className="max-w-5xl space-y-8">
        <div className="animate-soft-in space-y-3">
          <div className="h-9 max-w-xs rounded-lg bg-muted/80" />
          <div className="h-4 max-w-lg rounded-lg bg-muted/60" />
        </div>
        <HubLoadingSkeleton tiles={Math.max(tileCount, 6)} />
      </PageShell>
    );
  }
  if (!isCarerMode && (hasCarerIntent() || hasPendingCarer())) return null;
  if (isCarerMode) return <ToolsHubPage tools={CARER_TOOLS} hubVariant="carer" />;
  return <ToolsHubPage tools={PATIENT_TOOLS} hubVariant="patient" />;
}
