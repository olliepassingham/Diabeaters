import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { enrichDmMessages, mapDmMessageRow } from "@/lib/community/dm-supabase";
import { notifyDmInboxChanged } from "@/lib/community/dm-inbox-events";
import { dmThreadQueryKey, type DmThreadBundle } from "@/lib/dm-thread-query";
import { signalPeerTyping } from "@/lib/dm-thread-typing";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const TYPING_DEBOUNCE_MS = 400;
const TYPING_STOP_MS = 2_800;

type TypingPayload = {
  user_id?: string;
  typing?: boolean;
};

function patchMessageInBundle(old: DmThreadBundle, messageId: string, patch: Partial<DmThreadBundle["messages"][number]>): DmThreadBundle {
  return {
    ...old,
    messages: old.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
  };
}

export function useDmThreadLive(
  threadId: string | null | undefined,
  userId: string | undefined,
  queryClient: QueryClient,
): { notifyComposerTyping: (hasText: boolean) => void } {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const typingDebounceRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(false);

  useEffect(() => {
    if (!threadId || !userId || !isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    const channel = supabase.channel(`dm-thread:${threadId}`, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          void (async () => {
            const row = mapDmMessageRow(payload.new as Record<string, unknown>);
            const key = dmThreadQueryKey(threadId, userId);
            const cached = queryClient.getQueryData<DmThreadBundle>(key);
            if (cached?.messages.some((m) => m.id === row.id)) return;

            const [enriched] = await enrichDmMessages([row]);
            if (!enriched || cancelled) return;

            queryClient.setQueryData<DmThreadBundle>(key, (old) => {
              if (!old) return old;
              if (old.messages.some((m) => m.id === enriched.id)) return old;
              return { ...old, messages: [...old.messages, enriched] };
            });
            notifyDmInboxChanged();
          })();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = mapDmMessageRow(payload.new as Record<string, unknown>);
          queryClient.setQueryData<DmThreadBundle>(dmThreadQueryKey(threadId, userId), (old) => {
            if (!old) return old;
            const existing = old.messages.find((m) => m.id === row.id);
            if (!existing) return old;
            return patchMessageInBundle(old, row.id, {
              read_at: row.read_at,
              body: row.body,
              image_storage_path: row.image_storage_path,
            });
          });
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = (payload ?? {}) as TypingPayload;
        if (!p.user_id || p.user_id === userId) return;
        signalPeerTyping(threadId, p.typing === true);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      channelRef.current = null;
      if (typingStopRef.current != null) window.clearTimeout(typingStopRef.current);
      if (typingDebounceRef.current != null) window.clearTimeout(typingDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [threadId, userId, queryClient]);

  function sendTypingBroadcast(typing: boolean) {
    if (!threadId || !userId) return;
    const channel = channelRef.current;
    if (!channel) return;
    if (lastTypingSentRef.current === typing && typing) return;
    lastTypingSentRef.current = typing;
    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId, typing },
    });
  }

  function notifyComposerTyping(hasText: boolean) {
    if (!threadId || !userId) return;

    if (!hasText) {
      if (typingDebounceRef.current != null) window.clearTimeout(typingDebounceRef.current);
      if (typingStopRef.current != null) window.clearTimeout(typingStopRef.current);
      sendTypingBroadcast(false);
      lastTypingSentRef.current = false;
      return;
    }

    if (typingDebounceRef.current != null) window.clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = window.setTimeout(() => {
      sendTypingBroadcast(true);
      if (typingStopRef.current != null) window.clearTimeout(typingStopRef.current);
      typingStopRef.current = window.setTimeout(() => {
        sendTypingBroadcast(false);
        lastTypingSentRef.current = false;
      }, TYPING_STOP_MS);
    }, TYPING_DEBOUNCE_MS);
  }

  return { notifyComposerTyping };
}
