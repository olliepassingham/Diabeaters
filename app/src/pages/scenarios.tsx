import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Moon, Thermometer, Plane, Dumbbell, Syringe, Wine, Car } from "lucide-react";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { storage, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { pumpSetupCompletion } from "@/lib/pump-supplies";
import { canShowAlcoholScenarios, canShowDrivingReadiness } from "@/lib/user-age";
import { PageShell } from "@/components/layout";
import { DobUnknownNotice } from "@/components/dob-unknown-notice";

type ScenarioCardDef = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

const SCENARIO_CARDS: ScenarioCardDef[] = [
  {
    href: "/scenarios/exercise",
    icon: Dumbbell,
    title: "Exercise",
    description: "Plan your session and glucose-friendly fueling.",
  },
  {
    href: "/scenarios/bedtime",
    icon: Moon,
    title: "Bedtime",
    description: "A quick evening check so you can wind down.",
  },
  {
    href: "/scenarios/sick-day",
    icon: Thermometer,
    title: "Sick day",
    description: "Track symptoms, ketones, and when to escalate.",
  },
  {
    href: "/scenarios/travel",
    icon: Plane,
    title: "Travel",
    description: "Packing lists and backup planning for trips.",
  },
  {
    href: "/scenarios/alcohol",
    icon: Wine,
    title: "Alcohol",
    description: "Prep, carb estimates, and when to get help.",
  },
  {
    href: "/scenarios/driving",
    icon: Car,
    title: "Driving",
    description: "A short readiness check before you head out.",
  },
];

function scenarioCardsForProfile(dateOfBirth: string | undefined): ScenarioCardDef[] {
  return SCENARIO_CARDS.filter((c) => {
    if (c.href === "/scenarios/alcohol" && !canShowAlcoholScenarios(dateOfBirth)) return false;
    if (c.href === "/scenarios/driving" && !canShowDrivingReadiness(dateOfBirth)) return false;
    return true;
  });
}

function ScenarioCard({ href, icon: Icon, title, description }: ScenarioCardDef) {
  return (
    <Link
      href={href}
      className="group pressable block h-full min-w-0 w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        variant="glass"
        className="pressable card-interactive flex h-full min-h-[7.25rem] w-full cursor-pointer flex-col gap-3 rounded-2xl px-5 py-5 ring-1 ring-inset ring-transparent transition-[ring-color,background-color] duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] sm:min-h-[7.75rem] sm:px-6 sm:py-6 group-hover:bg-muted/15 group-hover:ring-primary/15 dark:group-hover:ring-primary/25"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <Icon
            className="mt-0.5 h-7 w-7 shrink-0 origin-top-left text-primary transition-transform duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] group-hover:scale-105 sm:h-8 sm:w-8"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-h3 font-semibold text-foreground">{title}</h3>
            <p className="text-small mt-1.5 leading-relaxed text-muted-foreground sm:text-[0.9375rem]">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Scenarios() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [visibleScenarioCards, setVisibleScenarioCards] = useState<ScenarioCardDef[]>(() =>
    scenarioCardsForProfile(storage.getProfile()?.dateOfBirth),
  );

  useEffect(() => {
    trackFeatureEngagement("scenarios");
  }, []);

  const [showPumpFailureCard, setShowPumpFailureCard] = useState(false);
  const [pumpFailureCardDescription, setPumpFailureCardDescription] = useState(
    "If delivery stops: timers, backup links, and clear steps.",
  );
  useEffect(() => {
    const profile = storage.getProfile();
    setShowPumpFailureCard(isPumpDeliveryMethod(profile?.insulinDeliveryMethod));
    setVisibleScenarioCards(scenarioCardsForProfile(profile?.dateOfBirth));
    const pumpReady = pumpSetupCompletion(profile, storage.getSupplies()).tracksBackup;
    setPumpFailureCardDescription(
      pumpReady
        ? "If delivery stops: timers, backup links, and clear steps."
        : "Set up backup pens in Supplies before you need them — then use this guide if delivery stops.",
    );
  }, [location]);

  useEffect(() => {
    const onProfile = () => {
      const profile = storage.getProfile();
      setShowPumpFailureCard(isPumpDeliveryMethod(profile?.insulinDeliveryMethod));
      setVisibleScenarioCards(scenarioCardsForProfile(profile?.dateOfBirth));
      const pumpReady = pumpSetupCompletion(profile, storage.getSupplies()).tracksBackup;
      setPumpFailureCardDescription(
        pumpReady
          ? "If delivery stops: timers, backup links, and clear steps."
          : "Set up backup pens in Supplies before you need them — then use this guide if delivery stops.",
      );
    };
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  useEffect(() => {
    if (location !== "/scenarios") return;
    const tab = new URLSearchParams(search).get("tab");
    if (tab === "bedtime") setLocation("/scenarios/bedtime");
    else if (tab === "sick-day" || tab === "sickday") setLocation("/scenarios/sick-day");
    else if (tab === "travel") setLocation("/scenarios/travel");
  }, [location, search, setLocation]);

  const guidesAboutDialog = (
    <PageInfoDialog
      compact
      title="About situation guides"
      description="Step-by-step help for specific moments — not a substitute for your clinic."
    >
      <InfoSection title="Exercise">
        <p>Open structured exercise planning with carbs, checks, and bolus tips — moved here from Tools.</p>
      </InfoSection>
      <InfoSection title="Bedtime Check">
        <p>A calm evening check to help you feel confident going to sleep.</p>
      </InfoSection>
      <InfoSection title="Sick day mode">
        <p>When you&apos;re unwell, diabetes management changes. Activate sick day mode for adjusted guidance. Past sick day sessions are listed at the bottom of the Sick day page.</p>
      </InfoSection>
      <InfoSection title="Travel & pump backup">
        <p>Travel mode includes backup insulin planning if a pump fails or you are away from home. Past trips are listed at the bottom of the Travel page.</p>
      </InfoSection>
      <InfoSection title="Pump failure">
        <p>
          For pump users: triage what went wrong, surface your backup contacts and supplies, ketone-aware escalation banners,
          timed recheck reminders, and a log while active mode is on.
        </p>
      </InfoSection>
      <InfoSection title="Alcohol">
        <p>
          Pick a situation for meal carb estimates using your saved ratios (same math as Meal Adviser), short prep
          checklists, and red-flag routing to help. This is not medical advice — alcohol changes overnight risk;
          always follow your clinic&apos;s plan.
        </p>
      </InfoSection>
      <InfoSection title="Driving">
        <p>
          Answer a few quick questions for a readiness recommendation. This is not legal or medical advice and
          does not replace local licensing rules or your clinic&apos;s plan.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );

  return (
    <PageShell variant="standard" density="compact" className="space-y-4 pt-0">
      <h1 className="sr-only">Guides</h1>

      <DobUnknownNotice testId="guides-dob-unknown-notice" />

      <div className="grid w-full grid-cols-1 gap-y-3 gap-x-5 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
        <div className="col-span-1 flex h-9 items-center justify-end md:col-span-2">{guidesAboutDialog}</div>
        {visibleScenarioCards.map((c, idx) => (
          <div key={c.href} className="animate-soft-in" style={{ animationDelay: `${idx * 45}ms` }}>
            <ScenarioCard {...c} />
          </div>
        ))}
        {showPumpFailureCard ? (
          <div
            className="animate-soft-in"
            style={{ animationDelay: `${visibleScenarioCards.length * 45}ms` }}
          >
            <ScenarioCard
              href="/scenarios/pump-failure"
              icon={Syringe}
              title="Pump failure"
              description={pumpFailureCardDescription}
            />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
