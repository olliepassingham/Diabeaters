import { useEffect, useState, useCallback } from "react";
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
  MessageCircle,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { PageHeader, PageShell } from "@/components/layout";
import { HubLoadingSkeleton } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { isAiCoachEnabled } from "@/lib/flags";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { prefetchToolsDestinationHref, prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";
import { DobUnknownNotice } from "@/components/dob-unknown-notice";

function tileEnterDelay(index: number, stepMs = 12, capMs = 72): string {
  return `${Math.min(index * stepMs, capMs)}ms`;
}

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

function patientToolsForHub(): ToolDef[] {
  const coach: ToolDef | undefined = isAiCoachEnabled
    ? {
        id: "ai-coach",
        href: "/coach",
        icon: MessageCircle,
        title: AI_ASSISTANT_NAME,
        description:
          `${AI_ASSISTANT_NAME} is an educational guide for type 1 diabetes in the UK. Not medical advice. Requires consent; OpenAI is used when your team enables it.`,
      }
    : undefined;
  return coach ? [coach, ...PATIENT_TOOLS] : [...PATIENT_TOOLS];
}

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

/**
 * Carer tools list used by the live hub. Prepends the supporter-mode coach
 * tile when the AI coach feature flag is on, mirroring `patientToolsForHub`.
 */
export function carerToolsForHub(): ToolDef[] {
  if (!isAiCoachEnabled) return CARER_TOOLS;
  const coach: ToolDef = {
    id: "ai-coach",
    href: "/coach?audience=supporter",
    icon: MessageCircle,
    title: AI_ASSISTANT_NAME,
    description:
      `${AI_ASSISTANT_NAME} is an educational guide for partners, family, friends, or carers of someone with type 1 diabetes in the UK. Not medical advice.`,
  };
  return [coach, ...CARER_TOOLS];
}

const COMMUNITY_TOOLS: ToolDef[] = [
  {
    id: "hypo-help",
    href: "/tools/hypo-help",
    icon: Droplet,
    title: "What is a hypo?",
    description: "Educational overview of low blood glucose — when to treat urgently vs when to read and learn.",
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

export function communityToolsForHub(): ToolDef[] {
  if (!isAiCoachEnabled) return COMMUNITY_TOOLS;
  const coach: ToolDef = {
    id: "ai-coach",
    href: "/coach",
    icon: MessageCircle,
    title: AI_ASSISTANT_NAME,
    description: `${AI_ASSISTANT_NAME} is an educational guide for type 1 diabetes in the UK. Not medical advice.`,
  };
  return [coach, ...COMMUNITY_TOOLS];
}

function ToolCard({
  href,
  icon: Icon,
  title,
  description,
  layout = "default",
}: Omit<ToolDef, "id"> & { layout?: "default" | "compact" }) {
  const warm = useCallback(() => prefetchToolsDestinationHref(href), [href]);
  const cardClass =
    layout === "compact"
      ? "pressable card-interactive flex h-full min-h-[9.5rem] w-full cursor-pointer flex-col gap-2 rounded-2xl sm:min-h-[10.5rem]"
      : "pressable card-interactive flex h-full min-h-[10.5rem] w-full cursor-pointer flex-col gap-3 rounded-2xl md:min-h-[11.75rem]";
  const pad = layout === "compact" ? "p-5 sm:p-6" : "p-6 sm:p-7";
  return (
    <Link
      href={href}
      className="pressable group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
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
  const warm = useCallback(() => prefetchToolsDestinationHref(href), [href]);
  return (
    <Link
      href={href}
      className="pressable group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
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

function ToolsAboutDialog({ hubVariant }: { hubVariant: "patient" | "carer" | "community" }) {
  return (
    <PageInfoDialog
      title="About Tools"
      description="Calculators, tracking, and learning resources. Educational only — always follow your care team’s advice."
    >
      {hubVariant === "carer" || hubVariant === "community" ? (
        <>
          <InfoSection title={hubVariant === "community" ? "Learn & connect" : "Supporter tools"}>
            <p>
              {hubVariant === "community"
                ? "Education, tips, and hypo awareness — without personal dose or supply tracking."
                : "General education and hypo guidance. Always follow the care team’s plan for the person you support."}
            </p>
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
        </>
      )}
    </PageInfoDialog>
  );
}

export function ToolsHubPage({
  tools = PATIENT_TOOLS,
  hubVariant = "patient",
}: {
  tools?: ToolDef[];
  hubVariant?: "patient" | "carer" | "community";
}) {
  const byId = new Map(tools.map((t) => [t.id, t] as const));

  useEffect(() => {
    const run = () => prefetchToolsHubLinkedChunks();
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 0);
    return () => window.clearTimeout(t);
  }, []);

  // "Act now" is a fixed id list; `ai-coach` is prepended by `patientToolsForHub()` /
  // `carerToolsForHub()` when the feature is on. It must be included here — otherwise the tile
  // exists in `tools` but never renders.
  const patientActNowIds: readonly string[] =
    byId.has("ai-coach")
      ? ["ai-coach", "insulin-calculator", "hypo-help", "correction-helper"]
      : ["insulin-calculator", "hypo-help", "correction-helper"];

  const actNowIds: readonly string[] =
    hubVariant === "carer" || hubVariant === "community"
      ? byId.has("ai-coach")
        ? ["ai-coach", "hypo-help"]
        : ["hypo-help"]
      : patientActNowIds;
  const actNow = actNowIds.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const plan = (["routines", "appointments", "supply-tracker"] as const)
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const learn = (["education", "tips"] as const).map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const supporterTools =
    hubVariant === "carer" || hubVariant === "community" ? ([...actNow, ...learn] as ToolDef[]) : [];

  return (
    <PageShell variant="standard" className="max-w-5xl space-y-10">
      <PageHeader className="max-w-2xl" title="Tools" actions={<ToolsAboutDialog hubVariant={hubVariant} />} />

      <DobUnknownNotice hidden={hubVariant === "carer" || hubVariant === "community"} testId="tools-dob-unknown-notice" />

      {(hubVariant === "carer" || hubVariant === "community") && supporterTools.length > 0 ? (
        <section
          className="space-y-4"
          aria-label={hubVariant === "community" ? "Community tools" : "Supporter tools"}
          data-testid="tools-section-supporter"
        >
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden />
            <SectionHeader title={hubVariant === "community" ? "Learn & connect" : "Supporter tools"} />
          </div>
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" aria-label="Supporter tools">
            {supporterTools.map((t, idx) => (
              <li
                key={t.id}
                className="min-h-0 animate-soft-in motion-safe:[animation-duration:0.2s]"
                style={{ animationDelay: tileEnterDelay(idx, 10, 56) }}
              >
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
                  <li
                    key={t.id}
                    className="min-h-0 animate-soft-in motion-safe:[animation-duration:0.2s]"
                    style={{ animationDelay: tileEnterDelay(idx) }}
                  >
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
                  <li
                    key={t.id}
                    className="min-h-0 animate-soft-in motion-safe:[animation-duration:0.2s]"
                    style={{ animationDelay: tileEnterDelay(idx) }}
                  >
                    <LearnToolRow href={t.href} icon={t.icon} title={t.title} description={t.description} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
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
  const isCommunityMode =
    !hasCarerLink &&
    activeMode !== "patient" &&
    activeMode !== "carer" &&
    (activeMode === "community" || (activeMode == null && isCommunityAccountProfile(storage.getProfile())));
  const tileCount = isCarerMode
    ? carerToolsForHub().length
    : isCommunityMode
      ? communityToolsForHub().length
      : patientToolsForHub().length;

  useEffect(() => {
    prefetchToolsHubLinkedChunks();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isCarerMode && !isCommunityMode && (hasCarerIntent() || hasPendingCarer())) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, isCommunityMode, setLocation]);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
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
  if (!isCarerMode && !isCommunityMode && (hasCarerIntent() || hasPendingCarer())) return null;
  if (isCarerMode) return <ToolsHubPage tools={carerToolsForHub()} hubVariant="carer" />;
  if (isCommunityMode) return <ToolsHubPage tools={communityToolsForHub()} hubVariant="community" />;
  return <ToolsHubPage tools={patientToolsForHub()} hubVariant="patient" />;
}
