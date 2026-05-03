import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Optional control shown to the left of the title (e.g. history back). */
  leading?: ReactNode;
  className?: string;
  /** Entire header is visually hidden but remains in the accessibility tree (e.g. dashboard with visible greeting in-card). */
  screenReaderOnly?: boolean;
  /**
   * When true, title and actions stack below `sm` so wide action rows fit on phones.
   * Default keeps title + actions on one row (e.g. a single info icon beside the title).
   */
  stackActionsMaxSm?: boolean;
};

/**
 * Shared page title row: semantic `h1` + optional muted description + optional trailing actions.
 * By default actions sit on the same row as the title (`truncate` on the title avoids paint-over).
 * Use `stackActionsMaxSm` when there are multiple wide buttons and phones need a second toolbar row.
 * Uses design tokens (`text-h1`, `text-body`, `text-foreground`, `text-muted-foreground`).
 */
export function PageHeader({
  title,
  description,
  actions,
  leading,
  className,
  screenReaderOnly,
  stackActionsMaxSm,
}: PageHeaderProps) {
  const block = (
    <div className={cn("flex min-w-0 items-start gap-2 sm:gap-3", className)}>
      {leading ? <div className="flex shrink-0 items-start pt-0.5 sm:pt-1">{leading}</div> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div
          className={cn(
            "flex w-full min-w-0 items-start gap-2 sm:gap-3",
            stackActionsMaxSm ? "max-sm:flex-col max-sm:gap-2" : null,
          )}
        >
          <h1
            className={cn(
              "min-w-0 font-display text-xl font-semibold tracking-tight text-foreground sm:text-h1 sm:tracking-tight",
              stackActionsMaxSm ? "max-sm:w-full sm:flex-1" : "flex-1 truncate",
            )}
          >
            {title}
          </h1>
          {actions ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-1.5 pt-0.5 sm:pt-1",
                stackActionsMaxSm
                  ? "max-sm:w-full max-sm:justify-start sm:shrink-0 sm:justify-end"
                  : "shrink-0 justify-end",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
        {description ? (
          <div className="text-sm leading-relaxed text-muted-foreground sm:text-body">
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (screenReaderOnly) {
    return <div className="sr-only">{block}</div>;
  }

  return block;
}
