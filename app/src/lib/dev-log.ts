/** Logs only in development — avoids noisy production consoles. */
export function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) console.warn(...args);
}

/**
 * Edge Function invoke failures (push delivery, etc.): always log so Safari / on-device
 * WebView logs capture issues in production when APNs or the gateway misbehaves.
 */
export function logEdgeInvokeFailure(scope: string, message: string | undefined): void {
  if (message) console.warn(`[edge-invoke ${scope}]`, message);
}
