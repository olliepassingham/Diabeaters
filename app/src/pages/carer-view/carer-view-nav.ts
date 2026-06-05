export type CarerViewSectionId = "carer-emergency" | "carer-scenarios" | "carer-sick-day-care";

export function scrollToCarerViewSection(
  id: CarerViewSectionId,
  opts?: { block?: ScrollLogicalPosition },
): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: opts?.block ?? "start" });
  if (typeof window !== "undefined") {
    const next = `${window.location.pathname}#${id}`;
    const current = `${window.location.pathname}${window.location.hash}`;
    if (current !== next) {
      window.history.replaceState(null, "", next);
    }
  }
  return true;
}

/** Retry while lazy sections mount (e.g. after progressive supporter load). */
export function scrollToCarerViewHashTarget(hashId: string, attempt = 0): void {
  const id = hashId.replace(/^#/, "") as CarerViewSectionId;
  if (!["carer-emergency", "carer-scenarios", "carer-sick-day-care"].includes(id)) return;
  const found = scrollToCarerViewSection(id, { block: id === "carer-emergency" ? "start" : "nearest" });
  if (!found && attempt < 15) {
    window.setTimeout(() => scrollToCarerViewHashTarget(hashId, attempt + 1), 100);
  }
}
