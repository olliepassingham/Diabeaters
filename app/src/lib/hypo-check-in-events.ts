/** Dispatched to open the dashboard hypo log dialog. */
export const DIABEATER_OPEN_HYPO_DIALOG_EVENT = "diabeater-open-hypo-dialog";

/** Opens the dashboard hypo log dialog (home + `?hypo_log=1`). */
export const HYPO_LOG_DEEP_LINK = "/?hypo_log=1";

export function isHypoLogDeepLink(path: string): boolean {
  const raw = path.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw, "https://app.diabeaters.local");
    return url.pathname === "/" && url.searchParams.get("hypo_log") === "1";
  } catch {
    return raw === HYPO_LOG_DEEP_LINK;
  }
}
