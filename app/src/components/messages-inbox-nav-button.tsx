import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { countUnreadDmThreadsForCurrentUser } from "@/lib/community/dm-supabase";
import { DM_INBOX_CHANGED } from "@/lib/community/dm-inbox-events";
import { INAPP_NOTIFICATIONS_CHANGED } from "@/lib/in-app-notifications-events";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { prefetchCommunityMessages, prefetchCommunityThread, prefetchNotificationsPage } from "@/components/bottom-nav";

const POLL_MS = 50_000;

function prefetchFromDmHeaderIcon(): void {
  prefetchCommunityMessages();
  prefetchCommunityThread();
  prefetchNotificationsPage();
}

/**
 * Header link to DM inbox with unread **conversation** count (threads where the latest
 * message is from someone else and unread), matching the blue dot on the messages list.
 */
export function MessagesInboxNavButton() {
  const { user } = useAuth();
  const [unreadThreads, setUnreadThreads] = useState(0);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.id) {
      setUnreadThreads(0);
      return;
    }
    const { count, error } = await countUnreadDmThreadsForCurrentUser();
    if (error && import.meta.env.DEV) {
      console.warn("[messages nav] unread count", error.message);
    }
    setUnreadThreads(error ? 0 : count);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    prefetchFromDmHeaderIcon();
  }, []);

  useEffect(() => {
    const onInbox = () => void load();
    const onNotifs = () => void load();
    const onFocus = () => void load();
    window.addEventListener(DM_INBOX_CHANGED, onInbox);
    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onNotifs);
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.removeEventListener(DM_INBOX_CHANGED, onInbox);
      window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onNotifs);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(t);
    };
  }, [load]);

  return (
    <Button variant="ghost" size="icon" asChild className="relative shrink-0">
      <Link
        href="/community/messages"
        aria-label={unreadThreads > 0 ? `Messages, ${unreadThreads} unread conversations` : "Messages"}
        data-testid="button-messages"
        onPointerEnter={prefetchFromDmHeaderIcon}
        onTouchStart={prefetchFromDmHeaderIcon}
      >
        <MessageCircle className="h-5 w-5" />
        {unreadThreads > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 max-w-[2.25rem] items-center justify-center px-1 text-[10px] tabular-nums"
          >
            {unreadThreads > 9 ? "9+" : unreadThreads}
          </Badge>
        ) : null}
      </Link>
    </Button>
  );
}
