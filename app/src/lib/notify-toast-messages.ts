/** Shared copy when Edge Function notify invocations fail (deploy / network / config). */
export const NOTIFY_EDGE_FAILURE_TITLE = "Could not send alerts";

export const NOTIFY_EDGE_FAILURE_DESCRIPTION =
  "Check that Supabase Edge Functions are deployed and your network is available. See project README (Notifications / Edge Functions).";

/** Prefer server / client detail (e.g. 404, sign-in) so the toast is actionable; fall back to README copy. */
export function notifyEdgeFailureDescription(res: {
  detail?: string;
  error?: string;
}): string {
  if (res.detail) return res.detail;
  if (res.error === "supabase_not_configured") {
    return "Supabase is not configured. Alerts were not sent.";
  }
  return NOTIFY_EDGE_FAILURE_DESCRIPTION;
}
