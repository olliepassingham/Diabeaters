import { useState, useEffect, useCallback } from "react";

export type ReleaseMode = "full" | "appstore";

const STORAGE_KEY = "diabeater_release_mode";

export function getReleaseMode(): ReleaseMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "appstore") return "appstore";
  return "full";
}

export function setReleaseMode(mode: ReleaseMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent("release-mode-changed", { detail: mode }));
}

export function isBetaVisible(): boolean {
  return getReleaseMode() === "full";
}

export function useReleaseMode() {
  const [mode, setMode] = useState<ReleaseMode>(getReleaseMode);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ReleaseMode>;
      setMode(custom.detail);
    };
    window.addEventListener("release-mode-changed", handler);
    return () => window.removeEventListener("release-mode-changed", handler);
  }, []);

  const toggle = useCallback(() => {
    const next: ReleaseMode = mode === "full" ? "appstore" : "full";
    setReleaseMode(next);
    setMode(next);
  }, [mode]);

  const set = useCallback((m: ReleaseMode) => {
    setReleaseMode(m);
    setMode(m);
  }, []);

  return {
    mode,
    isAppStore: mode === "appstore",
    isFull: mode === "full",
    isBetaVisible: mode === "full",
    toggle,
    setMode: set,
  };
}
