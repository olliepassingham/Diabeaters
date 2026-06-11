import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Calculator, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DIABEATER_SETTINGS_CHANGED_EVENT, storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { SETTINGS_RATIOS_HREF } from "@/lib/settings-nav";

function hasMealRatiosSaved(): boolean {
  const settings = storage.getSettings();
  return !!(settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio);
}

export type RatiosSetupNoticeProps = {
  testId?: string;
  className?: string;
  hidden?: boolean;
};

/**
 * Shown on Tools when carb ratios are missing — meal and correction tools work better with them saved.
 */
export function RatiosSetupNotice({
  testId = "ratios-setup-notice",
  className,
  hidden,
}: RatiosSetupNoticeProps) {
  const [hasRatios, setHasRatios] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setHasRatios(hasMealRatiosSaved());
    const onChanged = () => setHasRatios(hasMealRatiosSaved());
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onChanged);
  }, []);

  if (hidden) return null;
  if (hasRatios === undefined) return null;
  if (hasRatios) return null;

  return (
    <Card
      className={cn(
        "rounded-2xl border-primary/20 bg-gradient-to-br from-primary/[0.06] to-muted/20 shadow-sm",
        className,
      )}
      data-testid={testId}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden
          >
            <Calculator className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium text-foreground">Add your carb ratios for meal tools</p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Meal &amp; ratios and correction help use the numbers you save in Settings. Not sure yet? Use the Ratio
              Adviser there to find a starting point.
            </p>
            <Link
              href={SETTINGS_RATIOS_HREF}
              className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-testid={`${testId}-cta`}
            >
              <span>Open ratios in Settings</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
