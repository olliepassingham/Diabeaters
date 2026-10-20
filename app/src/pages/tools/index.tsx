import { useEffect, useMemo, useState } from "react";
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
  MessageCircle,
  ScrollText,
  Sparkles,
  Users,
  Activity,
  LineChart,
  ArrowLeftRight,
  History,
  Car,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { HubListPanel, HubListRow, type HubListAccent, type HubListTone } from "@/components/hub-list-panel";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode, hasCarerIntent, hasPendingCarer, isCarerSessionMode, isCommunitySessionMode } from "@/lib/carer-session";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { useProfile } from "@/lib/profile";
import { PageHeader, PageShell } from "@/components/layout";
import { HubLoadingSkeleton } from "@/components/empty-state";
import { CommunityPushPromptDialog } from "@/components/community-push-prompt-dialog";
import { useCommunityPushPromptAfterOnboarding } from "@/hooks/use-community-push-prompt-after-onboarding";
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
import { hasInsulinClinicalTools, isType2AppSession } from "@/lib/insulin-clinical-access";
import { ensureLocalType2Profile } from "@/lib/type2-session";
import { canShowDrivingReadiness } from "@/lib/user-age";
import { hapticLight } from "@/lib/haptics";

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

/** Insulin / Type 1 clinical tiles never shown on the Type 2 tools hub. */
const TYPE2_HIDDEN_TOOL_IDS = new Set([
  "insulin-calculator",
  "correction-helper",
  "cgm-live",
  "patterns",
  "hypo-history",
  "routines",
  "education",
  "achievements",
  "activity-log",
]);

const TYPE2_CARE_IDS = ["supply-tracker", "appointments", "help-now", "ai-coach"] as const;
const TYPE2_HELPER_IDS = ["glucose-converter", "tips"] as const;

export function type2ToolsForHub(): ToolDef[] {
  ensureLocalType2Profile(storage.getProfile());
  const byId = new Map(PATIENT_TOOLS.map((t) => [t.id, t] as const));
  byId.set("help-now", {
    id: "help-now",
    href: "/help-now",
    icon: Droplet,
    title: "Emergency details",
    description: "Help Now card for bystanders",
  });
  const coach: ToolDef | undefined = isAiCoachEnabled
    ? {
        id: "ai-coach",
        href: buildCoachHref({ topic: "community" }),
        icon: MessageCircle,
        title: AI_ASSISTANT_NAME,
        description: "Educational chat — not personal dosing advice",
      }
    : undefined;
  if (coach) byId.set("ai-coach", coach);
  const supply = byId.get("supply-tracker");
  if (supply) {
    byId.set("supply-tracker", {
      ...supply,
      description: "Stock levels and days left",
    });
  }
  const ordered = [...TYPE2_CARE_IDS, ...TYPE2_HELPER_IDS];
  return ordered.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];
}

