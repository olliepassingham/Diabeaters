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
 * Uses design tokens (`text-h1`, `text-body`, `text-foreground`, `text-muted-foreground`).
 */
export function PageHeader({ title, description, actions, leading, className, screenReaderOnly }: PageHeaderProps) {
  const block = (
    <div className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
        {leading ? <div className="flex shrink-0 items-start pt-0.5 sm:pt-1">{leading}</div> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-h1">{title}</h1>
          {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? (
        <div className="w-full min-w-0 shrink-0 sm:ml-auto sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );

  if (screenReaderOnly) {
    return <div className="sr-only">{block}</div>;
  }

  return block;
}
