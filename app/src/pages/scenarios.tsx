import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Moon, Thermometer, Plane, Dumbbell, Syringe, Wine, Car } from "lucide-react";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { storage } from "@/lib/storage";
import { PageHeader, PageShell } from "@/components/layout";

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
    title: "Sick Day",
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

function ScenarioCard({ href, icon: Icon, title, description }: ScenarioCardDef) {
  return (
    <Link
      href={href}
      className="pressable block h-full min-w-0 w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        variant="glass"
        className="pressable card-interactive flex h-full min-h-[7.25rem] w-full cursor-pointer flex-col gap-3 rounded-2xl px-5 py-5 sm:min-h-[7.75rem] sm:px-6 sm:py-6"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <Icon className="mt-0.5 h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" aria-hidden />
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

  useEffect(() => {
    trackFeatureEngagement("scenarios");
  }, []);

  const [showPumpFailureCard, setShowPumpFailureCard] = useState(false);
  useEffect(() => {
    const profile = storage.getProfile();
    setShowPumpFailureCard(profile?.insulinDeliveryMethod === "pump");
  }, [location]);

  useEffect(() => {
    if (location !== "/scenarios") return;
    const tab = new URLSearchParams(search).get("tab");
    if (tab === "bedtime") setLocation("/scenarios/bedtime");
    else if (tab === "sick-day" || tab === "sickday") setLocation("/scenarios/sick-day");
    else if (tab === "travel") setLocation("/scenarios/travel");
  }, [location, search, setLocation]);

  return (
    <PageShell variant="standard" className="space-y-8">
      <PageHeader
        title="Scenarios"
        description="One situation at a time — pick what matches yours."
        actions={
          <PageInfoDialog title="About Scenarios" description="Special situation guidance for diabetes management">
            <InfoSection title="Exercise">
              <p>Open structured exercise planning with carbs, checks, and bolus tips — moved here from Tools.</p>
            </InfoSection>
            <InfoSection title="Bedtime Check">
              <p>A calm evening check to help you feel confident going to sleep.</p>
            </InfoSection>
            <InfoSection title="Sick Day Mode">
              <p>When you&apos;re unwell, diabetes management changes. Activate sick day mode for adjusted guidance. Past sick day sessions are listed at the bottom of the Sick Day page.</p>
            </InfoSection>
            <InfoSection title="Travel & pump backup">
              <p>Travel mode includes backup insulin planning if a pump fails or you are away from home. Past trips are listed at the bottom of the Travel page.</p>
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
        }
      />

      <div className="mt-2 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {SCENARIO_CARDS.map((c, idx) => (
          <div key={c.href} className="animate-soft-in" style={{ animationDelay: `${idx * 45}ms` }}>
            <ScenarioCard {...c} />
          </div>
        ))}
        {showPumpFailureCard ? (
          <div
            className="animate-soft-in"
            style={{ animationDelay: `${SCENARIO_CARDS.length * 45}ms` }}
          >
            <ScenarioCard
              href="/scenarios/pump-failure"
              icon={Syringe}
              title="Pump failure"
              description="If delivery stops: clear steps and what to keep nearby."
            />
          </div>
        ) : null}
      </div>

    </PageShell>
  );
}
