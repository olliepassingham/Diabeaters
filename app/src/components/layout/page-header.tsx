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
};

/**
 * Shared page title row: semantic `h1` + optional muted description + optional trailing actions.
 * Actions sit on the same row as the title (wrapping when needed) so small controls like info icons do not consume a full-width row on mobile.
 * Uses design tokens (`text-h1`, `text-body`, `text-foreground`, `text-muted-foreground`).
 */
export function PageHeader({ title, description, actions, leading, className, screenReaderOnly }: PageHeaderProps) {
  const block = (
    <div className={cn("flex min-w-0 items-start gap-2 sm:gap-3", className)}>
      {leading ? <div className="flex shrink-0 items-start pt-0.5 sm:pt-1">{leading}</div> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex w-full min-w-0 flex-wrap items-start gap-2">
          <h1 className="min-w-0 grow basis-0 font-display text-xl font-semibold tracking-tight text-foreground sm:text-h1 sm:tracking-tight">
            {title}
          </h1>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{actions}</div>
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
