import { useEffect, useState } from "react";
import { Minus, Moon, TrendingDown, TrendingUp, HelpCircle } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dismissBedtimeOutcomePrompt } from "@/lib/bedtime-outcome-prompt";
import { storage, type BedtimeLog, type BedtimeOutcome } from "@/lib/storage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: BedtimeLog | null;
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
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
];

function actionSuggestedLabel(log: BedtimeLog): string | null {
  if (log.actionSuggested === "correction") return "the suggested correction";
  if (log.actionSuggested === "snack") return "the suggested snack";
  return null;
}

export function BedtimeOutcomeCheckinDialog({ open, onOpenChange, log, onSaved }: Props) {
  const { toast } = useToast();
  const [feel, setFeel] = useState<BedtimeOutcome["overnightFeel"] | null>(null);
  const [morningBg, setMorningBg] = useState("");
  const [followedAction, setFollowedAction] = useState<BedtimeOutcome["followedAction"] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFeel(null);
      setMorningBg("");
      setFollowedAction(null);
    }
  }, [open, log?.id]);

  if (!log) return null;

  const askFollowed = actionSuggestedLabel(log) != null;

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
      storage.updateBedtimeLog(log.id, { outcome });
      toast({
        title: "Thanks for the update",
        description: "This helps tailor future bedtime guidance to your own nights.",
      });
      onOpenChange(false);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const checkBgLabel = `${log.currentBg} ${log.bgUnits}`;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md" data-testid="dialog-bedtime-outcome-checkin">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary shrink-0" aria-hidden />
            How did last night go?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-4 text-sm text-muted-foreground">
              <p>
                Your bedtime check was {checkBgLabel}. Tell us what actually happened overnight so future checks can
                reflect your own patterns.
              </p>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Overnight, glucose was mostly…</span>
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
                        "h-10 min-h-0 justify-start gap-1.5 rounded-lg px-2.5 text-xs shadow-none sm:text-sm",
                        feel === value ? "" : "text-muted-foreground",
                      )}
                      onClick={() => setFeel(value)}
                      disabled={busy}
                      data-testid={`button-bedtime-outcome-feel-${value}`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bedtime-outcome-morning-bg" className="text-xs font-medium text-muted-foreground">
                  Actual BG this morning (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="bedtime-outcome-morning-bg"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    placeholder={log.bgUnits === "mmol/L" ? "e.g. 6.5" : "e.g. 115"}
                    value={morningBg}
                    onChange={(e) => setMorningBg(e.target.value)}
                    disabled={busy}
                    className="h-10 flex-1 text-base"
                    data-testid="input-bedtime-outcome-morning-bg"
                  />
                  <span className="flex h-10 items-center rounded-md border border-border/60 bg-muted/30 px-2.5 text-sm font-medium text-muted-foreground">
                    {log.bgUnits}
                  </span>
                </div>
              </div>

              {askFollowed ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Did you follow {actionSuggestedLabel(log)}?
                  </span>
                  <div
                    className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5"
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
                          "h-9 min-h-0 flex-1 rounded-md px-1 text-xs shadow-none sm:text-sm",
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

              <p className="text-xs italic">
                Educational only — this never changes how your correction dose is calculated.
              </p>
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
