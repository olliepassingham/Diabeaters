import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { DmMessageRow } from "@/lib/community";
import { DM_INBOX_QK, patchDmInboxLastMessageRead } from "./dm-inbox-query";

describe("dm-inbox-query", () => {
  it("patchDmInboxLastMessageRead clears unread on cached last message", () => {
    const queryClient = new QueryClient();
    const viewerId = "viewer-1";
    const threadId = "thread-1";
    const last: DmMessageRow = {
      id: "m1",
      thread_id: threadId,
      sender_id: "other-1",
      body: "Hello",
      image_storage_path: null,
      created_at: "2025-06-05T12:00:00.000Z",
      read_at: null,
    };

    queryClient.setQueryData([...DM_INBOX_QK, viewerId], {
      threads: [{ id: threadId, members: [], created_at: "", updated_at: "" }],
      lastByThreadId: { [threadId]: last },
      labels: {},
      avatarByUserId: {},
      handleByUserId: {},
      serverMutedByThreadId: {},
      serverHiddenByThreadId: {},
    });

    patchDmInboxLastMessageRead(queryClient, viewerId, threadId, "2025-06-05T12:01:00.000Z");

    const cached = queryClient.getQueryData<{
      lastByThreadId: Record<string, DmMessageRow | null>;
    }>([...DM_INBOX_QK, viewerId]);

    expect(cached?.lastByThreadId[threadId]?.read_at).toBe("2025-06-05T12:01:00.000Z");
  });
});
