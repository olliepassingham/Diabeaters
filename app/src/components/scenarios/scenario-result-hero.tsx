import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ScenarioResultHeroTone = "default" | "caution" | "critical" | "hypo";

const toneSurface: Record<ScenarioResultHeroTone, string> = {
  default: "border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card",
  caution: "border-amber-500/35 bg-gradient-to-b from-amber-500/10 via-card to-card dark:from-amber-950/40",
  critical: "border-red-500/35 bg-gradient-to-b from-red-500/12 via-card to-card dark:from-red-950/40",
  hypo: "border-red-500/35 bg-gradient-to-b from-red-500/10 via-card to-card dark:from-red-950/40",
};

const toneEyebrow: Record<ScenarioResultHeroTone, string> = {
  default: "text-primary/90",
  caution: "text-amber-800/90 dark:text-amber-200/90",
  critical: "text-red-700/90 dark:text-red-300/90",
  hypo: "text-red-700/90 dark:text-red-300/90",
};

export type ScenarioResultHeroProps = {
  label: string;
  value: ReactNode;
  tone?: ScenarioResultHeroTone;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  headerAction?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  "data-testid"?: string;
  valueTestId?: string;
};

export function ScenarioResultHero({
  label,
  value,
  tone = "default",
  className,
  labelClassName,
  valueClassName,
  headerAction,
  children,
  footer,
  "data-testid": dataTestId,
  valueTestId,
}: ScenarioResultHeroProps) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl border shadow-sm", toneSurface[tone], className)}
      data-testid={dataTestId}
    >
      <div className="relative px-5 pb-4 pt-5 text-center">
        {headerAction ? <div className="absolute right-3 top-3">{headerAction}</div> : null}
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", toneEyebrow[tone], labelClassName)}>
          {label}
        </p>
        <div
          className={cn("mt-1 font-display text-5xl font-bold tabular-nums tracking-tight text-foreground", valueClassName)}
          data-testid={valueTestId}
        >
          {value}
        </div>
        {children}
      </div>
      {footer ? <div className="border-t border-border/50">{footer}</div> : null}
    </div>
  );
}

export function ScenarioResultHeroSuffix({ children }: { children: ReactNode }) {
  return <span className="text-2xl font-semibold text-muted-foreground">{children}</span>;
}
