import { syncAppointments } from "@/lib/appointments-supabase";
import { isOnline } from "@/lib/offline";
import { flushSuppliesOfflineQueue, reconcileSupplies } from "@/lib/supplies";

export type OfflineReconcileResult = {
  supplies: { flushed: number; skippedNewer: number; failed: number };
};

/**
 * Flush queued supply writes, merge cloud/local supplies, and push appointments
 * after connectivity returns. Safe to call on startup (idle) and on `online`.
 */
export async function reconcileAfterBackOnline(): Promise<OfflineReconcileResult> {
  if (!isOnline()) {
    return { supplies: { flushed: 0, skippedNewer: 0, failed: 0 } };
  }

  const supplies = await flushSuppliesOfflineQueue();
  await reconcileSupplies();
  await syncAppointments({ throttleMs: 0 });

  return { supplies };
}
