let prefetchedScenariosBundle = false;

/** Warm guide screens after the shell has painted. The service worker keeps the files for offline use. */
export function prefetchScenariosHubAndRoutes(): void {
  if (prefetchedScenariosBundle) return;
  prefetchedScenariosBundle = true;
  void import("@/pages/scenarios");
  void import("@/pages/scenarios/exercise");
  void import("@/pages/scenarios/alcohol");
  void import("@/pages/scenarios/driving");
  void import("@/pages/scenarios/pump-failure");
  void import("@/pages/bedtime");
  void import("@/pages/sick-day");
  void import("@/pages/travel");
  void import("@/pages/tools/index");
}
