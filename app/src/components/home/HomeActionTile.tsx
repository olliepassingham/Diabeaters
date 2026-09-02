import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

export type HomeActionTileProps = {
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "destructive" | "success" | "primary";
  glow?: boolean;
  urgentPulse?: boolean;
  testId?: string;
  className?: string;
  animationDelay?: string;
};

const tileVariantClasses = {
  default: "bg-muted/30 ring-border/40 hover:bg-muted/55",
  destructive: "bg-red-500/[0.09] ring-red-500/20 hover:bg-red-500/[0.14]",
  success: "bg-emerald-500/[0.09] ring-emerald-500/20 hover:bg-emerald-500/[0.14]",
  primary: "bg-primary/[0.09] ring-primary/20 hover:bg-primary/[0.14]",
};

const iconVariantClasses = {
  default: "bg-background/70 text-foreground shadow-sm ring-border/50",
  destructive: "bg-red-500 text-white shadow-md shadow-red-500/20 ring-red-400/30",
  success: "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-emerald-400/30",
  primary: "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-primary/30",
};

export function HomeActionTile({
  label,
  subtitle,
  icon: Icon,
  href,
  onClick,
  variant = "default",
  glow = false,
  urgentPulse = false,
  testId,
  className,
  animationDelay = "0ms",
}: HomeActionTileProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] ring-1 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.04]",
          iconVariantClasses[variant],
          urgentPulse && "glow-pulse-critical",
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 text-center">
        <span className="block text-[11px] font-semibold leading-tight tracking-tight text-foreground sm:text-xs">{label}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );

  const tileClass = cn(
    "group pressable flex min-h-[5.25rem] min-w-[6rem] flex-1 flex-col items-center justify-center gap-1.5 rounded-[1.35rem] px-2 py-2.5 ring-1 animate-soft-in transition-colors",
    tileVariantClasses[variant],
    className,
  );

  const onPointerDown = () => {
    void hapticLight();
  };

  const body = href ? (
    <Link href={href} className={tileClass} data-testid={testId} style={{ animationDelay }} onPointerDown={onPointerDown}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className={tileClass}
      onClick={onClick}
      data-testid={testId}
      style={{ animationDelay }}
      onPointerDown={onPointerDown}
    >
      {content}
    </button>
  );

  if (glow) {
    return (
      <div className="flex min-w-[6rem] flex-1" data-testid={testId ? `${testId}-glow` : undefined}>
        {body}
      </div>
    );
  }

  return body;
}
