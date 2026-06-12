import { getQueueLength } from "./offline";

/** Top-of-app offline banner — home, guides, and tools stay available from local storage. */
export const OFFLINE_BANNER_BASE =
  "You're offline. Home, guides, and tools use data saved on this device.";

/** Compact notice on individual pages (dashboard, guides hub, tools hub). */
export const OFFLINE_DEVICE_NOTICE =
  "You're offline — what you see is saved on this device. Beatie and the community feed need the internet.";

/** Supplies page — edits are kept locally and queued for cloud sync. */
export const OFFLINE_SUPPLIES_NOTICE =
  "You're offline. Stock changes are saved on this device and will sync when you're back online.";

export function offlineQueuedChangesLabel(count: number): string {
  if (count <= 0) return "";
  return `${count} change${count === 1 ? "" : "s"} will sync when you're back online`;
}

export function offlineBannerQueuedSuffix(count: number): string | null {
  const label = offlineQueuedChangesLabel(count);
  return label ? label : null;
}

export function readOfflineQueuedCount(): number {
  return getQueueLength();
}

export type OfflineReconcileToast = {
  title: string;
  description: string;
  variant?: "destructive";
};

/** User-facing toasts after a back-online reconcile pass. */
export function offlineReconcileToasts(result: {
  flushed: number;
  skippedNewer: number;
  failed: number;
}): OfflineReconcileToast[] {
  const toasts: OfflineReconcileToast[] = [];
  if (result.flushed > 0) {
    toasts.push({
      title: "Back online",
      description: `${result.flushed} queued change${result.flushed === 1 ? "" : "s"} synced to your account.`,
    });
  }
  if (result.skippedNewer > 0) {
    toasts.push({
      title: "Some changes skipped",
      description: `${result.skippedNewer} queued change${result.skippedNewer === 1 ? "" : "s"} were skipped because a newer version exists on the server.`,
    });
  }
  if (result.failed > 0) {
    toasts.push({
      title: "Sync incomplete",
      description: "Some queued changes could not be synced yet. We'll retry when you're online.",
      variant: "destructive",
    });
  }
  return toasts;
}

export const OFFLINE_SUPPLY_QUEUED_TOAST = {
  title: "Saved on this device",
  description: "Change saved locally — it will sync when you're back online.",
} as const;

export const OFFLINE_SUPPLY_RETRY_TOAST = {
  title: "Couldn't sync",
  description: "Couldn't sync now; will retry automatically.",
  variant: "destructive" as const,
};
