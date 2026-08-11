import { ArrowRight } from "lucide-react";

import { displayPumpTipsForExercise, pumpTipsCardTitle } from "@/lib/exercise-closed-loop";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function ExercisePumpTipsCard({
  tips,
  title,
  variant = "default",
  "data-testid": testId,
}: {
  tips: string[];
  title?: string;
  variant?: "default" | "immersive";
  "data-testid"?: string;
}) {
  const settings = storage.getSettings();
  const filtered = displayPumpTipsForExercise(tips, settings);
  if (filtered.length === 0) return null;
  const heading = title ?? pumpTipsCardTitle(settings);
  const immersive = variant === "immersive";

  return (
    <div
      className={cn(
        immersive
          ? "rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 backdrop-blur-sm"
          : "rounded-2xl border border-border/50 bg-muted/20 px-3.5 py-3",
      )}
      data-testid={testId}
    >
      <p
        className={cn(
          "mb-2 text-[10px] font-medium uppercase tracking-[0.12em]",
          immersive ? "text-white/40" : "text-muted-foreground",
        )}
      >
        {heading}
      </p>
      {filtered.map((tip, i) => (
        <div key={i} className="mt-1.5 flex items-start gap-2 first:mt-0">
          <ArrowRight
            className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", immersive ? "text-emerald-300/80" : "text-muted-foreground")}
            aria-hidden
          />
          <p className={cn("text-sm leading-snug", immersive ? "text-white/70" : "text-foreground/90")}>{tip}</p>
        </div>
      ))}
    </div>
  );
}
