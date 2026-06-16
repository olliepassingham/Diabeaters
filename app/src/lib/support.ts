/**
 * Public support contact for in-app mailto and copy-to-clipboard flows.
 * Override with `VITE_SUPPORT_EMAIL` in the Vite env when a deployment needs a different address.
 */
const DEFAULT_SUPPORT_EMAIL = "info@diabeaters.world";

export function getSupportEmail(): string {
  const v = import.meta.env.VITE_SUPPORT_EMAIL;
  if (typeof v === "string" && v.trim()) return v.trim();
  return DEFAULT_SUPPORT_EMAIL;
}

export const ACCOUNT_DELETION_EMAIL_SUBJECT = "Account deletion request";

export function buildAccountDeletionRequestText(params: {
  userEmail: string;
  userId: string;
}): string {
  return [
    "Please delete my Diabeaters account and associated data.",
    "",
    `Account email: ${params.userEmail}`,
    `User ID: ${params.userId}`,
    "",
    "Thank you.",
  ].join("\n");
}

/** RFC 6068-style mailto with subject + body query (URLSearchParams encoding). */
export function buildAccountDeletionMailtoHref(params: {
  supportEmail: string;
  userEmail: string;
  userId: string;
}): string {
  const body = buildAccountDeletionRequestText({
    userEmail: params.userEmail,
    userId: params.userId,
  });
  const q = new URLSearchParams({ subject: ACCOUNT_DELETION_EMAIL_SUBJECT, body });
  return `mailto:${params.supportEmail}?${q.toString()}`;
}

/**
 * Opens Gmail compose in the browser (avoids the OS default desktop client, e.g. Outlook on Windows).
 */
export function buildGmailWebComposeUrl(params: {
  supportEmail: string;
  userEmail: string;
  userId: string;
}): string {
  const body = buildAccountDeletionRequestText({
    userEmail: params.userEmail,
    userId: params.userId,
  });
  const u = new URL("https://mail.google.com/mail/");
  u.searchParams.set("view", "cm");
  u.searchParams.set("fs", "1");
  u.searchParams.set("to", params.supportEmail);
  u.searchParams.set("su", ACCOUNT_DELETION_EMAIL_SUBJECT);
  u.searchParams.set("body", body);
  return u.toString();
}

/** PostgREST / Supabase when the table was never migrated or API schema cache is stale. */
export function isAccountDeletionTableUnavailableMessage(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  if (!m) return false;
  if (m.includes("schema cache") && m.includes("account_deletion")) return true;
  if (m.includes("account_deletion_requests") && (m.includes("does not exist") || m.includes("not find"))) return true;
  if (m.includes("pgrst205") || m.includes("could not find the table")) return true;
  return false;
}

export function accountDeletionSubmitUnavailableDescription(): string {
  return "Expand “Other ways to contact support” below to copy the request or email us instead.";
}
