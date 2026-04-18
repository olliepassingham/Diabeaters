/**
 * Open an external HTTPS URL in a new browser tab (after in-app preview).
 * Keeps the app tab active; use with rel="noopener" semantics via window features.
 */
export function openExternalUrl(url: string): void {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) {
    opened.opener = null;
  }
}
