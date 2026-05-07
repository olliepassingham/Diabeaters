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
};

/**
 * Illustration-free empty state: soft card, display title, optional actions.
 */
export function EmptyState({ title, description, icon: Icon, className, children }: EmptyStateProps) {
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
    <ul className="space-y-3" aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="surface-glass-muted flex gap-3 rounded-2xl border border-border/50 p-3 sm:p-4 animate-soft-in"
          style={{ animationDelay: `${i * 55}ms` }}
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md opacity-80" />
            <Skeleton className="h-14 w-full rounded-xl opacity-60" />
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
