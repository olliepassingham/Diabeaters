import { useEffect, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { HomeLiveGlucose } from "@/hooks/use-home-next-best-action";
import { cn } from "@/lib/utils";

const SHOW_AFTER_PX = 240;

/**
 * Slim glucose pill that appears once the hero reading has scrolled away,
 * so the current value stays on screen anywhere down Home.
 */
export function HomeStickyGlucoseBar({ glucose }: { glucose: HomeLiveGlucose | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scroller = document.getElementById("app-scroll-main");
    const target: HTMLElement | Window = scroller ?? window;
    const onScroll = () => {
      const top = scroller ? scroller.scrollTop : window.scrollY;
      setVisible(top > SHOW_AFTER_PX);
    };
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  if (!glucose) return null;

  const TrendIcon =
    glucose.trend === "rising"
      ? TrendingUp
      : glucose.trend === "falling"
        ? TrendingDown
        : glucose.trend === "flat"
          ? Minus
          : null;

  return (
    <div className="pointer-events-none sticky top-2 z-30 flex h-0 justify-center" data-testid="home-sticky-glucose-shell">
      <Link
        href="/tools/cgm-live"
        aria-label="Open glucose trends"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-full bg-background/85 px-3.5 shadow-lg shadow-black/5 ring-1 ring-border/50 backdrop-blur-xl transition-all duration-200",
          visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
        data-testid="home-sticky-glucose"
        data-visible={visible ? "true" : "false"}
      >
        <span className="font-display text-lg font-semibold tabular-nums leading-none tracking-tight text-foreground">
          {formatTargetBgInput(glucose.value, normalizeBgUnits(glucose.units))}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">{glucose.units}</span>
        {TrendIcon ? <TrendIcon className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
      </Link>
    </div>
  );
}
