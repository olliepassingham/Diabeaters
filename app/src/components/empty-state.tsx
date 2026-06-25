import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
  /** Shorter inline layout for dashboard widget empty slots. */
  compact?: boolean;
};

/**
 * Illustration-free empty state: soft card, display title, optional actions.
 */
export function EmptyState({ title, description, icon: Icon, className, children, compact }: EmptyStateProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "animate-soft-in rounded-xl border border-dashed border-border/55 bg-muted/20 px-3 py-2.5 text-left",
          className,
        )}
        role="status"
      >
        <div className="flex items-start gap-2.5">
          {Icon ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] ring-1 ring-primary/[0.12]">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-foreground">{title}</p>
            {description ? (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {children ? <div className="mt-2.5 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-glass-strong animate-soft-in rounded-2xl border border-border/60 shadow-sm px-5 py-8 text-center",
        className,
      )}
      role="status"
    >
      {Icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/[0.08] ring-1 ring-primary/[0.14]">
          <Icon className="h-6 w-6 text-primary" aria-hidden />
        </div>
      ) : null}
      <p className="font-display text-base font-semibold tracking-tight text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

type HubLoadingSkeletonProps = {
  /** Number of placeholder tiles (default 6 for tools grid). */
  tiles?: number;
  className?: string;
};

/** Placeholder grid for hub pages while auth or data loads. */
export function HubLoadingSkeleton({ tiles = 6, className }: HubLoadingSkeletonProps) {
  return (
    <ul
      className={cn(
        "grid list-none grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7",
        className,
      )}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: tiles }, (_, i) => (
        <li key={i} className="min-h-0 animate-soft-in" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="h-44 w-full rounded-2xl sm:h-48" />
        </li>
      ))}
    </ul>
  );
}

/** Stacked post-shaped placeholders for feed loading. */
export function FeedLoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-2.5 sm:space-y-3" aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="surface-glass flex gap-2.5 rounded-2xl border border-border/50 p-3.5 animate-soft-in"
          style={{ animationDelay: `${i * 55}ms` }}
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-2.5 w-16 rounded-md opacity-80" />
            <Skeleton className="h-12 w-full rounded-xl opacity-60" />
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-7 w-14 rounded-lg opacity-70" />
              <Skeleton className="h-7 w-20 rounded-lg opacity-70" />
              <Skeleton className="h-7 w-16 rounded-lg opacity-70" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
