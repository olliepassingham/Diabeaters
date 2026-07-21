import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Moon, Thermometer, Plane, Dumbbell, Syringe, Wine, Car, ChevronRight } from "lucide-react";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { storage, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { pumpSetupCompletion } from "@/lib/pump-supplies";
import { canShowAlcoholScenarios, canShowDrivingReadiness } from "@/lib/user-age";
import { PageShell } from "@/components/layout";
import { OfflineDeviceNotice } from "@/components/offline-device-notice";
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
    description: "Pre-workout fuel and insulin planning",
  },
  {
    href: "/scenarios/bedtime",
    icon: Moon,
    title: "Bedtime",
    description: "Evening readiness and correction check",
  },
  {
    href: "/scenarios/sick-day",
    icon: Thermometer,
    title: "Sick day",
    description: "Illness-adjusted dose guidance and logs",
  },
  {
    href: "/scenarios/travel",
    icon: Plane,
    title: "Travel",
    description: "Trip checklist and timezone tips",
  },
  {
    href: "/scenarios/alcohol",
    icon: Wine,
    title: "Alcohol",
    description: "Situation prep and delayed-low awareness",
  },
  {
    href: "/scenarios/driving",
    icon: Car,
    title: "Driving",
    description: "Readiness from glucose and trend",
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
        className="pressable card-interactive flex h-full min-h-[5.5rem] w-full cursor-pointer flex-col rounded-2xl px-5 py-4 sm:min-h-[6rem] sm:px-6 sm:py-5"
      >
        <div className="flex h-full items-center gap-3 sm:gap-4">
          <Icon className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-h3 font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
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
    "Triage steps if delivery stops",
  );
  useEffect(() => {
    const profile = storage.getProfile();
    setShowPumpFailureCard(isPumpDeliveryMethod(profile?.insulinDeliveryMethod));
    setVisibleScenarioCards(scenarioCardsForProfile(profile?.dateOfBirth));
    const pumpReady = pumpSetupCompletion(profile, storage.getSupplies()).tracksBackup;
    setPumpFailureCardDescription(
      pumpReady ? "Triage steps if delivery stops" : "Set up backup pens first",
    );
  }, [location]);

  useEffect(() => {
    const onProfile = () => {
      const profile = storage.getProfile();
      setShowPumpFailureCard(isPumpDeliveryMethod(profile?.insulinDeliveryMethod));
      setVisibleScenarioCards(scenarioCardsForProfile(profile?.dateOfBirth));
      const pumpReady = pumpSetupCompletion(profile, storage.getSupplies()).tracksBackup;
      setPumpFailureCardDescription(
        pumpReady ? "Triage steps if delivery stops" : "Set up backup pens first",
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
      title="About situation guides"
      description="Step-by-step help for specific moments — not a substitute for your clinic."
      triggerVariant="link"
      linkLabel="About situation guides"
    >
      <InfoSection title="Exercise">
        <p>
          Plan pre-workout fuel and insulin using your ratios and targets, with session carry carbs and an optional active
          workout timer. When Apple Health or Dexcom Share is connected in Settings → CGM, recent BG and trend can prefill
          on the exercise flow and status strip.
        </p>
      </InfoSection>
      <InfoSection title="Bedtime">
        <p>
          Enter glucose, trend, food, insulin, and sleep timing for a steady, monitor, or alert result. You may see a
          suggested correction or bedtime snack, with warnings for IOB, exercise, alcohol, or sick day. Saves to your log
          and can set up evening reminders.
        </p>
      </InfoSection>
      <InfoSection title="Sick day">
        <p>
          Turn on sick day mode for illness-adjusted correction guidance. Log readings, ketones, symptoms, temperature,
          and medications; get ketone escalation alerts and optional med reminders. Linked supporters can be notified
          when a session starts. Past sessions are listed at the bottom of the Sick day page.
        </p>
      </InfoSection>
      <InfoSection title="Travel">
        <p>
          Plan destination and dates, then work through a packing checklist built from your supplies. Get timezone and
          basal tips for longer trips. While travel mode is active, the app surfaces guidance and reminders until you
          mark the trip complete. Past trips stay in your history.
        </p>
      </InfoSection>
      <InfoSection title="Pump failure">
        <p>
          For pump users when delivery stops. Start active mode for timed glucose and ketone recheck reminders, a triage
          checklist, ketone-aware escalation banners, and links to backup pens and emergency contacts from Supplies and
          settings.
        </p>
      </InfoSection>
      <InfoSection title="Alcohol">
        <p>
          Choose a situation, estimate meal carbs from your saved ratios, and see tips on delayed overnight lows,
          including pump IOB cautions. For adults only — educational guidance, not medical advice. Always follow your
          clinic&apos;s plan for drinking.
        </p>
      </InfoSection>
      <InfoSection title="Driving">
        <p>
          A short wizard on current glucose, trend, time since your last check, and recent hypos gives a ready, wait, or
          check-again suggestion. With CGM connected, Diabeaters can offer your latest reading and arrow trend. For adults
          only — does not confirm you are legally fit to drive. Follow licensing rules and your care team.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );

  return (
    <PageShell variant="standard" density="compact" className="space-y-3 pt-0">
      <h1 className="sr-only">Guides</h1>

      <DobUnknownNotice testId="guides-dob-unknown-notice" />
      <OfflineDeviceNotice />

      <div className="grid w-full grid-cols-1 gap-y-3 gap-x-5 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
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

      <p className="pt-1 text-center">{guidesAboutDialog}</p>
    </PageShell>
  );
}
