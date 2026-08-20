import { useCallback, useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createHypoCheckIn,
  fetchHypoCheckInsForCarer,
  friendlyCreateCheckInError,
  isActivePendingHypoCheckIn,
} from "@/lib/hypo-check-ins";
import { cn } from "@/lib/utils";

export function SupporterHypoCheckInButton({
  patientId,
  patientName,
  className,
  prominence = "outline",
}: {
  patientId: string;
  patientName: string;
  className?: string;
  /** primary = brand CTA; urgent = rose (e.g. live low); outline = secondary */
  prominence?: "primary" | "outline" | "urgent";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchHypoCheckInsForCarer(patientId, 3);
      if (!res.error) {
        setHasPending(res.data.some((row) => isActivePendingHypoCheckIn(row)));
      }
    } catch {
      setHasPending(false);
    }
  }, [patientId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const sendCheckIn = async () => {
    setBusy(true);
    const res = await createHypoCheckIn(patientId);
    setBusy(false);
    if (res.error) {
      toast({
        title: "Could not send check-in",
        description: friendlyCreateCheckInError(res.error.message),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Check-in sent",
      description: `${patientName} can reply in their notifications or home screen.`,
    });
    void refresh();
  };

  const variant = hasPending ? "outline" : prominence === "outline" ? "outline" : "default";

  return (
    <Button
      type="button"
      variant={variant}
      className={cn(
        "min-h-10 w-full rounded-xl text-sm font-semibold shadow-none",
        !hasPending &&
          prominence === "urgent" &&
          "border-rose-600/20 bg-rose-600 text-white hover:bg-rose-600/90 dark:border-rose-500/30 dark:bg-rose-700 dark:hover:bg-rose-700/90",
        hasPending &&
          "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground",
        className,
      )}
      disabled={busy || hasPending}
      onClick={() => void sendCheckIn()}
      data-testid="button-supporter-hypo-check-in"
    >
      <HeartHandshake className="mr-2 h-4 w-4 shrink-0" aria-hidden />
      {busy ? "Sending…" : hasPending ? "Waiting for their reply" : "Check they're OK"}
    </Button>
  );
}
