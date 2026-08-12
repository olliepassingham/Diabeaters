import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StoryRingState } from "@/lib/community/stories-supabase";

type Props = {
  state: StoryRingState;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
  /** When true, renders a button; otherwise a decorative wrapper. */
  interactive?: boolean;
  /** Thinner ring and softer colours — for compact feed strip. */
  subtle?: boolean;
  /** Minimal ring padding for dense feed story strip. */
  compact?: boolean;
  /** Thicker, high-contrast ring for public profile avatars. */
  prominent?: boolean;
};

export function StoryAvatarRing({
  state,
  children,
  onClick,
  className,
  label,
  interactive = true,
  subtle = false,
  compact = false,
  prominent = false,
}: Props) {
  if (state === "none") return <>{children}</>;

  const ringClass =
    state === "unseen"
      ? prominent
        ? "bg-[conic-gradient(from_210deg,rgb(var(--color-primary)),#f43f5e,#f59e0b,rgb(var(--color-primary)))]"
        : subtle || compact
          ? "bg-gradient-to-tr from-primary/50 via-primary/35 to-primary/25"
          : "bg-gradient-to-tr from-primary via-rose-400 to-amber-400"
      : prominent
        ? "bg-muted-foreground/55"
        : subtle || compact
          ? "bg-muted-foreground/30"
          : "bg-muted-foreground/45";

  const ringPad = prominent ? "p-[3.5px]" : compact ? "p-[1px]" : subtle ? "p-[1.5px]" : "p-[2.5px]";
  const innerPad = prominent ? "p-[3px]" : compact ? "p-0" : subtle ? "p-px" : "p-[2px]";

  const inner = (
    <div className={cn("rounded-full", ringPad, ringClass, prominent && "shadow-sm", className)}>
      <div className={cn("rounded-full bg-background", innerPad)}>{children}</div>
    </div>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={label ?? (state === "unseen" ? "Watch story" : "Rewatch story")}
      >
        {inner}
      </button>
    );
  }

  return inner;
}
