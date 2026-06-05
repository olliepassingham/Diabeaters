import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DM_INBOX_CHANGED } from "@/lib/community";
import { invalidateDmInboxQueries } from "@/lib/dm-inbox-query";

/** Keeps DM inbox React Query cache fresh even when the messages list page is unmounted. */
export function DmInboxQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onInbox = () => invalidateDmInboxQueries(queryClient);
    window.addEventListener(DM_INBOX_CHANGED, onInbox);
    return () => window.removeEventListener(DM_INBOX_CHANGED, onInbox);
  }, [queryClient]);

  return null;
}
