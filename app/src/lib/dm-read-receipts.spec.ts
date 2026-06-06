import { describe, expect, it } from "vitest";

import type { DmMessageRow } from "@/lib/community/types";
import {
  formatReadReceiptTime,
  latestReadOutgoingMessageId,
  readReceiptStatusForMessage,
} from "./dm-read-receipts";

function msg(partial: Partial<DmMessageRow> & Pick<DmMessageRow, "id" | "sender_id">): DmMessageRow {
  return {
    thread_id: "t1",
    body: "hi",
    created_at: "2025-06-01T12:00:00.000Z",
    read_at: null,
    image_storage_path: null,
    ...partial,
  };
}

describe("dm-read-receipts", () => {
  it("returns null for incoming messages", () => {
    expect(readReceiptStatusForMessage(msg({ id: "1", sender_id: "peer" }), "me")).toBeNull();
  });

  it("returns sent vs read for outgoing messages", () => {
    expect(readReceiptStatusForMessage(msg({ id: "1", sender_id: "me" }), "me")).toBe("sent");
    expect(
      readReceiptStatusForMessage(msg({ id: "1", sender_id: "me", read_at: "2025-06-01T12:05:00.000Z" }), "me"),
    ).toBe("read");
  });

  it("finds latest read outgoing message", () => {
    const messages = [
      msg({ id: "a", sender_id: "me" }),
      msg({ id: "b", sender_id: "me", read_at: "2025-06-01T12:01:00.000Z" }),
      msg({ id: "c", sender_id: "peer" }),
      msg({ id: "d", sender_id: "me", read_at: "2025-06-01T12:02:00.000Z" }),
    ];
    expect(latestReadOutgoingMessageId(messages, "me")).toBe("d");
  });

  it("formats read receipt time", () => {
    const label = formatReadReceiptTime("2025-06-01T21:38:00.000Z");
    expect(label).toBeTruthy();
  });
});
