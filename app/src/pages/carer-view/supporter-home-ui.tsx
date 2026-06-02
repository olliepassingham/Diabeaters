import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  Info,
  MessageCircle,
  Package,
  Phone,
  Plane,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { cn } from "@/lib/utils";

export type CarerGlanceType = "ok" | "info" | "warning";

export function CarerSectionHeading({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-end justify-between gap-3 pt-1">
      <div className="min-w-0 flex items-start gap-2.5">
        {Icon ? (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] ring-1 ring-primary/[0.12]">
            <Icon className="h-4 w-4 text-primary" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle ? <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function PrimaryStatusPill({ type, message }: { type: CarerGlanceType; message: string }) {
  const Icon = type === "warning" ? AlertTriangle : type === "info" ? Info : CheckCircle2;
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        type === "warning" &&
          "border-amber-500/35 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100 dark:border-amber-500/30",
        type === "info" &&
          "border-blue-500/30 bg-blue-500/[0.06] text-foreground dark:border-blue-500/25",
        type === "ok" && "border-emerald-500/30 bg-emerald-500/[0.06] text-foreground dark:border-emerald-500/25",
      )}
      data-testid="carer-primary-status"
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          type === "warning" && "text-amber-600 dark:text-amber-400",
          type === "info" && "text-blue-600 dark:text-blue-400",
          type === "ok" && "text-emerald-600 dark:text-emerald-400",
        )}
        aria-hidden
      />
      <span className="truncate">{message}</span>
    </div>
  );
}

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
            >
              <Phone className="h-4 w-4 text-destructive/80" aria-hidden />
              Emergency
            </a>
          ) : null}
        </div>

        <PrimaryStatusPill type={glance.type} message={glance.message} />

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
  showEmergency,
}: {
  showActivity: boolean;
  showEmergency: boolean;
}) {
  const showCoach = isAiCoachEnabled;
  if (!showCoach && !showActivity && !showEmergency) return null;

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 animate-soft-in"
      style={{ animationDelay: "40ms" }}
      data-testid="carer-quick-actions"
    >
      {showCoach ? (
        <Button
          asChild
          className="min-h-11 rounded-2xl font-semibold tracking-tight col-span-2 sm:col-span-1"
          data-testid="link-carer-coach-open"
        >
          <Link href="/coach?audience=supporter">
            <MessageCircle className="h-4 w-4 mr-2 shrink-0" aria-hidden />
            {openAssistantCtaLabel()}
          </Link>
        </Button>
      ) : null}
      {showActivity ? (
        <Button variant="outline" asChild className="min-h-11 rounded-2xl">
          <Link href="/carer-view/activity">
            <History className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" aria-hidden />
            Activity
          </Link>
        </Button>
      ) : null}
      {showEmergency ? (
        <Button variant="outline" asChild className="min-h-11 rounded-2xl">
          <a href="#carer-emergency">
            <Phone className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" aria-hidden />
            Emergency
          </a>
        </Button>
      ) : null}
    </div>
  );
}

const urgentCardClass =
  "dashboard-card-hover animate-soft-in border border-border/60 shadow-sm overflow-hidden";
const mutedCardClass = "animate-soft-in border-0 shadow-sm";

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
  const accentBorder =
    accent === "rose"
      ? "border-rose-500/25 ring-1 ring-rose-500/10 dark:border-rose-500/20"
      : accent === "amber"
        ? "border-amber-500/25 ring-1 ring-amber-500/10"
        : "border-primary/15 ring-1 ring-border/20";
  return (
    <Card
      id={id}
      variant="glass-strong"
      className={cn(urgentCardClass, accentBorder, id && "scroll-mt-24", className)}
      data-testid={testId}
    >
      {children}
    </Card>
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
    <Card
      id={id}
      variant="glass-muted"
      className={cn(mutedCardClass, id && "scroll-mt-24", className)}
      data-testid={testId}
    >
      {children}
    </Card>
  );
}

export function CarerCardEmpty({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return <EmptyState title={title} description={description} icon={icon} className="py-6" />;
}

export function SupplyStockIndicator({ tone }: { tone: "ok" | "low" | "critical" }) {
  const widthPct = tone === "critical" ? 6 : tone === "low" ? 38 : 82;
  return (
    <div
      className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted/80"
      role="presentation"
      aria-hidden
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "critical" && "bg-destructive",
          tone === "low" && "bg-amber-500",
          tone === "ok" && "bg-emerald-500/80",
        )}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

export function sortSuppliesByUrgency<T extends { id: string }>(
  items: T[],
  toneFor: (item: T) => "ok" | "low" | "critical",
): T[] {
  const rank = (t: "ok" | "low" | "critical") => (t === "critical" ? 0 : t === "low" ? 1 : 2);
  return [...items].sort((a, b) => rank(toneFor(a)) - rank(toneFor(b)));
}

export function CarerHypoTimelineItem({
  bgLabel,
  whenText,
  treatment,
  notes,
}: {
  bgLabel: string;
  whenText: string;
  treatment?: string | null;
  notes?: string | null;
}) {
  return (
    <li className="relative pl-4 border-l-2 border-primary/25 py-0.5">
      <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary/60 ring-2 ring-background" aria-hidden />
      <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-sm space-y-1 dark:bg-background/30">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold tabular-nums">{bgLabel}</span>
          <span className="text-xs text-muted-foreground shrink-0">{whenText}</span>
        </div>
        {treatment ? <p className="text-muted-foreground text-xs">Treatment: {treatment}</p> : null}
        {notes ? <p className="text-muted-foreground text-xs whitespace-pre-wrap">{notes}</p> : null}
      </div>
    </li>
  );
}

export function SupporterPageFooter() {
  return (
    <p className="text-center text-[11px] text-muted-foreground px-4 pb-2" data-testid="carer-trust-footer">
      Shared read-only view · only what they choose to share is visible here.
    </p>
  );
}
