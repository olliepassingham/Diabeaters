import { useEffect, useMemo, useState, useCallback } from "react";
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
  ScrollText,
  Sparkles,
  Users,
  Activity,
  LineChart,
  ArrowLeftRight,
  History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer, isCarerSessionMode, isCommunitySessionMode } from "@/lib/carer-session";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { useProfile } from "@/lib/profile";
import { PageHeader, PageShell } from "@/components/layout";
import { HubLoadingSkeleton } from "@/components/empty-state";
import { CommunityPushPromptDialog } from "@/components/community-push-prompt-dialog";
import { useCommunityPushPromptAfterOnboarding } from "@/hooks/use-community-push-prompt-after-onboarding";
import { cn } from "@/lib/utils";
import { isAiCoachEnabled } from "@/lib/flags";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { prefetchToolsDestinationHref, prefetchToolsHubLinkedChunks } from "@/lib/tools-route-prefetch";
import { RatiosSetupNotice } from "@/components/ratios-setup-notice";
import { useOffline } from "@/hooks/use-offline";
import { filterOfflineCloudTools } from "@/lib/offline-app-gate";
import { OfflineDeviceNotice } from "@/components/offline-device-notice";
import { hasLiveCgmCredentials, readCgmPreferences } from "@/lib/cgm/preferences";
import { hapticLight } from "@/lib/haptics";

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
    description: "Meal insulin from your saved carb ratios",
  },
  {
    id: "correction-helper",
    href: "/tools/correction",
    icon: TrendingUp,
    title: "Correction helper",
    description: "Correction dose from your sensitivity factor",
  },
  {
    id: "hypo-help",
    href: "/tools/hypo-help",
    icon: Droplet,
    title: "Hypo help",
    description: "Fast-carb amounts for a low",
  },
  {
    id: "hypo-history",
    href: "/tools/hypo-history",
    icon: History,
    title: "Hypo history",
    description: "Monthly counts and what you treated with",
  },
  {
    id: "activity-log",
    href: "/tools/activity",
    icon: ScrollText,
    title: "Activity log",
    description: "Calendar of everything you've logged",
  },
  {
    id: "patterns",
    href: "/tools/patterns",
    icon: LineChart,
    title: "Your patterns",
    description: "Charts of your lows over time",
  },
  {
    id: "glucose-converter",
    href: "/tools/glucose-converter",
    icon: ArrowLeftRight,
    title: "Glucose units",
    description: "Convert mmol/L ↔ mg/dL",
  },
  {
    id: "routines",
    href: "/tools/routines",
    icon: Repeat,
    title: "Routines",
    description: "Saved workouts and meals, one tap away",
  },
  {
    id: "appointments",
    href: "/appointments",
    icon: Calendar,
    title: "Appointments",
    description: "Clinic visits and check-ups",
  },
  {
    id: "supply-tracker",
    href: "/supplies",
    icon: Package,
    title: "Supply tracker",
    description: "Stock levels and days-left estimate",
  },
  {
    id: "education",
    href: "/education",
    icon: BookOpen,
    title: "Education",
    description: "Plain-language articles and definitions",
  },
  {
    id: "tips",
    href: "/tools/tips",
    icon: Lightbulb,
    title: "Tips",
    description: "Daily tip plus more ideas",
  },
  {
    id: "achievements",
    href: "/tools/achievements",
    icon: Sparkles,
    title: "Achievements",
    description: "Streak badges you can pin to your profile",
  },
];

function patientToolsForHub(): ToolDef[] {
  const coach: ToolDef | undefined = isAiCoachEnabled
    ? {
        id: "ai-coach",
        href: "/coach",
        icon: MessageCircle,
        title: AI_ASSISTANT_NAME,
        description: "Educational chat about type 1 diabetes",
      }
    : undefined;
  const cgmLive: ToolDef | undefined = hasLiveCgmCredentials(readCgmPreferences())
    ? {
        id: "cgm-live",
        href: "/tools/cgm-live",
        icon: Activity,
        title: "Glucose trends",
        description: "Near-live CGM chart, this device only",
      }
    : undefined;
  const tools = coach ? [coach, ...PATIENT_TOOLS] : [...PATIENT_TOOLS];
  return cgmLive ? [cgmLive, ...tools] : tools;
}

