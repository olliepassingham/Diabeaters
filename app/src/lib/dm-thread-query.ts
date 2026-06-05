import {
  fetchDmMessages,
  fetchDmThreadMembers,
  markIncomingDmMessagesAsReadInThread,
  notifyDmInboxChanged,
  otherMemberUserId,
  type DmMessageRow,
} from "@/lib/community";
import { invalidateDmInboxQueries, patchDmInboxLastMessageRead } from "@/lib/dm-inbox-query";
import { getProfile } from "@/lib/profile";
import { queryClient } from "@/lib/queryClient";

export const dmThreadQueryKey = (threadId: string | undefined, viewerId: string | undefined) =>
  ["dm-thread", threadId ?? "", viewerId ?? ""] as const;

export type DmThreadPeer = {
  userId: string;
  label: string;
  avatarPath: string | null;
};

export type DmThreadBundle = {
  messages: DmMessageRow[];
  peer: DmThreadPeer | null;
};

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

const markingReadThreads = new Set<string>();

export async function fetchDmThreadBundle(
  threadId: string,
  viewerId: string,
): Promise<DmThreadBundle> {
  const [msgRes, memRes] = await Promise.all([
    fetchDmMessages(threadId),
    fetchDmThreadMembers(threadId),
  ]);

  if (msgRes.error) throw new Error(msgRes.error.message);

  const messages = msgRes.data ?? [];
  let peer: DmThreadPeer | null = null;

  if (!memRes.error && memRes.data?.length) {
    const other = otherMemberUserId(memRes.data, viewerId);
    if (other) {
      const { profile } = await getProfile(other);
      peer = {
        userId: other,
        label: profile?.full_name?.trim() || shortId(other),
        avatarPath: profile?.avatar_url ?? null,
      };
    }
  }

  return { messages, peer };
}

function patchThreadMessagesRead(
  threadId: string,
  viewerId: string,
  readAt: string,
): void {
  queryClient.setQueryData<DmThreadBundle>(dmThreadQueryKey(threadId, viewerId), (old) => {
    if (!old) return old;
    return {
      ...old,
      messages: old.messages.map((m) =>
        m.sender_id !== viewerId && m.read_at == null ? { ...m, read_at: readAt } : m,
      ),
    };
  });
}

/** Mark incoming messages read, optimistically clear inbox unread, then refresh from server. */
export async function markDmThreadReadWhenOpened(
  threadId: string,
  viewerId: string,
  messages: DmMessageRow[],
): Promise<void> {
  const hasIncomingUnread = messages.some((m) => m.sender_id !== viewerId && m.read_at == null);
  if (!hasIncomingUnread || markingReadThreads.has(threadId)) return;

  markingReadThreads.add(threadId);
  const readAt = new Date().toISOString();

  patchDmInboxLastMessageRead(queryClient, viewerId, threadId, readAt);
  patchThreadMessagesRead(threadId, viewerId, readAt);

  try {
    const markRes = await markIncomingDmMessagesAsReadInThread(threadId);
    if (markRes.error) {
      invalidateDmInboxQueries(queryClient);
      return;
    }
    notifyDmInboxChanged();
    invalidateDmInboxQueries(queryClient);
  } finally {
    markingReadThreads.delete(threadId);
  }
}
