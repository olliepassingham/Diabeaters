let prefetchedScenariosBundle = false;

/**
 * Guides ship in the main entry chunk (`offline-guides-entry.ts`).
 * Kept as a no-op hook for callers that warm routes after login.
 */
export function prefetchScenariosHubAndRoutes(): void {
  prefetchedScenariosBundle = true;
}
