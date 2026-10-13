import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type HubListTone = "accent" | "quiet" | "guide";

/** Short teal-to-gold family, matching the line under a guide title. */
export type HubListAccent = "teal" | "sky" | "gold" | "indigo" | "amber" | "rose" | "violet";

const TONE_ACCENT: Record<HubListTone, HubListAccent> = {
  accent: "teal",
  quiet: "sky",
  guide: "teal",
};

export function HubListPanel({
  children,
  label,
  density = "regular",
}: {
  children: ReactNode;
  label: string;
  density?: "regular" | "compact";
}) {
  return (
    <ul className={cn("hub-list-panel m-0 list-none p-0", density === "compact" && "hub-list-panel-compact")} aria-label={label}>
      {children}
    </ul>
  );
}

export function HubListRow({
  href,
  icon: Icon,
  title,
  description,
  tone,
  accent,
  onWarm,
  onPress,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: HubListTone;
  accent?: HubListAccent;
  onWarm?: () => void;
  onPress?: () => void;
}) {
  const ink = accent ?? TONE_ACCENT[tone];
  return (
    <li className={cn("hub-list-card", tone === "guide" && "hub-list-card-steady", `hub-accent-${ink}`)}>
      <Link
        href={href}
        className="hub-list-row group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onPointerEnter={onWarm}
        onFocus={onWarm}
        onTouchStart={onWarm}
        onClick={onPress}
      >
        <span className="hub-list-accent" aria-hidden />
        <span className="hub-icon-well" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <span className="hub-list-copy min-w-0">
          <h3 className="truncate font-display text-h3 font-semibold text-foreground">{title}</h3>
          <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{description}</span>
        </span>
        <ChevronRight
          className="hub-list-chevron h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}
