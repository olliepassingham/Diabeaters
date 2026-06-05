import type { QueryClient } from "@tanstack/react-query";

import type { DmMessageRow, ThreadWithMembers } from "@/lib/community";

export const DM_INBOX_QK = ["dm-inbox"] as const;

export type DmInboxPayload = {
  threads: ThreadWithMembers[];
  lastByThreadId: Record<string, DmMessageRow | null>;
  labels: Record<string, string>;
  avatarByUserId: Record<string, string | null>;
  handleByUserId: Record<string, string>;
  serverMutedByThreadId: Record<string, boolean>;
  serverHiddenByThreadId: Record<string, boolean>;
};

/** Clear unread state in cached inbox rows immediately after opening a thread. */
export function patchDmInboxLastMessageRead(
  queryClient: QueryClient,
  viewerId: string,
  threadId: string,
  readAt: string,
): void {
  queryClient.setQueriesData<DmInboxPayload>({ queryKey: [...DM_INBOX_QK, viewerId] }, (old) => {
    if (!old) return old;
    const last = old.lastByThreadId[threadId];
    if (!last || last.read_at != null) return old;
    return {
      ...old,
      lastByThreadId: {
        ...old.lastByThreadId,
        [threadId]: { ...last, read_at: readAt },
      },
    };
  });
}

export function invalidateDmInboxQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [...DM_INBOX_QK] });
}
