import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, TrendingUp, Repeat, Droplet, Package, BookOpen, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { HubLoadingSkeleton } from "@/components/empty-state";

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

function ToolCard({ href, icon: Icon, title, description }: Omit<ToolDef, "id">) {
  return (
    <Link
      href={href}
      className="group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        variant="glass"
        className="flex h-full min-h-[11.75rem] w-full cursor-pointer flex-col gap-3 rounded-2xl transition-all duration-200 hover:border-primary/50 hover:shadow-md active:scale-[0.99]"
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

export function ToolsHubPage({ tools = PATIENT_TOOLS }: { tools?: ToolDef[] }) {
  return (
    <PageShell variant="standard" className="max-w-5xl space-y-8">
      <PageHeader
        className="max-w-2xl"
        leading={<PageBackButton />}
        title="Tools"
        description="Calculators, tracking, and learning resources. Educational only — always follow your care team&apos;s advice."
      />

      <ul
        className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7"
        aria-label="Tools"
      >
        {tools.map((t, idx) => (
          <li
            key={t.id}
            className="min-h-0 animate-soft-in"
            style={{ animationDelay: `${idx * 45}ms` }}
          >
            <ToolCard href={t.href} icon={t.icon} title={t.title} description={t.description} />
          </li>
        ))}
      </ul>
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
