import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FaceLogo } from "@/components/face-logo";
import { cn } from "@/lib/utils";

export type OnboardingAccent = "primary" | "blue" | "amber" | "green" | "purple" | "yellow";

const accentMap: Record<
  OnboardingAccent,
  { icon: string; iconBg: string; ring: string; card: string; featureBg: string }
> = {
  primary: {
    icon: "text-primary",
    iconBg: "bg-primary/10",
    ring: "ring-primary/15",
    card: "border-primary/20 bg-gradient-to-b from-primary/[0.07] to-card dark:from-primary/[0.1]",
    featureBg: "bg-primary/10",
  },
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
    ring: "ring-blue-500/20",
    card: "border-blue-500/20 bg-gradient-to-b from-blue-500/[0.07] to-card dark:from-blue-500/10",
    featureBg: "bg-blue-500/10 dark:bg-blue-500/20",
  },
  amber: {
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
    ring: "ring-amber-500/20",
    card: "border-amber-500/20 bg-gradient-to-b from-amber-500/[0.07] to-card dark:from-amber-500/10",
    featureBg: "bg-amber-500/10 dark:bg-amber-500/20",
  },
  green: {
    icon: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10 dark:bg-green-500/20",
    ring: "ring-green-500/20",
    card: "border-green-500/20 bg-gradient-to-b from-green-500/[0.07] to-card dark:from-green-500/10",
    featureBg: "bg-green-500/10 dark:bg-green-500/20",
  },
  purple: {
    icon: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
    ring: "ring-purple-500/20",
    card: "border-purple-500/20 bg-gradient-to-b from-purple-500/[0.07] to-card dark:from-purple-500/10",
    featureBg: "bg-purple-500/10 dark:bg-purple-500/20",
  },
  yellow: {
    icon: "text-yellow-600 dark:text-yellow-500",
    iconBg: "bg-yellow-500/10 dark:bg-yellow-500/20",
    ring: "ring-yellow-500/25",
    card: "border-yellow-500/25 bg-gradient-to-b from-yellow-500/[0.06] to-card dark:from-yellow-500/10",
    featureBg: "bg-yellow-500/10 dark:bg-yellow-500/20",
  },
};

/** Id of the onboarding scroll container — used to reset scroll position between steps. */
export const ONBOARDING_SCROLL_MAIN_ID = "onboarding-scroll-main";

/**
 * Onboarding renders outside the authenticated shell, so it doesn't get `#app-scroll-main`.
 * On native Capacitor WebViews `html`/`body`/`#root` all get `overflow: hidden` (see index.css)
 * so the document never scrolls — without its own scroll container here, tall steps (long
 * forms, disclaimers) get clipped and users can't reach the content below the fold or the
 * Next button. Pin this shell to the viewport and scroll only inside the inner container,
 * matching the same pattern `#app-scroll-main` uses for the rest of the app.
 */
export function OnboardingBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-80 w-[min(100%,32rem)] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/12" />
        <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-primary/[0.05] blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-48 w-48 rounded-full bg-muted/40 blur-3xl dark:bg-muted/20" />
      </div>
      <div
        id={ONBOARDING_SCROLL_MAIN_ID}
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        {children}
      </div>
    </div>
  );
}

export function OnboardingBrandMark({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-1 flex justify-center">
      <div className="rounded-2xl bg-card/70 p-2 shadow-sm ring-1 ring-border/50 backdrop-blur-sm">
        <FaceLogo size={36} />
      </div>
    </div>
  );
}

type StepPill = { id: string; label: string };

