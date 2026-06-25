import { useEffect, useState } from "react";
import { CheckCircle2, Droplet, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  respondHypoCheckIn,
  setPendingHypoCheckInForLog,
  consumePendingHypoCheckInForLog,
  type HypoCheckInResponse,
} from "@/lib/hypo-check-ins";
import {
  DIABEATER_HYPO_CLOUD_LOGGED_EVENT,
  DIABEATER_OPEN_HYPO_DIALOG_EVENT,
  type HypoCloudLoggedDetail,
} from "@/lib/storage";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type HypoCheckInResponseActionsProps = {
  checkInId: string;
  carerName?: string;
  compact?: boolean;
  className?: string;
  onResponded?: () => void;
};

export function HypoCheckInResponseActions({
  checkInId,
  carerName = "Your supporter",
  compact = false,
  className,
  onResponded,
}: HypoCheckInResponseActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<HypoCheckInResponse | "log" | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onHypoLogged = (event: Event) => {
      const pendingId = consumePendingHypoCheckInForLog();
      if (!pendingId || pendingId !== checkInId) return;
      const detail = (event as CustomEvent<HypoCloudLoggedDetail>).detail;
      const hypoLogId = detail?.hypoLogId?.trim();
      if (!hypoLogId) return;
      void (async () => {
        setBusy("hypo_logged");
        const res = await respondHypoCheckIn({
          checkInId,
          response: "hypo_logged",
          hypoLogId,
        });
        setBusy(null);
        if (res.error) {
          toast({
            title: "Could not update check-in",
            description: res.error.message,
            variant: "destructive",
          });
          return;
        }
        void hapticLight();
        setDone(true);
        onResponded?.();
        toast({ title: "Reply sent", description: `${carerName} will see that you logged a hypo.` });
      })();
    };

    window.addEventListener(DIABEATER_HYPO_CLOUD_LOGGED_EVENT, onHypoLogged);
    return () => window.removeEventListener(DIABEATER_HYPO_CLOUD_LOGGED_EVENT, onHypoLogged);
  }, [carerName, checkInId, onResponded, toast]);

  const respond = async (response: HypoCheckInResponse) => {
    setBusy(response);
    const res = await respondHypoCheckIn({ checkInId, response });
    setBusy(null);
    if (res.error) {
      toast({
        title: "Could not send reply",
        description: res.error.message,
        variant: "destructive",
      });
      return;
    }
    void hapticLight();
    setDone(true);
    onResponded?.();
    toast({
      title: "Reply sent",
      description: `${carerName} will see your update.`,
    });
  };

  const openLogHypo = () => {
    setPendingHypoCheckInForLog(checkInId);
    setBusy("log");
    window.dispatchEvent(new Event(DIABEATER_OPEN_HYPO_DIALOG_EVENT));
    window.setTimeout(() => setBusy(null), 400);
  };

  if (done) {
    return (
      <p className={cn("text-xs font-medium text-emerald-700 dark:text-emerald-400", className)}>
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Reply sent
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", compact ? "" : "sm:flex-row sm:flex-wrap", className)}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 rounded-full px-3 text-xs"
        disabled={busy != null}
        onClick={(e) => {
          e.stopPropagation();
          void respond("ok");
        }}
        data-testid={`hypo-check-in-ok-${checkInId}`}
      >
        {busy === "ok" ? "Sending…" : "I'm OK"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 rounded-full px-3 text-xs"
        disabled={busy != null}
        onClick={(e) => {
          e.stopPropagation();
          void respond("treating");
        }}
        data-testid={`hypo-check-in-treating-${checkInId}`}
      >
        {busy === "treating" ? "Sending…" : "I'm treating it"}
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 rounded-full px-3 text-xs"
        disabled={busy != null}
        onClick={(e) => {
          e.stopPropagation();
          openLogHypo();
        }}
        data-testid={`hypo-check-in-log-${checkInId}`}
      >
        <Droplet className="mr-1 h-3.5 w-3.5" aria-hidden />
        {busy === "log" ? "Opening…" : "Log hypo"}
      </Button>
    </div>
  );
}

export function HypoCheckInPrompt({
  carerName,
  className,
}: {
  carerName: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <HeartHandshake className="h-4 w-4" aria-hidden />
      </span>
      <p className="text-sm leading-snug text-foreground">
        <span className="font-semibold">{carerName}</span> is checking you&apos;re OK — are you aware of a possible
        hypo?
      </p>
    </div>
  );
}
