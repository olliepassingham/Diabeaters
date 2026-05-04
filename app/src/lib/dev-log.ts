/** Logs only in development — avoids noisy production consoles. */
export function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) console.warn(...args);
}
