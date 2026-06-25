import { ArrowRight } from "lucide-react";

import { displayPumpTipsForExercise, pumpTipsCardTitle } from "@/lib/exercise-closed-loop";
import { storage } from "@/lib/storage";

export function ExercisePumpTipsCard({
  tips,
  title,
  "data-testid": testId,
}: {
  tips: string[];
  title?: string;
  "data-testid"?: string;
}) {
  const settings = storage.getSettings();
  const filtered = displayPumpTipsForExercise(tips, settings);
  if (filtered.length === 0) return null;
  const heading = title ?? pumpTipsCardTitle(settings);
  return (
    <div
      className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800"
      data-testid={testId}
    >
      <p className="text-tiny font-medium text-indigo-600 dark:text-indigo-400 uppercase mb-2">{heading}</p>
      {filtered.map((tip, i) => (
        <div key={i} className="flex items-start gap-2 mt-1.5 first:mt-0">
          <ArrowRight className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" aria-hidden />
          <p className="text-small text-indigo-800 dark:text-indigo-200 leading-snug">{tip}</p>
        </div>
      ))}
    </div>
  );
}
