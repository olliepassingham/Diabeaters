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
};

export function StoryAvatarRing({
  state,
  children,
  onClick,
  className,
  label,
  interactive = true,
  subtle = false,
}: Props) {
  if (state === "none") return <>{children}</>;

  const ringClass =
    state === "unseen"
      ? subtle
        ? "bg-gradient-to-tr from-primary/50 via-primary/35 to-primary/25"
        : "bg-gradient-to-tr from-primary via-rose-400 to-amber-400"
      : subtle
        ? "bg-muted-foreground/30"
        : "bg-muted-foreground/45";

  const inner = (
    <div className={cn("rounded-full", subtle ? "p-[1.5px]" : "p-[2.5px]", ringClass, className)}>
      <div className={cn("rounded-full bg-background", subtle ? "p-px" : "p-[2px]")}>{children}</div>
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
