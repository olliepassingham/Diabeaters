import type { ReactElement } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  notifyHypoCloudLogged,
  storage,
} from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import { insertHypoLog } from "@/lib/hypo-logs-supabase";
import { invokeNotifyCarersOnHypo } from "@/lib/invoke-notify-carers-hypo";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { listCarerLinksForPatient } from "@/lib/carers";

type ToastLike = ReturnType<typeof useToast>["toast"];

export async function runHypoTreatmentPipeline(
  fields: { glucoseInput: string; treatment: string; notes: string },
  ctx: {
    userId: string | undefined;
    toast: ToastLike;
    onAfterLocalSave?: () => void;
    onOpenFamilySupporters?: () => void;
  },
): Promise<void> {
  const glucoseLevel = fields.glucoseInput.trim() ? parseFloat(fields.glucoseInput) : undefined;
  const treatment = fields.treatment.trim() || undefined;
  const notes = fields.notes.trim() || undefined;

  const created = storage.addHypoTreatment({
    timestamp: new Date().toISOString(),
    glucoseLevel,
    treatment,
    notes,
    carerNotified: false,
  });

  ctx.onAfterLocalSave?.();

  let description = "Saved to your hypo history.";
  let toastAction: ReactElement | undefined;
  let notifyInvokeFailed = false;
  let notifyFailure: { detail?: string; error?: string } | null = null;

  if (ctx.userId && getSupabase()) {
    const cloud = await insertHypoLog({
      blood_glucose: created.glucoseLevel ?? null,
      treatment: created.treatment ?? null,
      notes: created.notes ?? null,
    });

    if (cloud.data) {
      storage.patchHypoTreatment(created.id, { supabaseHypoLogId: cloud.data.id });
      notifyHypoCloudLogged({ hypoLogId: cloud.data.id });
      const notify = await invokeNotifyCarersOnHypo({
        hypoId: cloud.data.id,
        userId: ctx.userId,
      });

      if (!notify.success) {
        notifyInvokeFailed = true;
        notifyFailure = notify;
      } else {
        const eligible = notify.eligible_carers ?? 0;
        const delivered = (notify.delivered_push ?? 0) + (notify.delivered_inapp ?? 0);

        if (eligible > 0 && delivered > 0) {
          storage.updateHypoTreatmentCarerNotified(created.id, true);
          description =
            eligible === 1 ? "Your supporter has been notified." : "Your supporters have been notified.";
        } else if (eligible > 0 && delivered === 0) {
          description =
            "Hypo logged. No alerts were delivered — ask your supporter to enable push in Diabeaters (Settings → Notifications) on their phone.";
        } else if (eligible === 0) {
          const links = await listCarerLinksForPatient();
          const linkedCount = links.data?.length ?? 0;
          if (linkedCount === 0) {
            description =
              "Saved to your history. Link a supporter if you want someone alerted next time.";
            if (ctx.onOpenFamilySupporters) {
              toastAction = (
                <ToastAction altText="Link a supporter" onClick={ctx.onOpenFamilySupporters}>
                  Link supporter
                </ToastAction>
              );
            }
          } else {
            description =
              "Saved to your record. Linked supporters did not get an alert — turn on Hypo logs sharing in Family & supporters.";
            if (ctx.onOpenFamilySupporters) {
              toastAction = (
                <ToastAction altText="Open Family and supporters" onClick={ctx.onOpenFamilySupporters}>
                  Check sharing
                </ToastAction>
              );
            }
          }
        }
      }
    } else {
      description =
        "Saved on this device. Cloud log failed — sign in again and retry if supporters should be notified.";
    }
  }

  ctx.toast({
    title: "Hypo treatment logged",
    description,
    action: toastAction,
  });
  if (notifyInvokeFailed && notifyFailure) {
    ctx.toast({
      title: NOTIFY_EDGE_FAILURE_TITLE,
      description: notifyEdgeFailureDescription(notifyFailure),
      variant: "destructive",
    });
  }
}
