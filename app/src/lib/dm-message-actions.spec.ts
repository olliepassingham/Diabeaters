import { describe, expect, it } from "vitest";
import { canDeleteUnreadDmMessage, canEditUnreadDmMessage } from "./dm-message-actions";

const base = {
  sender_id: "me",
  read_at: null as string | null,
  deleted_at: null as string | null,
  body: "hello",
  image_storage_path: null as string | null,
  edited_at: null as string | null,
};

describe("canDeleteUnreadDmMessage", () => {
  it("allows the sender to delete their own unread message", () => {
    expect(canDeleteUnreadDmMessage(base, "me")).toBe(true);
  });

  it("blocks delete once the recipient has read it", () => {
    expect(canDeleteUnreadDmMessage({ ...base, read_at: "2026-07-22T10:00:00.000Z" }, "me")).toBe(false);
  });

  it("blocks delete for someone else's message", () => {
    expect(canDeleteUnreadDmMessage(base, "them")).toBe(false);
  });

  it("blocks delete when already soft-deleted", () => {
    expect(canDeleteUnreadDmMessage({ ...base, deleted_at: "2026-07-22T10:00:00.000Z" }, "me")).toBe(false);
  });

  it("blocks delete with an empty viewer id", () => {
    expect(canDeleteUnreadDmMessage(base, "")).toBe(false);
  });
});

describe("canEditUnreadDmMessage", () => {
  it("allows editing own unread text messages", () => {
    expect(canEditUnreadDmMessage(base, "me")).toBe(true);
  });

  it("blocks edit once read", () => {
    expect(canEditUnreadDmMessage({ ...base, read_at: "2026-07-22T10:00:00.000Z" }, "me")).toBe(false);
  });

  it("blocks edit for image-only messages with no caption", () => {
    expect(
      canEditUnreadDmMessage({ ...base, body: "   ", image_storage_path: "me/dm/t/a.jpg" }, "me"),
    ).toBe(false);
  });

  it("allows editing a caption on an image message", () => {
    expect(
      canEditUnreadDmMessage({ ...base, body: "nice shot", image_storage_path: "me/dm/t/a.jpg" }, "me"),
    ).toBe(true);
  });

  it("blocks edit for shared feed/story cards", () => {
    expect(canEditUnreadDmMessage(base, "me", { isSharedContent: true })).toBe(false);
  });

  it("still allows delete for shared content even when edit is blocked", () => {
    expect(canDeleteUnreadDmMessage(base, "me")).toBe(true);
    expect(canEditUnreadDmMessage(base, "me", { isSharedContent: true })).toBe(false);
  });
});