function patientToolsForHub(): ToolDef[] {
  const profile = storage.getProfile();
  if (isType2AppSession(profile)) return type2ToolsForHub();
  const insulinTools = hasInsulinClinicalTools(profile);
  const coach: ToolDef | undefined = isAiCoachEnabled
    ? {
        id: "ai-coach",
        href: "/coach",
        icon: MessageCircle,
        title: AI_ASSISTANT_NAME,
        description: insulinTools
          ? "Educational chat about type 1 diabetes"
          : "Educational chat about diabetes — not personal dosing advice",
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
  const baseTools = insulinTools
    ? PATIENT_TOOLS
    : PATIENT_TOOLS.filter((t) => !TYPE2_HIDDEN_TOOL_IDS.has(t.id));
  const tools = coach ? [coach, ...baseTools] : [...baseTools];
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

function ToolRows({
  tools,
  tone,
  accent,
}: {
  tools: ToolDef[];
  tone: HubListTone;
  accent: HubListAccent;
}) {
  return tools.map((tool) => (
    <HubListRow
      key={tool.id}
      href={tool.href}
      icon={tool.icon}
      title={tool.title}
      description={tool.description}
      tone={tone}
      accent={accent}
      onWarm={() => prefetchToolsDestinationHref(tool.href)}
      onPress={() => {
        void hapticLight();
      }}
    />
  ));
}

/** Matches the eyebrow label style used on Account (`SettingsGroupLabel`) and the glossary. */
type ToolsHubSection = "act-now" | "plan" | "learn";

const TOOLS_HUB_SECTIONS: { id: ToolsHubSection; label: string }[] = [
  { id: "act-now", label: "Act now" },
  { id: "plan", label: "Plan" },
  { id: "learn", label: "Learn" },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{title}</h2>
  );
}

function Type2ToolsHub({
  careTools,
  helperTools,
  about,
  query = "",
}: {
  careTools: ToolDef[];
  helperTools: ToolDef[];
  about: React.ReactNode;
  query?: string;
}) {
  const dob = storage.getProfile()?.dateOfBirth;
  const situationTools: ToolDef[] = [];
  // Alcohol stays Type 1–only (bolus / ratio flow). Driving is safe for Type 2.
  if (canShowDrivingReadiness(dob)) {
    situationTools.push({
      id: "driving",
      href: "/scenarios/driving",
      icon: Car,
      title: "Driving",
      description: "A short readiness check before you go",
    });
  }
  const visibleSituationTools = situationTools.filter(
    (tool) => !query || `${tool.title} ${tool.description}`.toLowerCase().includes(query),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl border border-border/50 bg-muted/15 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Type 2 tools</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Supplies, appointments, emergency details, and a driving check — no insulin dosing.
          </p>
        </div>
        {about}
      </div>
      {careTools.length > 0 ? (
        <section className="space-y-3" data-testid="tools-section-type2-care">
          <SectionHeader title="Care kit" />
          <HubListPanel label="Care kit">
            <ToolRows tools={careTools} tone="accent" accent="teal" />
          </HubListPanel>
        </section>
      ) : null}
      {visibleSituationTools.length > 0 ? (
        <section className="space-y-3" data-testid="tools-section-type2-situations">
          <SectionHeader title="Situation guides" />
          <HubListPanel label="Situation guides">
            <ToolRows tools={visibleSituationTools} tone="guide" accent="teal" />
          </HubListPanel>
        </section>
      ) : null}
      {helperTools.length > 0 ? (
        <section className="space-y-3" data-testid="tools-section-type2-helpers">
          <SectionHeader title="Helpers" />
          <HubListPanel label="Helpers">
            <ToolRows tools={helperTools} tone="quiet" accent="gold" />
          </HubListPanel>
        </section>
      ) : null}
    </div>
  );
}

function ToolsAboutDialog({ hubVariant }: { hubVariant: "patient" | "type2" | "carer" | "community" }) {
  return (
    <PageInfoDialog
      title="About Tools"
      description="Calculators, tracking, and learning resources. Educational only — always follow your care team’s advice."
    >
      {hubVariant === "type2" ? (
        <InfoSection title="Type 2 tools">
          <p>
            Supplies, appointments, emergency details, and a driving readiness check — without insulin dosing or ratios.
            Educational only.
          </p>
        </InfoSection>
      ) : hubVariant === "carer" || hubVariant === "community" ? (
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
  hubVariant?: "patient" | "type2" | "carer" | "community";
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

  const type2Care = TYPE2_CARE_IDS.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];
  const type2Helpers = TYPE2_HELPER_IDS.map((id) => byId.get(id)).filter(Boolean) as ToolDef[];

  const supporterTools =
    hubVariant === "carer" || hubVariant === "community" ? ([...actNow, ...learn] as ToolDef[]) : [];

  const [toolsQuery, setToolsQuery] = useState("");
  const normalizedQuery = toolsQuery.trim().toLowerCase();
  const matchesTool = (tool: ToolDef) =>
    !normalizedQuery || `${tool.title} ${tool.description}`.toLowerCase().includes(normalizedQuery);

  const patientSectionTools: { id: ToolsHubSection; label: string; tools: ToolDef[]; tone: HubListTone; accent: HubListAccent }[] =
    TOOLS_HUB_SECTIONS.map((section) => ({
      ...section,
      tools: (section.id === "act-now" ? actNow : section.id === "plan" ? plan : learn).filter(matchesTool),
      tone: section.id === "act-now" ? ("accent" as HubListTone) : ("quiet" as HubListTone),
      accent: (section.id === "plan" ? "sky" : section.id === "learn" ? "gold" : "teal") as HubListAccent,
    })).filter((section) => section.tools.length > 0);

  const filteredSupporterTools = supporterTools.filter(matchesTool);
  const filteredType2Care = type2Care.filter(matchesTool);
  const filteredType2Helpers = type2Helpers.filter(matchesTool);
  const noPatientMatches = hubVariant === "patient" && patientSectionTools.length === 0;

  return (
    <PageShell
      variant="standard"
      density="compact"
      className="max-w-5xl pt-0 space-y-6"
      data-testid={hubVariant === "type2" ? "tools-type2" : undefined}
    >
      <h1 className="sr-only">{hubVariant === "type2" ? "Type 2 tools" : "Tools"}</h1>

      <RatiosSetupNotice hidden={hubVariant !== "patient"} testId="tools-ratios-setup-notice" />
      <OfflineDeviceNotice />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={toolsQuery}
            onChange={(event) => setToolsQuery(event.target.value)}
            placeholder="Search tools"
            className="h-11 rounded-full pl-9"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label="Search tools"
            data-testid="input-tools-search"
          />
        </div>
        {hubVariant === "patient" ? <ToolsAboutDialog hubVariant={hubVariant} /> : null}
      </div>

      {hubVariant === "type2" ? (
        <Type2ToolsHub
          careTools={filteredType2Care}
          helperTools={filteredType2Helpers}
          about={<ToolsAboutDialog hubVariant="type2" />}
          query={normalizedQuery}
        />
      ) : (hubVariant === "carer" || hubVariant === "community") && filteredSupporterTools.length > 0 ? (
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
          <HubListPanel label="Supporter tools">
            <ToolRows tools={filteredSupporterTools} tone="accent" accent="teal" />
          </HubListPanel>
        </section>
      ) : hubVariant === "patient" ? (
        <div className="space-y-6">
          {patientSectionTools.map((section) => (
            <section
              key={section.id}
              aria-label={`${section.label} tools`}
              data-testid={`tools-section-${section.id}`}
              className="space-y-2.5"
            >
              <SectionHeader title={section.label} />
              <HubListPanel label={section.label}>
                <ToolRows tools={section.tools} tone={section.tone} accent={section.accent} />
              </HubListPanel>
            </section>
          ))}
          {noPatientMatches ? (
            <p className="py-4 text-center text-sm text-muted-foreground" data-testid="tools-search-empty">
              No tool matches “{toolsQuery.trim()}”. Try a shorter word.
            </p>
          ) : null}
        </div>
      ) : null}
      {(hubVariant === "carer" || hubVariant === "community") && normalizedQuery && filteredSupporterTools.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground" data-testid="tools-search-empty">
          No tool matches “{toolsQuery.trim()}”. Try a shorter word.
        </p>
      ) : null}
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
      setLocation("/community/setup");
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
  const hubVariant = isCarerMode
    ? "carer"
    : isCommunityMode
      ? "community"
      : isType2AppSession(storage.getProfile())
        ? "type2"
        : "patient";
  return <ToolsHubPage tools={hubTools} hubVariant={hubVariant} />;
}
