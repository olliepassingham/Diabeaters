import { useCallback, useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createHypoCheckIn,
  fetchHypoCheckInsForCarer,
  friendlyCreateCheckInError,
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
  prominence?: "primary" | "outline";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetchHypoCheckInsForCarer(patientId, 3);
    if (!res.error) {
      setHasPending(res.data.some((row) => row.status === "pending"));
    }
  }, [patientId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
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

  return (
    <Button
      type="button"
      variant={prominence === "primary" ? "default" : "outline"}
      className={cn(
        "min-h-10 w-full rounded-xl text-sm font-semibold shadow-none",
        prominence === "primary" &&
          "border-rose-600/20 bg-rose-600 text-white hover:bg-rose-600/90 dark:border-rose-500/30 dark:bg-rose-700 dark:hover:bg-rose-700/90",
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
