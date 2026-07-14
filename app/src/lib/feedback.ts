import { getDevicePlatform } from "@/lib/native-platform";
import { getSupportEmail } from "@/lib/support";

export type FeedbackKind = "suggestion" | "bug";

export const FEEDBACK_EMAIL_SUBJECT: Record<FeedbackKind, string> = {
  suggestion: "Diabeaters feedback — suggestion",
  bug: "Diabeaters feedback — bug report",
};

export function feedbackPlatformLabel(): string {
  try {
    const platform = getDevicePlatform();
    if (platform === "ios") return "iOS";
    if (platform === "android") return "Android";
    return "Web";
  } catch {
    return "Web";
  }
}

export function buildFeedbackContextLines(params: {
  appVersion: string;
  region?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  pagePath?: string | null;
}): string[] {
  const lines = [
    "---",
    "Context (please leave this in — it helps us fix issues faster)",
    `App version: ${params.appVersion}`,
    `Platform: ${feedbackPlatformLabel()}`,
  ];
  if (params.region) lines.push(`Region: ${params.region}`);
  if (params.userEmail) lines.push(`Account email: ${params.userEmail}`);
  if (params.userId) lines.push(`User ID: ${params.userId}`);
  if (params.pagePath) lines.push(`Page: ${params.pagePath}`);
  return lines;
}

export function buildFeedbackRequestText(params: {
  kind: FeedbackKind;
  message: string;
  appVersion: string;
  region?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  pagePath?: string | null;
}): string {
  const intro =
    params.kind === "bug"
      ? "I ran into a problem in Diabeaters:"
      : "I have a suggestion to improve Diabeaters:";
  return [intro, "", params.message.trim(), "", ...buildFeedbackContextLines(params)].join("\n");
}

export function buildFeedbackMailtoHref(params: {
  kind: FeedbackKind;
  message: string;
  appVersion: string;
  region?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  pagePath?: string | null;
  supportEmail?: string;
}): string {
  const supportEmail = params.supportEmail ?? getSupportEmail();
  const body = buildFeedbackRequestText(params);
  const q = new URLSearchParams({ subject: FEEDBACK_EMAIL_SUBJECT[params.kind], body });
  return `mailto:${supportEmail}?${q.toString()}`;
}

export const FEEDBACK_MIN_MESSAGE_LENGTH = 8;

export function isFeedbackMessageLongEnough(message: string): boolean {
  return message.trim().length >= FEEDBACK_MIN_MESSAGE_LENGTH;
}

/** PostgREST / Supabase when the table was never migrated or API schema cache is stale. */
export function isFeedbackSubmissionsTableUnavailableMessage(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  if (!m) return false;
  if (m.includes("schema cache") && m.includes("feedback_submissions")) return true;
  if (m.includes("feedback_submissions") && (m.includes("does not exist") || m.includes("not find"))) return true;
  if (m.includes("pgrst205") || m.includes("could not find the table")) return true;
  return false;
}

export function feedbackSubmitUnavailableDescription(): string {
  return "Use Copy message or the email options below. If you manage this app, apply the Supabase migration that creates public.feedback_submissions (see supabase/migrations).";
}

export function buildFeedbackSubmissionInsert(params: {
  userId: string;
  kind: FeedbackKind;
  message: string;
  appVersion: string;
  region?: string | null;
  userEmail?: string | null;
  pagePath?: string | null;
}) {
  return {
    user_id: params.userId,
    kind: params.kind,
    message: params.message.trim(),
    app_version: params.appVersion,
    platform: feedbackPlatformLabel(),
    region: params.region?.trim() || null,
    page_path: params.pagePath?.trim() || null,
    email: params.userEmail?.trim() || null,
  };
}

export function buildFeedbackGmailWebComposeUrl(params: {
  kind: FeedbackKind;
  message: string;
  appVersion: string;
  region?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  pagePath?: string | null;
  supportEmail?: string;
}): string {
  const supportEmail = params.supportEmail ?? getSupportEmail();
  const body = buildFeedbackRequestText(params);
  const u = new URL("https://mail.google.com/mail/");
  u.searchParams.set("view", "cm");
  u.searchParams.set("fs", "1");
  u.searchParams.set("to", supportEmail);
  u.searchParams.set("su", FEEDBACK_EMAIL_SUBJECT[params.kind]);
  u.searchParams.set("body", body);
  return u.toString();
}