export const CARER_TOOLS: ToolDef[] = [
  {
    id: "hypo-help",
    href: "/tools/hypo-help",
    icon: Droplet,
    title: "Hypo help",
    description: "Fast-carb guidance. Educational only",
  },
  {
    id: "glucose-converter",
    href: "/tools/glucose-converter",
    icon: ArrowLeftRight,
    title: "Glucose units",
    description: "Convert mmol/L ↔ mg/dL",
  },
  {
    id: "education",
    href: "/education",
    icon: BookOpen,
    title: "Education",
    description: "Plain-language articles and definitions",
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
    description: "Educational chat for carers and family",
  };
  return [coach, ...CARER_TOOLS];
}

const COMMUNITY_TOOLS: ToolDef[] = [
  {
    id: "hypo-help",
    href: "/tools/hypo-help",
    icon: Droplet,
    title: "What is a hypo?",
    description: "What to know about low blood glucose",
  },
  {
    id: "glucose-converter",
    href: "/tools/glucose-converter",
    icon: ArrowLeftRight,
    title: "Glucose units",
    description: "Convert mmol/L ↔ mg/dL",
  },
  {
    id: "education",
    href: "/education",
    icon: BookOpen,
    title: "Education",
    description: "Plain-language articles and definitions",
  },
  {
    id: "tips",
    href: "/tools/tips",
    icon: Lightbulb,
    title: "Tips",
    description: "Tip of the day plus more",
  },
];

export function communityToolsForHub(): ToolDef[] {
  if (!isAiCoachEnabled) return COMMUNITY_TOOLS;
  const coach: ToolDef = {
    id: "ai-coach",
    href: buildCoachHref({ topic: "community" }),
    icon: MessageCircle,
    title: AI_ASSISTANT_NAME,
    description: "Educational chat about type 1 diabetes",
  };
  return [coach, ...COMMUNITY_TOOLS];
}

/** Shared icon badge — soft tinted circle so tiles read as a single family across the hub. */
function ToolIconBadge({
  icon: Icon,
  size = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  size?: "default" | "large";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] group-hover:bg-primary/15",
        size === "large" ? "h-11 w-11 sm:h-12 sm:w-12" : "h-10 w-10 sm:h-11 sm:w-11",
      )}
      aria-hidden
    >
      <Icon className={size === "large" ? "h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" : "h-5 w-5"} />
    </span>
  );
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
      ? "pressable card-interactive flex h-full min-h-[5.75rem] w-full cursor-pointer flex-col rounded-2xl border-border/40"
      : "pressable card-interactive flex h-full min-h-[6.25rem] w-full cursor-pointer flex-col rounded-2xl border-border/40";
  const pad = layout === "compact" ? "p-4 sm:p-5" : "p-4 sm:p-5";
  return (
    <Link
      href={href}
      className="pressable group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      onClick={() => {
        void hapticLight();
      }}
    >
      <Card variant="glass" className={cardClass}>
        <CardContent className={cn("flex h-full items-center gap-3", pad)}>
          <ToolIconBadge icon={Icon} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-h3 font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronRight
            className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
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
      onClick={() => {
        void hapticLight();
      }}
    >
      <Card variant="glass" className="pressable card-interactive cursor-pointer rounded-2xl border-border/40">
        <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-4">
          <ToolIconBadge icon={Icon} size="large" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-h3 font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronRight
            className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </CardContent>
      </Card>
    </Link>
  );
}

