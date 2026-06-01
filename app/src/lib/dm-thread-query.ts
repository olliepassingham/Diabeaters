import {
  fetchDmMessages,
  fetchDmThreadMembers,
  markIncomingDmMessagesAsReadInThread,
  notifyDmInboxChanged,
  otherMemberUserId,
  type DmMessageRow,
} from "@/lib/community";
import { getProfile } from "@/lib/profile";

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

/** Fire-and-forget after thread is visible — do not block first paint. */
export function markDmThreadReadWhenOpened(threadId: string, viewerId: string, messages: DmMessageRow[]): void {
  const hasIncomingUnread = messages.some((m) => m.sender_id !== viewerId && m.read_at == null);
  if (!hasIncomingUnread) return;
  void markIncomingDmMessagesAsReadInThread(threadId).then((markRes) => {
    if (!markRes.error) notifyDmInboxChanged();
  });
}
