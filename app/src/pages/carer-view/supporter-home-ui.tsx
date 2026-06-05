import { Link } from "wouter";
import { Phone, Plane, Sparkles, Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { cn } from "@/lib/utils";
import { scrollToCarerViewSection } from "@/pages/carer-view/carer-view-nav";
import {
  HomeCardEmpty,
  HomeHypoTimelineItem,
  HomeMutedCard,
  HomePrimaryStatusPill,
  HomeSectionHeading,
  HomeTrustFooter,
  HomeUrgentCard,
  SupplyStockIndicator,
  sortSuppliesByUrgency,
  type HomeGlanceType,
} from "@/components/home/home-ui";
import { History, MessageCircle } from "lucide-react";

export type CarerGlanceType = HomeGlanceType;

export {
  HomeSectionHeading as CarerSectionHeading,
  HomeCardEmpty as CarerCardEmpty,
  HomeHypoTimelineItem as CarerHypoTimelineItem,
  HomeMutedCard as CarerMutedCard,
  HomeUrgentCard as CarerUrgentCard,
  SupplyStockIndicator,
  sortSuppliesByUrgency,
};

type LinkedPerson = { patientId: string; label: string; active: boolean };

export function SupporterHero({
  displayName,
  avatarUrl,
  glance,
  showEmergencyLink,
  showSickChip,
  showTravelChip,
  travelLabel,
  linkedPeople,
  onPatientChange,
}: {
  displayName: string;
  avatarUrl: string | null;
  glance: { type: CarerGlanceType; message: string };
  showEmergencyLink: boolean;
  showSickChip: boolean;
  showTravelChip: boolean;
  travelLabel: string;
  linkedPeople: LinkedPerson[];
  onPatientChange: (patientId: string) => void;
}) {
  return (
    <Card
      variant="glass-strong"
      className="dashboard-card-hover animate-soft-in overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent shadow-md ring-1 ring-border/25 dark:border-primary/18 dark:from-primary/[0.09]"
      data-testid="carer-view-header"
    >
      <CardContent className="p-4 md:p-5 flex flex-col gap-3 md:gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-background shadow-sm"
              aria-hidden={!avatarUrl}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Sparkles className="h-7 w-7 text-primary" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Supporter mode</p>
              <p
                className="font-display text-xl font-semibold tracking-tight text-foreground truncate sm:text-2xl"
                data-testid="text-carer-view-name"
              >
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Read-only · they control what you see</p>
            </div>
          </div>
          {showEmergencyLink ? (
            <a
              href="#carer-emergency"
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3.5 text-xs font-semibold text-foreground shadow-sm",
                "hover:bg-background hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Jump to emergency details"
              onClick={(e) => {
                e.preventDefault();
                scrollToCarerViewSection("carer-emergency");
              }}
            >
              <Phone className="h-4 w-4 text-destructive/80" aria-hidden />
              Emergency
            </a>
          ) : null}
        </div>

        <HomePrimaryStatusPill type={glance.type} message={glance.message} testId="carer-primary-status" />

        {(showSickChip || showTravelChip) && (
          <div className="flex flex-wrap items-center gap-2" data-testid="wrap-carer-active-chips">
            {showSickChip ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.1]"
              >
                <a href="#carer-sick-day-care" data-testid="chip-carer-sickday">
                  <Thermometer className="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" aria-hidden />
                  Sick day
                </a>
              </Button>
            ) : null}
            {showTravelChip ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs border-blue-500/30 bg-blue-500/[0.06] hover:bg-blue-500/[0.1]"
              >
                <a href="#carer-scenarios" data-testid="chip-carer-travel">
                  <Plane className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" aria-hidden />
                  {travelLabel}
                </a>
              </Button>
            ) : null}
          </div>
        )}

        {linkedPeople.length > 1 ? (
          <div className="flex flex-wrap gap-2 pt-0.5" data-testid="carer-hero-people-switcher">
            {linkedPeople.map((p) => (
              <Button
                key={p.patientId}
                type="button"
                size="sm"
                variant={p.active ? "secondary" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => !p.active && onPatientChange(p.patientId)}
                disabled={p.active}
              >
                {p.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SupporterQuickActions({ showActivity }: { showActivity: boolean }) {
  const showCoach = isAiCoachEnabled;
  if (!showCoach && !showActivity) return null;

  return (
    <div
      className="flex flex-col gap-2 sm:gap-3 animate-soft-in"
      style={{ animationDelay: "40ms" }}
      data-testid="carer-quick-actions"
    >
      {showCoach ? (
        <div className="coach-entry-glow w-full rounded-2xl" data-testid="link-carer-coach-open-glow">
          <Button
            asChild
            variant="default"
            className="min-h-11 w-full rounded-2xl font-semibold tracking-tight shadow-none"
          >
            <Link href="/coach?audience=supporter" data-testid="link-carer-coach-open">
              <MessageCircle className="h-4 w-4 mr-2 shrink-0" aria-hidden />
              {openAssistantCtaLabel()}
            </Link>
          </Button>
        </div>
      ) : null}
      {showActivity ? (
        <Button asChild variant="outline" className="min-h-11 w-full rounded-2xl shadow-none">
          <Link href="/carer-view/activity" data-testid="link-carer-activity">
            <History className="h-4 w-4 mr-2 shrink-0" aria-hidden />
            Activity log
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function SupporterPageFooter() {
  return (
    <HomeTrustFooter>Shared read-only view · only what they choose to share is visible here.</HomeTrustFooter>
  );
}
