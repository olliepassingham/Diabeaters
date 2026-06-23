export function isPatientUpgradeOnboarding(search: string): boolean {
  return new URLSearchParams(search).get("upgrade") === "1";
}
