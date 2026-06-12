import { isOnline } from "@/lib/offline";

const CHUNK_RECOVERY_KEY = "diabeater-chunk-recovery-attempted";

export function isLazyChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

function shouldAttemptChunkRecovery(error: Error | null): boolean {
  if (!error || !isLazyChunkLoadError(error)) return false;
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1") {
    return false;
  }
  return true;
}

/** Whether a failed lazy route should trigger an automatic reload (never when offline). */
export function shouldReloadAfterChunkError(error: Error | null): boolean {
  return shouldAttemptChunkRecovery(error) && isOnline();
}

export function markChunkRecoveryAttempted(): void {
  try {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}
