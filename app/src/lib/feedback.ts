import { Capacitor } from "@capacitor/core";

import { getSupportEmail } from "@/lib/support";

export type FeedbackKind = "suggestion" | "bug";

export const FEEDBACK_EMAIL_SUBJECT: Record<FeedbackKind, string> = {
  suggestion: "Diabeaters feedback — suggestion",
  bug: "Diabeaters feedback — bug report",
};

export function feedbackPlatformLabel(): string {
  try {
    const platform = Capacitor.getPlatform();
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
