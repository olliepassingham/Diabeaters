import { useEffect, useState } from "react";
import { Loader2, Minus, Moon, Radio, TrendingDown, TrendingUp, HelpCircle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dismissBedtimeOutcomePrompt } from "@/lib/bedtime-outcome-prompt";
import { useBedtimeOutcomeCgmInsight } from "@/hooks/use-bedtime-outcome-cgm-insight";
import {
  bedtimeOvernightSummaryFromInsight,
  overnightSummariesDiffer,
  type BedtimeOvernightInsight,
} from "@/lib/bedtime-overnight-analysis";
import {
  buildOvernightCheckinTakeaway,
  describeLastNightCheck,
} from "@/lib/bedtime-outcome-insights";
import { formatTargetBgInput } from "@/lib/hypo-context";
import type { BgUnits } from "@/lib/cgm/types";
import { storage, type BedtimeLog, type BedtimeOutcome } from "@/lib/storage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: BedtimeLog | null;
  /** Other bedtime logs, used to personalise the takeaway. */
  logs?: BedtimeLog[];
  onSaved?: () => void;
};

const FEEL_OPTIONS: { value: BedtimeOutcome["overnightFeel"]; label: string; Icon: typeof Minus }[] = [
  { value: "steady", label: "Steady", Icon: Minus },
  { value: "went_low", label: "Went low", Icon: TrendingDown },
  { value: "went_high", label: "Went high", Icon: TrendingUp },
  { value: "not_sure", label: "Not sure", Icon: HelpCircle },
];

const FOLLOWED_OPTIONS: { value: BedtimeOutcome["followedAction"]; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partly" },
  { value: "no", label: "No" },
];

function actionSuggestedLabel(log: BedtimeLog): string | null {
  if (log.actionSuggested === "correction") return "the correction";
  if (log.actionSuggested === "snack") return "the snack";
  return null;
}

/** Prioritise the low over a high when a night had both — that's the direction worth flagging first. */
function feelFromCgmInsight(insight: BedtimeOvernightInsight): BedtimeOutcome["overnightFeel"] {
  if (insight.stats.hadLow) return "went_low";
  if (insight.stats.hadHigh) return "went_high";
  return "steady";
}

