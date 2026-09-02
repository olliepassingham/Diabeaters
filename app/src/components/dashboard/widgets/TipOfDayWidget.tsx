import { useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { TIPS, CATEGORY_LABELS, getTipIndex } from "./tipOfDayData";
import { WidgetHeaderIcon, widgetContentClass, widgetHeaderClass } from "./widget-header";

export function TipOfDayWidget(_props: DashboardWidgetLayoutProps) {
  const [tipIndex, setTipIndex] = useState(() => getTipIndex(new Date()));
  const [showRandom, setShowRandom] = useState(false);

  const tip = TIPS[tipIndex] ?? TIPS[0]!;

  const handleShuffle = () => {
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * TIPS.length);
    } while (newIndex === tipIndex && TIPS.length > 1);
    setTipIndex(newIndex);
    setShowRandom(true);
  };

  const handleResetToday = () => {
    setTipIndex(getTipIndex(new Date()));
    setShowRandom(false);
  };

  return (
    <WidgetCard accent="community" className="overflow-visible" data-testid="widget-tip-of-day">
      <CardHeader className={widgetHeaderClass}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <WidgetHeaderIcon icon={Lightbulb} className="bg-amber-500/10 ring-amber-500/15 [&_svg]:text-amber-500 dark:[&_svg]:text-amber-400" />
            <Link
              href="/tools/tips"
              className="rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
              aria-label="Open all tips"
            >
              <CardTitle className="text-base font-semibold leading-tight text-foreground">Tip of the day</CardTitle>
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={showRandom ? handleResetToday : handleShuffle}
            title={showRandom ? "Back to today's tip" : "Show another tip"}
            data-testid="button-shuffle-tip"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`${widgetContentClass} space-y-2`}>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground/90 sm:text-base" data-testid="text-tip-content">
          {tip.text}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700/80 dark:text-amber-300/80" data-testid="text-tip-category">
          {CATEGORY_LABELS[tip.category] || tip.category}
        </p>
      </CardContent>
    </WidgetCard>
  );
}
