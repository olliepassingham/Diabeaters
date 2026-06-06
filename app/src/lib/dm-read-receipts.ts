import type { DmMessageRow } from "@/lib/community/types";

export type DmReadReceiptStatus = "sent" | "read";

/** Outgoing messages only: sent (delivered) vs read (peer opened thread). */
export function readReceiptStatusForMessage(message: DmMessageRow, viewerId: string): DmReadReceiptStatus | null {
  if (message.sender_id !== viewerId) return null;
  return message.read_at ? "read" : "sent";
}

/** Latest outgoing message id when it has been read (for footer "Read" label). */
export function latestReadOutgoingMessageId(messages: DmMessageRow[], viewerId: string): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]!;
    if (m.sender_id === viewerId && m.read_at) return m.id;
  }
  return null;
}

export function formatReadReceiptTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
