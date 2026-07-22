import { describe, expect, it } from "vitest";
import { canDeleteUnreadDmMessage, canEditUnreadDmMessage } from "./dm-message-delete";

describe("dm-message-delete re-exports", () => {
  it("keeps canDeleteUnreadDmMessage available", () => {
    expect(
      canDeleteUnreadDmMessage(
        { sender_id: "me", read_at: null, deleted_at: null, body: "hi", image_storage_path: null },
        "me",
      ),
    ).toBe(true);
  });

  it("keeps canEditUnreadDmMessage available", () => {
    expect(
      canEditUnreadDmMessage(
        { sender_id: "me", read_at: null, deleted_at: null, body: "hi", image_storage_path: null },
        "me",
      ),
    ).toBe(true);
  });
});
