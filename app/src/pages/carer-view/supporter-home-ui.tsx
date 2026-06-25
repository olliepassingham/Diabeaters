import { Link, useLocation } from "wouter";
import { History, MessageCircle, Phone, Plane, Sparkles, Thermometer, User as UserIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { cn } from "@/lib/utils";
import { scrollToCarerViewSection } from "@/pages/carer-view/carer-view-nav";
import { SupporterHypoCheckInButton } from "@/components/supporter-hypo-check-in-section";
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
import { setActiveAppMode } from "@/lib/carer-session";

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
      <CardContent className="flex flex-col gap-2.5 p-4 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-2 ring-background shadow-sm"
              aria-hidden={!avatarUrl}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Sparkles className="h-6 w-6 text-primary" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Supporter mode</p>
              <p
                className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl"
                data-testid="text-carer-view-name"
              >
                Supporting {displayName}
              </p>
            </div>
          </div>
          {showEmergencyLink ? (
            <a
              href="#carer-emergency"
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-destructive/25 bg-destructive/[0.06] px-2.5 text-[11px] font-semibold text-foreground",
                "hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Jump to emergency details"
              onClick={(e) => {
                e.preventDefault();
                scrollToCarerViewSection("carer-emergency");
              }}
            >
              <Phone className="h-3.5 w-3.5 text-destructive" aria-hidden />
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

export function SupporterQuickActions({
  showActivity,
  showUserModeSwitch = false,
  showHypoCheckIn = false,
  patientId,
  patientName,
}: {
  showActivity: boolean;
  showUserModeSwitch?: boolean;
  showHypoCheckIn?: boolean;
  patientId?: string;
  patientName?: string;
}) {
  const [, setLocation] = useLocation();
  const showCoach = isAiCoachEnabled;
  const hasSecondaryRow = showCoach || showActivity;
  if (!hasSecondaryRow && !showUserModeSwitch && !showHypoCheckIn) return null;

  const secondaryGridCols = showCoach && showActivity ? "grid-cols-2" : "grid-cols-1";

  return (
    <div
      className="animate-soft-in space-y-2"
      style={{ animationDelay: "40ms" }}
      data-testid="carer-quick-actions"
    >
      {showHypoCheckIn && patientId ? (
        <SupporterHypoCheckInButton
          patientId={patientId}
          patientName={patientName ?? "them"}
          prominence="primary"
        />
      ) : null}

      {hasSecondaryRow ? (
        <div className={cn("grid gap-2", secondaryGridCols)}>
          {showCoach ? (
            showHypoCheckIn ? (
              <Button
                asChild
                variant="outline"
                className="min-h-10 w-full rounded-xl px-2 text-xs font-medium shadow-none sm:text-sm"
              >
                <Link href="/coach?audience=supporter" data-testid="link-carer-coach-open">
                  <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                  {openAssistantCtaLabel()}
                </Link>
              </Button>
            ) : (
              <div className="coach-entry-glow col-span-full w-full rounded-xl" data-testid="link-carer-coach-open-glow">
                <Button
                  asChild
                  variant="default"
                  className="min-h-10 w-full rounded-xl font-semibold tracking-tight shadow-none"
                >
                  <Link href="/coach?audience=supporter" data-testid="link-carer-coach-open">
                    <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                    {openAssistantCtaLabel()}
                  </Link>
                </Button>
              </div>
            )
          ) : null}
          {showActivity ? (
            <Button
              asChild
              variant="outline"
              className={cn(
                "min-h-10 w-full rounded-xl px-2 text-xs font-medium shadow-none sm:text-sm",
                !showCoach && "col-span-full",
              )}
            >
              <Link href="/carer-view/activity" data-testid="link-carer-activity">
                <History className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                Activity
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {showUserModeSwitch ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground no-underline hover:bg-muted/40 hover:text-foreground active:bg-muted/55"
            data-testid="button-switch-user-mode"
            onClick={() => {
              setActiveAppMode("patient");
              setLocation("/");
            }}
          >
            <UserIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Switch to User Mode
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SupporterPageFooter() {
  return (
    <HomeTrustFooter>Shared read-only view · only what they choose to share is visible here.</HomeTrustFooter>
  );
}
