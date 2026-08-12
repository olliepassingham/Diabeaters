import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

/** Shared surface for home dashboard cards (hero, setup, widgets). */
export const homeDashboardCardClass =
  "dashboard-card-hover animate-soft-in overflow-hidden rounded-[1.35rem] border border-primary/18 bg-gradient-to-br from-primary-light/80 via-primary-light/45 to-primary/[0.08] shadow-none dark:border-primary/24 dark:from-primary-light/30 dark:via-primary-light/15 dark:to-primary/[0.08]";

/** Warm setup / onboarding card tint — single hairline, no ring+glow stack. */
export const homeSetupCardClass =
  "dashboard-card-hover animate-soft-in overflow-hidden rounded-[1.35rem] border border-amber-400/40 bg-gradient-to-br from-amber-50/90 via-amber-100/45 to-primary-light/55 shadow-none dark:border-amber-500/30 dark:from-amber-950/35 dark:via-amber-950/18 dark:to-primary-light/10";

/** Compact metadata pill used for dates, counts, and setup progress. */
export function HomeMetaBadge({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <span
      className={cn(
        "chip shrink-0 border-primary/20 bg-primary-light/50 text-[11px] font-semibold tabular-nums text-foreground dark:bg-primary-light/20",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </span>
  );
}

export type HomeGlanceType = "ok" | "info" | "warning";

export function HomeSectionHeading({
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

export function HomePrimaryStatusPill({
  type,
  message,
  testId = "home-primary-status",
}: {
  type: HomeGlanceType;
  message: string;
  testId?: string;
}) {
  const StatusIcon = type === "warning" ? AlertTriangle : type === "info" ? Info : CheckCircle2;
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
      data-testid={testId}
    >
      <StatusIcon
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

export type HomeQuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "outline";
  testId?: string;
  className?: string;
  /** Soft primary halo (home Ask Beatie). */
  glow?: boolean;
};

export function HomeQuickActions({
  actions,
  testId = "home-quick-actions",
}: {
  actions: HomeQuickAction[];
  testId?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 animate-soft-in"
      style={{ animationDelay: "40ms" }}
      data-testid={testId}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const isPrimary = action.variant === "primary";
        const gridClass = isPrimary ? "col-span-2 sm:col-span-1" : undefined;
        const btnClass = cn(
          "min-h-11 w-full rounded-2xl",
          isPrimary && "font-semibold tracking-tight shadow-sm",
          action.className,
        );
        const content = (
          <>
            <Icon className="h-4 w-4 mr-2 shrink-0" aria-hidden />
            {action.label}
          </>
        );

        const button = action.href ? (
          <Button asChild variant={isPrimary ? "default" : "outline"} className={btnClass} data-testid={action.testId}>
            <Link href={action.href}>{content}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant={isPrimary ? "default" : "outline"}
            className={btnClass}
            onClick={action.onClick}
            data-testid={action.testId}
          >
            {content}
          </Button>
        );

        if (action.glow) {
          return (
            <div
              key={action.id}
              className={cn("coach-entry-glow w-full rounded-2xl", gridClass)}
              data-testid={action.testId ? `${action.testId}-glow` : undefined}
            >
              {button}
            </div>
          );
        }

        return (
          <div key={action.id} className={cn("w-full", gridClass)}>
            {button}
          </div>
        );
      })}
    </div>
  );
}

const urgentCardClass =
  "dashboard-card-hover animate-soft-in border border-primary/15 shadow-sm overflow-hidden";
const mutedCardClass = "animate-soft-in border border-border/50 shadow-sm bg-muted/25 dark:bg-muted/15";

export function HomeUrgentCard({
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

export function HomeMutedCard({
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

export function HomeCardEmpty({
  title,
  description,
  icon,
  children,
  compact,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <EmptyState title={title} description={description} icon={icon} compact={compact} className={compact ? undefined : "py-6"}>
      {children}
    </EmptyState>
  );
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

export function HomeHypoTimelineItem({
  bgLabel,
  whenText,
  treatment,
  notes,
  footer,
}: {
  bgLabel: string;
  whenText: string;
  treatment?: string | null;
  notes?: string | null;
  footer?: React.ReactNode;
}) {
  return (
    <li className="relative pl-3.5 border-l-2 border-primary/25 py-0">
      <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary/60 ring-2 ring-background" aria-hidden />
      <div className="rounded-lg border border-border/50 bg-background/50 px-2.5 py-2 text-sm space-y-0.5 dark:bg-background/30">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold tabular-nums">{bgLabel}</span>
          <span className="text-xs text-muted-foreground shrink-0">{whenText}</span>
        </div>
        {treatment ? <p className="text-muted-foreground text-xs">Treatment: {treatment}</p> : null}
        {notes ? <p className="text-muted-foreground text-xs whitespace-pre-wrap">{notes}</p> : null}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </div>
    </li>
  );
}

export function HomeTrustFooter({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-0.5 text-center text-[10px] leading-snug text-muted-foreground" data-testid="home-trust-footer">
      {children}
    </p>
  );
}