/** Matches the eyebrow label style used on Account (`SettingsGroupLabel`) and the glossary. */
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{title}</h2>
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
  const { communityPushPromptOpen, setCommunityPushPromptOpen } = useCommunityPushPromptAfterOnboarding();
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
      ? ["ai-coach", "cgm-live", "insulin-calculator", "hypo-help", "correction-helper"]
      : ["cgm-live", "insulin-calculator", "hypo-help", "correction-helper"];

  const actNowIds: readonly string[] =
    hubVariant === "carer" || hubVariant === "community"
      ? byId.has("ai-coach")
        ? ["ai-coach", "hypo-help"]
        : ["hypo-help"]
      : patientActNowIds;
  const actNow = actNowIds.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const plan = (["patterns", "hypo-history", "activity-log", "routines", "appointments", "supply-tracker"] as const)
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const learn = (["glucose-converter", "education", "tips", "achievements"] as const)
    .map((id) => byId.get(id))
    .filter(Boolean) as ToolDef[];

  const supporterTools =
    hubVariant === "carer" || hubVariant === "community" ? ([...actNow, ...learn] as ToolDef[]) : [];

  return (
    <PageShell variant="standard" density="compact" className="max-w-5xl pt-0 space-y-6">
      <h1 className="sr-only">Tools</h1>

      <RatiosSetupNotice hidden={hubVariant !== "patient"} testId="tools-ratios-setup-notice" />
      <OfflineDeviceNotice />

      {(hubVariant === "carer" || hubVariant === "community") && supporterTools.length > 0 ? (
        <section
          className="space-y-3 sm:space-y-4"
          aria-label={hubVariant === "community" ? "Community tools" : "Supporter tools"}
          data-testid="tools-section-supporter"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <SectionHeader title={hubVariant === "community" ? "Learn & connect" : "Supporter tools"} />
            </div>
            <ToolsAboutDialog hubVariant={hubVariant} />
          </div>
          <ul className="grid list-none grid-cols-1 gap-3 md:grid-cols-2 md:gap-5" aria-label="Supporter tools">
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
            <section className="space-y-3" aria-label="Act now tools" data-testid="tools-section-act-now">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <HeartPulse className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <SectionHeader title="Act now" />
                </div>
                <ToolsAboutDialog hubVariant={hubVariant} />
              </div>
              <ul
                className="grid list-none grid-cols-1 gap-3 md:grid-cols-2 md:gap-5"
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
            <section className="space-y-3" aria-label="Plan tools" data-testid="tools-section-plan">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <SectionHeader title="Plan" />
              </div>
              <ul
                className="grid list-none grid-cols-1 gap-3 md:grid-cols-2 md:gap-5"
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
            <section className="space-y-3" aria-label="Learn tools" data-testid="tools-section-learn">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <SectionHeader title="Learn" />
              </div>
              <ul className="list-none space-y-3" aria-label="Learn">
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
      {hubVariant === "community" ? (
        <CommunityPushPromptDialog
          open={communityPushPromptOpen}
          onOpenChange={setCommunityPushPromptOpen}
        />
      ) : null}
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
  const { profile } = useProfile();
  const isOffline = useOffline();
  const [, setLocation] = useLocation();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = isCarerSessionMode(hasCarerLink, activeMode);
  const isCommunityMode = isCommunitySessionMode(hasCarerLink, activeMode, {
    localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
    cloudCommunityProfile: profile?.account_type === "community",
  });
  const hubTools = useMemo(() => {
    const raw = isCarerMode
      ? carerToolsForHub()
      : isCommunityMode
        ? communityToolsForHub()
        : patientToolsForHub();
    return filterOfflineCloudTools(raw, isOffline);
  }, [isCarerMode, isCommunityMode, isOffline]);
  const tileCount = hubTools.length;

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
  const hubVariant = isCarerMode ? "carer" : isCommunityMode ? "community" : "patient";
  return <ToolsHubPage tools={hubTools} hubVariant={hubVariant} />;
}
