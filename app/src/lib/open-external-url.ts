import { Browser } from "@capacitor/browser";

import { isCapacitorNativeShell } from "@/lib/native-platform";

function openInWindow(url: string): void {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) {
    opened.opener = null;
  }
}

/**
 * Open an external HTTPS URL outside the app shell.
 * Native: system browser / SFSafariViewController via @capacitor/browser.
 * Web: new tab via window.open.
 */
export function openExternalUrl(url: string): void {
  if (isCapacitorNativeShell()) {
    void Browser.open({ url }).catch(() => {
      openInWindow(url);
    });
    return;
  }
  openInWindow(url);
}
