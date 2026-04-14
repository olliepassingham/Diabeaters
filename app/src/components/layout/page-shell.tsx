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
 * - Horizontal inset comes from `AuthenticatedShell` / `AccountShell` `<main className="… p-4 md:p-6 …">` in `App.tsx`.
 * - Reserve space above the fixed BottomNav via that same `<main>`’s `pb-24` — do not add another full `pb-24` on page roots.
 * - Override max width per page with `className` (tailwind-merge wins), e.g. `className="max-w-5xl"` for Tools.
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
        "mx-auto w-full min-w-0 max-w-full pb-[calc(var(--bottom-nav-height,7.5rem)+2.5rem)]",
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
