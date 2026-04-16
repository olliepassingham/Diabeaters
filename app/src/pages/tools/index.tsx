import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, TrendingUp, Repeat, Droplet, Package, BookOpen, Calendar, Sparkles, HeartPulse, Map as MapIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { HubLoadingSkeleton } from "@/components/empty-state";
import { CURATED_RESOURCES } from "@/lib/curated-resources.ts";

type ToolDef = {
  id: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

/**
 * Single hub for patient tools — six tiles in a balanced grid (2×3 on large screens).
 * No redundant shortcuts to Home or Settings; each link goes to a dedicated feature.
 */
const PATIENT_TOOLS: ToolDef[] = [
  {
    id: "insulin-calculator",
    href: "/adviser?tab=meal",
    icon: Calculator,
    title: "Insulin calculator",
    description: "Meal-time dose suggestions from your carb ratios and settings.",
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
];

const CARER_TOOLS: ToolDef[] = [
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
  variant = "default",
}: Omit<ToolDef, "id"> & { variant?: "default" | "featured" }) {
  const cardClass =
    variant === "featured"
      ? "pressable card-interactive flex h-full min-h-[12.5rem] w-full cursor-pointer flex-col gap-3 rounded-2xl"
      : "pressable card-interactive flex h-full min-h-[11.75rem] w-full cursor-pointer flex-col gap-3 rounded-2xl";
  return (
    <Link
      href={href}
      className="pressable group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        variant="glass"
        className={cardClass}
      >
        <CardContent className="flex h-full flex-col gap-3 p-6 sm:p-7">
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

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-h3 font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}

export function ToolsHubPage({ tools = PATIENT_TOOLS }: { tools?: ToolDef[] }) {
  const byId = new Map(tools.map((t) => [t.id, t] as const));

  const featured = [
    "hypo-help",
    "insulin-calculator",
    "correction-helper",
    "supply-tracker",
  ]
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const actNow = ["hypo-help", "correction-helper"]
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const plan = ["routines", "appointments", "supply-tracker"]
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const learn = ["education"]
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  return (
    <PageShell variant="standard" className="max-w-5xl space-y-10">
      <PageHeader
        className="max-w-2xl"
        leading={<PageBackButton />}
        title="Tools"
        description="Calculators, tracking, and learning resources. Educational only — always follow your care team&apos;s advice."
      />

      {featured.length > 0 && (
        <section className="space-y-4" aria-label="Most used tools" data-testid="tools-section-most-used">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            <SectionHeader title="Most used" description="Quick access to the tools people reach for most." />
          </div>
          <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6" aria-label="Most used">
            {featured.map((t, idx) => (
              <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 35}ms` }}>
                <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} variant="featured" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4" aria-label="Act now tools" data-testid="tools-section-act-now">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" aria-hidden />
          <SectionHeader title="Act now" description="Fast help for the moments you need an answer." />
        </div>
        <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7" aria-label="Act now">
          {actNow.map((t, idx) => (
            <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 30}ms` }}>
              <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-label="Plan tools" data-testid="tools-section-plan">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-primary" aria-hidden />
          <SectionHeader title="Plan" description="Set up once, then reuse when you need it." />
        </div>
        <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7" aria-label="Plan">
          {plan.map((t, idx) => (
            <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 30}ms` }}>
              <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-label="Learn tools" data-testid="tools-section-learn">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden />
          <SectionHeader title="Learn" description="Clear explanations you can come back to anytime." />
        </div>
        <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7" aria-label="Learn">
          {learn.map((t, idx) => (
            <li key={t.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 30}ms` }}>
              <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} />
            </li>
          ))}
        </ul>
      </section>

      {CURATED_RESOURCES.length > 0 && (
        <section className="space-y-4" aria-label="News and resources" data-testid="tools-section-resources">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            <SectionHeader title="News & resources" description="Curated updates and trusted reading." />
          </div>

          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2" aria-label="News & resources">
            {CURATED_RESOURCES.slice(0, 6).map((r, idx) => (
              <li key={r.id} className="min-h-0 animate-soft-in" style={{ animationDelay: `${idx * 25}ms` }}>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={`${r.title} (${r.source})`}
                  data-testid={`resource-${r.id}`}
                >
                  <Card
                    variant="glass"
                    className="pressable card-interactive flex h-full min-h-[9.5rem] flex-col gap-2 rounded-2xl"
                  >
                    <CardContent className="flex h-full flex-col gap-2 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {r.source}
                          </p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground leading-snug">
                            {r.title}
                          </h3>
                        </div>
                        {r.tag ? (
                          <span className="chip chip-muted shrink-0">
                            {r.tag}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {r.description}
                      </p>
                      <div className="mt-auto pt-1">
                        <p className="text-xs text-muted-foreground">
                          {r.dateLabel}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

export function CarerToolsPlaceholder() {
  return (
    <PageShell variant="narrow" className="space-y-4">
      <PageHeader title="Tools" leading={<PageBackButton />} />
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
  if (isCarerMode) return <ToolsHubPage tools={CARER_TOOLS} />;
  return <ToolsHubPage tools={PATIENT_TOOLS} />;
}
