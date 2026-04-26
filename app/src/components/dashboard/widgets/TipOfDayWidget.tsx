import { useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { TIPS, CATEGORY_LABELS, getTipIndex } from "./tipOfDayData";

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
    <WidgetCard className="overflow-visible" data-testid="widget-tip-of-day">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0" />
            <Link
              href="/tools/tips"
              className="rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
              aria-label="Open all tips"
            >
              <CardTitle className="text-h3 text-foreground">Tip of the day</CardTitle>
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={showRandom ? handleResetToday : handleShuffle}
            title={showRandom ? "Back to today's tip" : "Show another tip"}
            data-testid="button-shuffle-tip"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-small text-muted-foreground uppercase tracking-wide mt-1">Practical reminder</p>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:px-6 md:pb-6 space-y-2">
        <p className="text-body text-foreground leading-relaxed" data-testid="text-tip-content">
          {tip.text}
        </p>
        <p className="text-small text-muted-foreground uppercase tracking-wide" data-testid="text-tip-category">
          {CATEGORY_LABELS[tip.category] || tip.category}
        </p>
      </CardContent>
    </WidgetCard>
  );
}
