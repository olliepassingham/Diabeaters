import { describe, expect, it } from "vitest";

import {
  buildFeedbackMailtoHref,
  buildFeedbackRequestText,
  FEEDBACK_EMAIL_SUBJECT,
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