export function BedtimeOutcomeCheckinDialog({ open, onOpenChange, log, logs = [], onSaved }: Props) {
  const { toast } = useToast();
  const [feel, setFeel] = useState<BedtimeOutcome["overnightFeel"] | null>(null);
  const [morningBg, setMorningBg] = useState("");
  const [showMorningBg, setShowMorningBg] = useState(false);
  const [followedAction, setFollowedAction] = useState<BedtimeOutcome["followedAction"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefilledFromCgm, setPrefilledFromCgm] = useState(false);

  const units: BgUnits = log?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const { insight: cgmInsight, loading: cgmLoading } = useBedtimeOutcomeCgmInsight(log, units);

  useEffect(() => {
    if (open) {
      setFeel(null);
      setMorningBg("");
      setShowMorningBg(false);
      setFollowedAction(null);
      setPrefilledFromCgm(false);
    }
  }, [open, log?.id]);

  // Once this specific night's CGM data comes back, fill in what the sensor already
  // saw instead of asking someone to re-type it — still fully editable below, since
  // sensor gaps or compression lows can make the auto read wrong.
  useEffect(() => {
    if (!open || !cgmInsight || feel != null) return;
    setFeel(feelFromCgmInsight(cgmInsight));
    setMorningBg(formatTargetBgInput(cgmInsight.stats.endValue, units));
    setPrefilledFromCgm(true);
  }, [open, cgmInsight, feel, units]);

  if (!log) return null;

  const recap = describeLastNightCheck(log);
  const askFollowed = actionSuggestedLabel(log) != null;
  const showCgmChecking = cgmLoading && feel == null;

  const handleSkip = () => {
    dismissBedtimeOutcomePrompt(log.id);
    onOpenChange(false);
    onSaved?.();
  };

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) handleSkip();
    else onOpenChange(true);
  };

  const handleSave = () => {
    if (!feel) return;
    setBusy(true);
    try {
      const bgValue = morningBg.trim() ? parseFloat(morningBg) : null;
      const outcome: BedtimeOutcome = {
        reportedAt: new Date().toISOString(),
        overnightFeel: feel,
        morningBg: bgValue != null && Number.isFinite(bgValue) ? bgValue : null,
        morningBgUnits: log.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L",
        followedAction: askFollowed ? followedAction ?? "n_a" : "n_a",
      };
      const patch: Partial<BedtimeLog> = { outcome };
      if (cgmInsight) {
        const summary = bedtimeOvernightSummaryFromInsight(cgmInsight);
        if (overnightSummariesDiffer(log.overnightCgmSummary, summary) && summary) {
          patch.overnightCgmSummary = summary;
        }
      }
      storage.updateBedtimeLog(log.id, patch);
      const result = buildOvernightCheckinTakeaway(
        log,
        {
          overnightFeel: feel,
          followedAction: outcome.followedAction,
          morningBg: outcome.morningBg,
        },
        logs,
      );
      toast({
        title: result.headline,
        description: result.recommendations[0] ?? result.body,
      });
      onOpenChange(false);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const recapBits = [
    recap.bgLine.replace(/^Bedtime check was /, ""),
    recap.actionLine?.replace(/^We suggested /, ""),
    ...recap.contextChips,
  ].filter(Boolean);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md" data-testid="dialog-bedtime-outcome-checkin">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-left">
            <Moon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            How did last night go?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p className="text-[13px] leading-snug text-foreground/80">
                {recapBits.join(" · ")}
              </p>

              {prefilledFromCgm ? (
                <p className="flex items-start gap-1.5 text-[13px] text-foreground/90" data-testid="text-bedtime-outcome-cgm-prefilled">
                  <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    {cgmInsight?.headline
                      ? `${cgmInsight.headline}. Change it if that’s wrong, then save.`
                      : "Filled in from your CGM — change it if that’s wrong, then save."}
                  </span>
                </p>
              ) : showCgmChecking ? (
                <p className="flex items-center gap-1.5 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Checking your CGM…
                </p>
              ) : (
                <p className="text-[13px]">One tap is enough — we’ll use it on similar nights.</p>
              )}

              <div
                className="grid grid-cols-2 gap-1.5"
                role="group"
                aria-label="Overnight glucose result"
              >
                {FEEL_OPTIONS.map(({ value, label, Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={feel === value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-10 min-h-0 justify-start gap-1.5 rounded-xl px-2.5 text-[13px] shadow-none",
                      feel === value ? "" : "text-foreground",
                    )}
                    onClick={() => {
                      setPrefilledFromCgm(false);
                      setFeel(value);
                    }}
                    disabled={busy}
                    data-testid={`button-bedtime-outcome-feel-${value}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {label}
                  </Button>
                ))}
              </div>

              {askFollowed ? (
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[12px] text-muted-foreground">Followed {actionSuggestedLabel(log)}?</span>
                  <div
                    className="flex min-w-0 flex-1 gap-1 rounded-xl border border-border/60 bg-muted/25 p-0.5"
                    role="group"
                    aria-label="Followed suggested action"
                  >
                    {FOLLOWED_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={followedAction === opt.value ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-8 min-h-0 flex-1 rounded-lg px-1 text-xs shadow-none",
                          followedAction === opt.value ? "" : "text-muted-foreground",
                        )}
                        onClick={() => setFollowedAction(opt.value)}
                        disabled={busy}
                        data-testid={`button-bedtime-outcome-followed-${opt.value}`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showMorningBg ? (
                <div className="flex gap-2">
                  <Input
                    id="bedtime-outcome-morning-bg"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    placeholder={log.bgUnits === "mmol/L" ? "Morning BG" : "Morning BG"}
                    value={morningBg}
                    onChange={(e) => {
                      setPrefilledFromCgm(false);
                      setMorningBg(e.target.value);
                    }}
                    disabled={busy}
                    className="h-10 flex-1 text-base"
                    data-testid="input-bedtime-outcome-morning-bg"
                  />
                  <span className="flex h-10 items-center rounded-xl border border-border/60 bg-muted/30 px-2.5 text-sm font-medium text-muted-foreground">
                    {log.bgUnits}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-[12px] font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setShowMorningBg(true)}
                  data-testid="button-bedtime-outcome-add-morning-bg"
                >
                  Add morning BG
                </button>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button" disabled={busy} onClick={handleSkip} data-testid="button-bedtime-outcome-skip">
            Skip
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={busy || !feel}
            onClick={handleSave}
            data-testid="button-bedtime-outcome-save"
          >
            {busy ? "Saving…" : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
