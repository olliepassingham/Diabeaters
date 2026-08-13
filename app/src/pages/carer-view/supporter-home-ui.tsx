import { Link, useLocation } from "wouter";
import { Check, History, MessageCircle, Phone, Plane, Sparkles, Thermometer, User as UserIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
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
import type { ReactNode } from "react";

/** Compact card chrome for Supporter Mode home — more value above the fold. */
export const carerCardHeaderClass = "space-y-1 p-3.5 pb-1.5 sm:p-4 sm:pb-1.5";
export const carerCardContentClass = "px-3.5 pb-3.5 pt-0 sm:px-4 sm:pb-4";
export const carerCardTitleClass =
  "flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground sm:text-[0.95rem]";
/** Shared shell for appointments/emergency/clinical — not urgent cards (those keep accent borders). */
export const carerCardShellClass =
  "rounded-xl border border-border/50 shadow-sm ring-1 ring-border/15 dark:border-border/40";

export type CarerGlanceType = HomeGlanceType;

export {
  HomeSectionHeading as CarerSectionHeading,
  HomeCardEmpty as CarerCardEmpty,
  HomeHypoTimelineItem as CarerHypoTimelineItem,
  SupplyStockIndicator,
  sortSuppliesByUrgency,
};

export function CarerUrgentCard({
  children,
  className,
  testId,
  id,
  accent = "default",
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
  id?: string;
  accent?: "default" | "rose" | "amber";
}) {
  return (
    <HomeUrgentCard id={id} testId={testId} accent={accent} className={cn("rounded-xl", className)}>
      {children}
    </HomeUrgentCard>
  );
}

export function CarerMutedCard({
  children,
  className,
  testId,
  id,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
  id?: string;
}) {
  return (
    <HomeMutedCard
      id={id}
      testId={testId}
      className={cn(carerCardShellClass, "bg-muted/20 dark:bg-muted/10", className)}
    >
      {children}
    </HomeMutedCard>
  );
}

type LinkedPerson = { patientId: string; label: string; avatarUrl: string | null; active: boolean };

function personFirstName(label: string): string {
  return label.trim().split(/\s+/)[0] || label;
}

function personShortLabel(people: LinkedPerson[], person: LinkedPerson): string {
  const first = personFirstName(person.label);
  const clash = people.filter((p) => personFirstName(p.label) === first).length > 1;
  return clash ? person.label : first;
}

function PersonSwitcherChip({
  person,
  shortLabel,
  onSelect,
}: {
  person: LinkedPerson;
  shortLabel: string;
  onSelect: () => void;
}) {
  const { displayUrl } = useResolvedProfileImageUrl(person.avatarUrl);
  const initial = shortLabel.trim().charAt(0).toUpperCase() || "?";

  return (
    <Button
      type="button"
      role="radio"
      aria-checked={person.active}
      aria-label={person.active ? `Looking at ${person.label}` : `Switch to ${person.label}`}
      variant={person.active ? "default" : "outline"}
      className={cn(
        "h-12 shrink-0 gap-2 rounded-2xl px-3 text-sm font-semibold shadow-none",
        person.active
          ? "border-primary/30 bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          : "border-border/60 bg-background/80 text-foreground",
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl text-xs font-bold",
          person.active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary",
        )}
        aria-hidden
      >
        {displayUrl ? (
          <img src={displayUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>
      {shortLabel}
      {person.active ? <Check className="h-4 w-4 opacity-90" aria-hidden /> : null}
    </Button>
  );
}

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
  const multiPerson = linkedPeople.length > 1;

  return (
    <Card
      variant="glass-strong"
      className={cn(
        carerCardShellClass,
        "dashboard-card-hover animate-soft-in overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent",
      )}
      data-testid="carer-view-header"
    >
      <CardContent className="flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-2 ring-background shadow-sm sm:h-14 sm:w-14"
            aria-hidden={!avatarUrl}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {multiPerson ? `Supporter mode · ${linkedPeople.length} people` : "Supporter mode"}
            </p>
            <p
              className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground text-balance sm:text-xl"
              data-testid="text-carer-view-name"
            >
              Supporting {displayName}
            </p>
          </div>
          {showEmergencyLink ? (
            <a
              href="#carer-emergency"
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/[0.06] text-destructive",
                "hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "sm:h-9 sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-2.5 sm:text-xs sm:font-semibold sm:text-foreground",
              )}
              aria-label="Jump to emergency details"
              onClick={(e) => {
                e.preventDefault();
                scrollToCarerViewSection("carer-emergency");
              }}
            >
              <Phone className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Emergency</span>
            </a>
          ) : null}
        </div>

        {multiPerson ? (
          <div className="space-y-1.5" data-testid="carer-hero-people-switcher">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Looking at
            </p>
            <div
              className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="radiogroup"
              aria-label="Person you are looking at"
            >
              {linkedPeople.map((p) => (
                <PersonSwitcherChip
                  key={p.patientId}
                  person={p}
                  shortLabel={personShortLabel(linkedPeople, p)}
                  onSelect={() => {
                    if (!p.active) onPatientChange(p.patientId);
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <HomePrimaryStatusPill type={glance.type} message={glance.message} testId="carer-primary-status" />

        {(showSickChip || showTravelChip) && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="wrap-carer-active-chips">
            {showSickChip ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.1] dark:bg-amber-950/30 dark:hover:bg-amber-950/45"
              >
                <a href="#carer-sick-day-care" data-testid="chip-carer-sickday">
                  <Thermometer className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" aria-hidden />
                  Sick day
                </a>
              </Button>
            ) : null}
            {showTravelChip ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs border-blue-500/30 bg-blue-500/[0.06] hover:bg-blue-500/[0.1] dark:bg-blue-950/30 dark:hover:bg-blue-950/45"
              >
                <a href="#carer-scenarios" data-testid="chip-carer-travel">
                  <Plane className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400" aria-hidden />
                  {travelLabel}
                </a>
              </Button>
            ) : null}
          </div>
        )}
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
  const secondaryCount = [showCoach, showActivity].filter(Boolean).length;
  const hasSecondaryRow = secondaryCount > 0;
  if (!hasSecondaryRow && !showUserModeSwitch && !showHypoCheckIn) return null;

  const secondaryGridCols = secondaryCount === 2 ? "grid-cols-2" : "grid-cols-1";

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
                secondaryCount === 1 && "col-span-full",
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
    <HomeTrustFooter>Read-only · only what they share · not medical advice</HomeTrustFooter>
  );
}
