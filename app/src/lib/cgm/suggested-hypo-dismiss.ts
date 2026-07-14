const STORAGE_KEY = "diabeater_dismissed_cgm_hypo_episodes";
const MAX_IDS = 80;

export function listDismissedCgmHypoEpisodeIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

export function dismissCgmHypoEpisode(id: string): void {
  const next = [id, ...listDismissedCgmHypoEpisodeIds().filter((x) => x !== id)].slice(0, MAX_IDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
}

export function isCgmHypoEpisodeDismissed(id: string): boolean {
  return listDismissedCgmHypoEpisodeIds().includes(id);
}
