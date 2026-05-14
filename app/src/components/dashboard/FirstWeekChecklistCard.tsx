import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Wrench, Calculator, Shapes, Package, CheckCircle2, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FirstWeekChecklistCardProps = {
  suppliesCount: number;
  isSettingsComplete: boolean;
  onDismiss: () => void;
};

/**
 * Compact first-week explorer — shown for a few days after onboarding finishes
 * (see `isWithinOnboardingPostFinishGracePeriod`). Dismiss is remembered per signed-in user.
 */
export function FirstWeekChecklistCard({ suppliesCount, isSettingsComplete, onDismiss }: FirstWeekChecklistCardProps) {
  const hasSupplies = suppliesCount > 0;

  const links = [
    { href: "/tools", label: "Tools", icon: Wrench },
    { href: "/scenarios", label: "Guides", icon: Shapes },
    { href: "/adviser?tab=meal", label: "Meal & ratios", icon: Calculator },
    { href: "/supplies", label: "Supplies", icon: Package },
  ] as const;

  return (
    <section
      className="animate-fade-in-up rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 sm:px-4 dark:bg-muted/15"
      data-testid="card-first-week-checklist"
      aria-label="Your first week suggestions"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Your first week</h2>
          <p className="text-[0.65rem] leading-snug text-muted-foreground mt-0.5">Try these when you have a minute — dismiss anytime.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 -mr-1 -mt-0.5"
          aria-label="Dismiss first week suggestions"
          onClick={onDismiss}
          data-testid="button-dismiss-first-week-checklist"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2 py-2 text-center text-xs font-medium text-foreground shadow-sm",
              "no-underline transition-colors hover:border-primary/25 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {hasSupplies ? (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <Circle className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
          )}
          Supplies saved
        </span>
        <span className="inline-flex items-center gap-1">
          {isSettingsComplete ? (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <Circle className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
          )}
          Settings basics
        </span>
      </div>
    </section>
  );
}
