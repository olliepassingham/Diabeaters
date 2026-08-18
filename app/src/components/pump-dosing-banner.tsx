import { Syringe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { closedLoopSafetyNote, usesClosedLoop } from "@/lib/closed-loop";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function PumpDosingBanner({
  className,
  testId = "banner-pump-dosing",
  compact,
}: {
  className?: string;
  testId?: string;
  compact?: boolean;
}) {
  const profile = storage.getProfile();
  if (!isPumpDeliveryMethod(profile?.insulinDeliveryMethod)) return null;

  const settings = storage.getSettings();
  const closedLoop = usesClosedLoop(settings);
  const loopNote = closedLoopSafetyNote("correction", settings);

  return (
    <Alert
      className={cn(
        "border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20",
        compact && "p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6",
        className,
      )}
      data-testid={testId}
    >
      <Syringe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      <AlertDescription className={cn("text-indigo-950 dark:text-indigo-100", compact && "text-xs leading-snug")}>
        <strong className="font-semibold">Pump user:</strong> Program boluses on your pump and check{" "}
        <strong className="font-semibold">IOB</strong> before corrections. Numbers here are planning aids only
        {closedLoop ? " — closed-loop automation may suggest different amounts." : "."}
        {loopNote ? <span className="mt-1 block">{loopNote}</span> : null}
      </AlertDescription>
    </Alert>
  );
}