export function OnboardingStepRail({
  steps,
  currentStepId,
}: {
  steps: StepPill[];
  currentStepId: string;
}) {
  const activeIdx = steps.findIndex((s) => s.id === currentStepId);
  if (activeIdx < 0 || steps.length === 0) return null;

  return (
    <nav className="space-y-3 px-1 pt-2" aria-label="Onboarding steps">
      <div className="flex items-center justify-center gap-1 sm:gap-1.5">
        {steps.map((step, i) => {
          const done = i < activeIdx;
          const current = i === activeIdx;
          return (
            <div key={step.id} className="flex items-center gap-1 sm:gap-1.5">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex h-7 min-w-7 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors sm:h-8 sm:min-w-8 sm:text-xs",
                  done && "border-primary/35 bg-primary/15 text-primary",
                  current && "border-primary bg-primary text-primary-foreground shadow-sm",
                  !done && !current && "border-border/60 bg-muted/30 text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 w-3 rounded-full sm:w-5",
                    i < activeIdx ? "bg-primary/40" : "bg-border/70",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {steps[activeIdx]?.label}
      </p>
    </nav>
  );
}

export function OnboardingProgress({ value }: { value: number }) {
  return (
    <Progress
      value={value}
      className="h-2 overflow-hidden rounded-full bg-muted/50"
      data-testid="progress-onboarding"
    />
  );
}

export function OnboardingStepHeader({
  icon: Icon,
  accent = "primary",
  title,
  subtitle,
  className,
}: {
  icon?: LucideIcon;
  accent?: OnboardingAccent;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  const styles = accentMap[accent];
  return (
    <div className={cn("space-y-3 text-center", className)}>
      {Icon ? (
        <div className="flex justify-center">
          <div
            className={cn(
              "rounded-2xl p-3.5 shadow-sm ring-1 ring-inset",
              styles.iconBg,
              styles.ring,
            )}
          >
            <Icon className={cn("h-6 w-6", styles.icon)} aria-hidden />
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold tracking-tight text-balance">{title}</h2>
        {subtitle ? (
          <p className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function OnboardingCard({
  children,
  accent,
  className,
  contentClassName,
}: {
  children: ReactNode;
  accent?: OnboardingAccent;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 shadow-sm backdrop-blur-sm",
        accent ? accentMap[accent].card : "bg-card/85",
        className,
      )}
    >
      <CardContent className={cn("pt-6 pb-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function OnboardingOptionCard({
  selected,
  onClick,
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all hover-elevate sm:gap-4 sm:p-4",
        selected
          ? "border-primary/45 bg-gradient-to-br from-primary/[0.1] to-primary/[0.02] shadow-sm ring-2 ring-primary/20"
          : "border-border/70 bg-card/70 backdrop-blur-sm",
      )}
    >
      <div className={cn("shrink-0 rounded-xl p-2.5 sm:p-3", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-background/80",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}

export function OnboardingBulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((text, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
            {i + 1}
          </span>
          <span className="pt-0.5">{text}</span>
        </li>
      ))}
    </ul>
  );
}

export function OnboardingFeatureList({
  features,
  accent = "primary",
}: {
  features: Array<{ icon: LucideIcon; text: string; highlight?: boolean }>;
  accent?: OnboardingAccent;
}) {
  const styles = accentMap[accent];
  return (
    <div className="space-y-4">
      {features.map((feature, i) => {
        const FeatureIcon = feature.icon;
        return (
          <div key={i} className="flex items-start gap-3">
            <div
              className={cn(
                "shrink-0 rounded-xl p-2",
                feature.highlight ? styles.featureBg : "bg-muted/60",
              )}
            >
              <FeatureIcon
                className={cn("h-4 w-4", feature.highlight ? styles.icon : "text-muted-foreground")}
                aria-hidden
              />
            </div>
            <p
              className={cn(
                "pt-1.5 text-sm leading-relaxed",
                feature.highlight ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {feature.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingHeroIcon({
  icon: Icon,
  accent = "primary",
  size = "lg",
}: {
  icon: LucideIcon;
  accent?: OnboardingAccent;
  size?: "md" | "lg";
}) {
  const styles = accentMap[accent];
  return (
    <div className="flex justify-center">
      <div className="relative">
        <div
          aria-hidden
          className={cn("absolute inset-0 scale-150 rounded-full blur-2xl opacity-60", styles.iconBg)}
        />
        <div
          className={cn(
            "relative rounded-full shadow-sm ring-1 ring-inset",
            styles.iconBg,
            styles.ring,
            size === "lg" ? "p-4" : "p-3",
          )}
        >
          <Icon className={cn(size === "lg" ? "h-8 w-8" : "h-6 w-6", styles.icon)} aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function OnboardingStickyActions({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-[var(--keyboard-inset-bottom,0px)] left-0 right-0 z-50",
        "border-t border-border/80 bg-background/95 px-4 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur",
        "supports-[backdrop-filter]:bg-background/85",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-none",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function OnboardingNavActions({
  showBack,
  onBack,
  showNext,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  backTestId,
  nextTestId,
}: {
  showBack: boolean;
  onBack: () => void;
  showNext: boolean;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backTestId?: string;
  nextTestId?: string;
}) {
  if (!showBack && !showNext) return null;

  return (
    <OnboardingStickyActions testId="onboarding-sticky-actions">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
        {showBack ? (
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl" data-testid={backTestId}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        ) : (
          <div />
        )}
        {showNext ? (
          <Button
            onClick={onNext}
            disabled={nextDisabled}
            size="sm"
            className="min-w-[7.5rem] shrink-0 rounded-xl shadow-sm"
            data-testid={nextTestId}
          >
            {nextLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </OnboardingStickyActions>
  );
}

export function OnboardingTrustRow({ items }: { items: Array<{ icon: LucideIcon; label: string }> }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
      {items.map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function OnboardingStepPanel({
  stepKey,
  children,
  className,
}: {
  stepKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div key={stepKey} className={cn("animate-soft-in space-y-6 pt-4 sm:pt-5", className)}>
      {children}
    </div>
  );
}

export function onboardingAccentForStruggle(
  struggle: "supplies" | "meals" | "exercise" | "overview" | null,
): OnboardingAccent {
  if (struggle === "supplies") return "blue";
  if (struggle === "meals") return "amber";
  if (struggle === "exercise") return "green";
  if (struggle === "overview") return "purple";
  return "primary";
}
