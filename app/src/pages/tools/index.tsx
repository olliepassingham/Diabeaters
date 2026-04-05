import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, TrendingUp, Repeat, Droplet, Package, BookOpen, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { cn } from "@/lib/utils";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

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
    description: "Correction doses and ratio fine-tuning.",
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
    <Link href={href} className="group block h-full min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[1.25rem]">
      <Card
        className={cn(
          "h-full min-h-[11.75rem] border border-border/80 bg-card/80 backdrop-blur-sm",
          "shadow-sm",
          "transition-all duration-200 ease-out",
          "rounded-[1.25rem]",
          "hover:border-border hover:bg-card",
          "hover:shadow-md",
          "hover:-translate-y-0.5",
          "active:scale-[0.99]",
          "dark:border-border/60 dark:hover:shadow-lg",
        )}
      >
        <CardContent className="flex h-full flex-col gap-4 p-6 sm:p-7">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              "bg-muted/70 text-foreground/85",
              "transition-colors duration-300",
              "group-hover:bg-primary/10 group-hover:text-primary",
            )}
            aria-hidden
          >
            <Icon className="h-[1.35rem] w-[1.35rem] stroke-[1.75]" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-foreground sm:text-base">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
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
        {tools.map((t) => (
          <li key={t.id} className="min-h-0">
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
    return <div className="flex justify-center py-16 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isCarerMode && (hasCarerIntent() || hasPendingCarer())) return null;
  if (isCarerMode) return <ToolsHubPage tools={CARER_TOOLS} />;
  return <ToolsHubPage tools={PATIENT_TOOLS} />;
}
