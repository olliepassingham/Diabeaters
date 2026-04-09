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
        "surface-glass-strong animate-soft-in rounded-2xl px-5 py-8 text-center",
        className,
      )}
      role="status"
    >
      {Icon ? <Icon className="mx-auto mb-3 h-10 w-10 text-primary/85" aria-hidden /> : null}
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
    <div className="space-y-4" aria-busy="true" aria-label="Loading feed">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          className="h-36 w-full animate-soft-in rounded-2xl sm:h-40"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}
