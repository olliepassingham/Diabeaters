import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_EMAIL_SUBJECT,
  accountDeletionSubmitUnavailableDescription,
  buildAccountDeletionMailtoHref,
  buildGmailWebComposeUrl,
  isAccountDeletionTableUnavailableMessage,
} from "./support";

describe("support / account deletion URLs", () => {
  const params = {
    supportEmail: "support@example.com",
    userEmail: "user@example.com",
    userId: "uuid-uid",
  };

  it("buildGmailWebComposeUrl points at Gmail mail with compose params", () => {
    const url = buildGmailWebComposeUrl(params);
    const u = new URL(url);
    expect(u.hostname).toBe("mail.google.com");
    expect(u.searchParams.get("view")).toBe("cm");
    expect(u.searchParams.get("fs")).toBe("1");
    expect(u.searchParams.get("to")).toBe(params.supportEmail);
    expect(u.searchParams.get("su")).toBe(ACCOUNT_DELETION_EMAIL_SUBJECT);
    expect(u.searchParams.get("body")).toContain("user@example.com");
    expect(u.searchParams.get("body")).toContain("uuid-uid");
  });

  it("buildAccountDeletionMailtoHref is a mailto with subject and body", () => {
    const href = buildAccountDeletionMailtoHref(params);
    expect(href).toMatch(/^mailto:/);
    expect(href).toContain("subject=");
    expect(href).toContain("body=");
  });

  it("isAccountDeletionTableUnavailableMessage detects PostgREST schema cache errors", () => {
    expect(
      isAccountDeletionTableUnavailableMessage(
        "Could not find the table 'public.account_deletion_requests' in the schema cache",
      ),
    ).toBe(true);
    expect(isAccountDeletionTableUnavailableMessage("permission denied")).toBe(false);
    expect(accountDeletionSubmitUnavailableDescription().length).toBeGreaterThan(20);
  });
});
