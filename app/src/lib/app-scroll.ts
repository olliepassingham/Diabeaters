/** Scroll container for authenticated app routes (`App.tsx` main shell). */
export const APP_SCROLL_MAIN_ID = "app-scroll-main";

export function getAppScrollMain(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(APP_SCROLL_MAIN_ID);
}

export function getAppScrollTop(): number {
  const el = getAppScrollMain();
  return el ? el.scrollTop : (typeof window !== "undefined" ? window.scrollY : 0);
}

export function setAppScrollTop(top: number, behavior: ScrollBehavior = "auto"): void {
  const el = getAppScrollMain();
  if (el) {
    el.scrollTo({ top, left: 0, behavior });
    return;
  }
  if (typeof window !== "undefined") {
    window.scrollTo({ top, left: 0, behavior });
  }
}
