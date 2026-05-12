/** Per-device unlock for Settings → Notifications → “Send test push” when the app loads JS from Vercel (Capacitor `server.url`). */
export const PUSH_TEST_UI_STORAGE_KEY = "diabeaters_enable_push_test_ui_v1";

export function isPushTestUiUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PUSH_TEST_UI_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockPushTestUi(): void {
  try {
    localStorage.setItem(PUSH_TEST_UI_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}
