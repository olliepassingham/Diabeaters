let prefetchedScenariosBundle = false;

/**
 * Warm the guides hub and every scenario detail chunk so offline navigation works
 * after at least one online session post-login.
 */
export function prefetchScenariosHubAndRoutes(): void {
  if (prefetchedScenariosBundle) return;
  prefetchedScenariosBundle = true;
  void import("@/pages/scenarios");
  void import("@/pages/scenarios/exercise");
  void import("@/pages/bedtime");
  void import("@/pages/sick-day");
  void import("@/pages/travel");
  void import("@/pages/scenarios/alcohol");
  void import("@/pages/scenarios/driving");
  void import("@/pages/scenarios/pump-failure");
}
