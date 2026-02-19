export type ReleaseMode = "full" | "appstore";

export function getReleaseMode(): ReleaseMode {
  const envMode = import.meta.env.VITE_RELEASE_MODE;
  if (envMode === "full") return "full";
  return "appstore";
}

export function isBetaVisible(): boolean {
  return getReleaseMode() === "full";
}

export function useReleaseMode() {
  const mode = getReleaseMode();

  return {
    mode,
    isAppStore: mode === "appstore",
    isFull: mode === "full",
    isBetaVisible: mode === "full",
  };
}
