import { describe, expect, it } from "vitest";

import {
  buildFeedbackMailtoHref,
  buildFeedbackRequestText,
  buildFeedbackSubmissionInsert,
  feedbackSubmitUnavailableDescription,
  FEEDBACK_EMAIL_SUBJECT,
  FEEDBACK_MIN_MESSAGE_LENGTH,
  isFeedbackMessageLongEnough,
  isFeedbackSubmissionsTableUnavailableMessage,
} from "@/lib/feedback";

describe("feedback", () => {
  it("builds request text with message and context", () => {
    const text = buildFeedbackRequestText({
      kind: "suggestion",
      message: "Bedtime reminder time picker could start at 9pm.",
      appVersion: "1.0.6",
      region: "UK",
      userEmail: "user@example.com",
      userId: "uid-1",
      pagePath: "/settings/feedback",
    });
    expect(text).toContain("suggestion to improve");
    expect(text).toContain("Bedtime reminder");
    expect(text).toContain("App version: 1.0.6");
    expect(text).toContain("Region: UK");
    expect(text).toContain("user@example.com");
  });

  it("isFeedbackMessageLongEnough enforces minimum length", () => {
    expect(FEEDBACK_MIN_MESSAGE_LENGTH).toBe(8);
    expect(isFeedbackMessageLongEnough("testing")).toBe(false);
    expect(isFeedbackMessageLongEnough("testing!")).toBe(true);
  });

  it("buildFeedbackSubmissionInsert maps app fields to table columns", () => {
    const row = buildFeedbackSubmissionInsert({
      userId: "uid-1",
      kind: "bug",
      message: "Sync failed after login.",
      appVersion: "1.0.6",
      region: "UK",
      userEmail: "user@example.com",
      pagePath: "/settings/feedback",
    });
    expect(row).toEqual({
      user_id: "uid-1",
      kind: "bug",
      message: "Sync failed after login.",
      app_version: "1.0.6",
      platform: "Web",
      region: "UK",
      page_path: "/settings/feedback",
      email: "user@example.com",
    });
  });

  it("isFeedbackSubmissionsTableUnavailableMessage detects PostgREST schema cache errors", () => {
    expect(
      isFeedbackSubmissionsTableUnavailableMessage(
        "Could not find the table 'public.feedback_submissions' in the schema cache",
      ),
    ).toBe(true);
    expect(isFeedbackSubmissionsTableUnavailableMessage("permission denied")).toBe(false);
    expect(feedbackSubmitUnavailableDescription().length).toBeGreaterThan(20);
  });

  it("buildFeedbackMailtoHref includes subject for bug reports", () => {
    const href = buildFeedbackMailtoHref({
      kind: "bug",
      message: "Sync failed after login.",
      appVersion: "1.0.6",
      supportEmail: "support@example.com",
    });
    expect(href).toMatch(/^mailto:support@example.com\?/);
    const query = href.split("?")[1] ?? "";
    expect(new URLSearchParams(query).get("subject")).toBe(FEEDBACK_EMAIL_SUBJECT.bug);
    expect(new URLSearchParams(query).get("body")).toContain("Sync failed");
  });
});
