import { cn } from "@/lib/utils";

export type StepLadderStep = {
  id: string;
  title: string;
  description?: string;
};

type StepLadderProps = {
  steps: StepLadderStep[];
  /** Screen-reader label for the list */
  ariaLabel: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * Numbered step list (15–15 style flows). Works on all breakpoints; no reliance on color alone for meaning.
 */
export function StepLadder({ steps, ariaLabel, className, "data-testid": testId }: StepLadderProps) {
  return (
    <ol className={cn("space-y-2", className)} aria-label={ariaLabel} data-testid={testId}>
      {steps.map((step, i) => (
        <li
          key={step.id}
          className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 dark:bg-muted/15"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-sm font-semibold tabular-nums text-primary dark:bg-primary/15"
            aria-hidden
          >
            {i + 1}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium leading-snug text-foreground">{step.title}</p>
            {step.description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
