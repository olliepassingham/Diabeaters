import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type PageShellVariant = "narrow" | "standard" | "wide";

export type PageShellProps = ComponentProps<"div"> & {
  /**
   * Max content width (centered).
   * - narrow: forms, community, auth (`max-w-lg`)
   * - standard: most app pages (`max-w-3xl`)
   * - wide: dashboard-style (`max-w-3xl md:max-w-4xl`)
   */
  variant?: PageShellVariant;
  /** Vertical gap between direct children (`space-y-*`). */
  density?: "default" | "compact";
};

const variantClass: Record<PageShellVariant, string> = {
  narrow: "max-w-lg",
  standard: "max-w-3xl",
  wide: "max-w-3xl md:max-w-4xl",
};

const densityClass = {
  default: "space-y-6",
  compact: "space-y-3 md:space-y-4",
} as const;

/**
 * Primary page container: centered max-width + consistent vertical rhythm between sections.
 *
 * **Width & spacing contract**
 * - Horizontal inset + clearance above the fixed BottomNav come from `AuthenticatedShell`
 *   `<main>` in `App.tsx` — avoid stacking another full nav-height padding here.
 * - Default `pb-4` is light rhythm only; override via `className` when a screen needs more tail space.
 */
export function PageShell({
  variant = "standard",
  density = "default",
  className,
  children,
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-full pb-4",
        variantClass[variant],
        densityClass[density],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
