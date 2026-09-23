import { CheckCircle2, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import type { HomeNextBestAction } from "@/lib/home-next-best-action";

function primaryToneClasses(action: HomeNextBestAction, isUrgent: boolean): {
  shell: string;
  chevron: string;
} {
  if (action.kind === "help" || action.id === "help_now" || isUrgent) {
    return {
      shell: "bg-red-600 text-white shadow-sm shadow-red-600/25 hover:bg-red-600/95",
      chevron: "text-white/80",
    };
  }
  if (action.id === "bedtime") {
    return {
      shell:
        "bg-gradient-to-br from-indigo-500/[0.14] via-violet-500/[0.08] to-background ring-1 ring-indigo-500/25 text-indigo-950 hover:from-indigo-500/[0.18] dark:text-indigo-50",
      chevron: "text-indigo-600/70 dark:text-indigo-300/80",
    };
  }
  if (action.id === "travel") {
    return {
      shell:
        "bg-sky-500/[0.12] ring-1 ring-sky-500/25 text-sky-950 hover:bg-sky-500/[0.16] dark:text-sky-50",
      chevron: "text-sky-700/70 dark:text-sky-300/80",
    };
  }
  if (action.id === "exercise") {
    return {
      shell:
        "bg-emerald-500/[0.12] ring-1 ring-emerald-500/25 text-emerald-950 hover:bg-emerald-500/[0.16] dark:text-emerald-50",
      chevron: "text-emerald-700/70 dark:text-emerald-300/80",
    };
  }
  if (action.id === "sick_day") {
    return {
      shell:
        "bg-amber-500/[0.14] ring-1 ring-amber-500/25 text-amber-950 hover:bg-amber-500/[0.18] dark:text-amber-50",
      chevron: "text-amber-700/70 dark:text-amber-300/80",
    };
  }
  if (action.id === "pump_failure") {
    return {
      shell:
        "bg-red-500/[0.12] ring-1 ring-red-500/25 text-red-950 hover:bg-red-500/[0.16] dark:text-red-50",
      chevron: "text-red-700/70 dark:text-red-300/80",
    };
  }
  // meal / coach / supplies / adviser — soft brand primary, not solid black
  return {
    shell:
      "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/92",
    chevron: "text-primary-foreground/75",
  };
}

/**
 * One primary next action + Help / Hypo controls.
 * Ask Beatie stays as a light secondary link unless the primary strip is already Ask Beatie.
 */
export function HomeActionDock({
  isUrgent,
  showCoach,
  onTreatedHypo,
  primary,
}: {
  isUrgent: boolean;
  showCoach: boolean;
  onTreatedHypo: () => void;
  primary: HomeNextBestAction;
}) {
  const coachHref = buildCoachHref({ topic: pickCoachTopicSlugFromScenarioState() });
  const primaryHref = primary.id === "coach" ? coachHref : primary.href;
  const tone = primaryToneClasses(primary, isUrgent);

  const onPrimaryPointer = () => {
    void hapticLight();
  };

  const primaryClass = cn(
    "group pressable flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors animate-soft-in",
    tone.shell,
  );

  const primaryLabel = primary.id === "coach" ? openAssistantCtaLabel() : primary.label;

  const primaryInner = (
    <>
      <span className="min-w-0 font-display text-[15px] font-semibold tracking-tight sm:text-base">
        {primaryLabel}
      </span>
      <ChevronRight
        className={cn("h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5", tone.chevron)}
        aria-hidden
      />
    </>
  );

  return (
    <div className="space-y-3 px-1" data-testid="home-action-dock">
      {primary.kind === "link" && primaryHref ? (
        <Link
          href={primaryHref}
          className={primaryClass}
          data-testid="home-next-best-action"
          onPointerDown={onPrimaryPointer}
        >
          {primaryInner}
        </Link>
      ) : primary.kind === "help" || primary.id === "help_now" ? (
        <Link
          href="/help-now"
          className={primaryClass}
          data-testid="home-next-best-action"
          onPointerDown={onPrimaryPointer}
        >
          {primaryInner}
        </Link>
      ) : (
        <button
          type="button"
          className={primaryClass}
          data-testid="home-next-best-action"
          onClick={onTreatedHypo}
          onPointerDown={onPrimaryPointer}
        >
          {primaryInner}
        </button>
      )}

      <div className="grid grid-cols-2 gap-2" data-testid="home-action-overflow">
        <Button
          asChild
          variant="outline"
          className={cn(
            "h-12 rounded-2xl border-red-500/25 bg-red-500/[0.07] text-sm font-semibold text-red-800 shadow-none hover:bg-red-500/[0.12] dark:text-red-200",
            isUrgent && "ring-1 ring-red-500/30",
          )}
        >
          <Link href="/help-now" data-testid="button-help-now" onPointerDown={() => void hapticLight()}>
            <Phone className="mr-2 h-4 w-4" aria-hidden />
            Help Now
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-2xl border-emerald-500/25 bg-emerald-500/[0.07] text-sm font-semibold text-emerald-900 shadow-none hover:bg-emerald-500/[0.12] dark:text-emerald-200"
          onClick={onTreatedHypo}
          data-testid="button-dashboard-treated-hypo"
          onPointerDown={() => void hapticLight()}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
          Treated a hypo
        </Button>
      </div>

      {showCoach && primary.id !== "coach" ? (
        <div className="flex justify-center">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Link
              href={coachHref}
              data-testid="link-dashboard-coach-open"
              onPointerDown={() => void hapticLight()}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {openAssistantCtaLabel()}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
