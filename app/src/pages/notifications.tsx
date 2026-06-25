import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  deleteAllInAppNotificationsForUser,
  deleteInAppNotification,
  fetchInAppNotificationsForUser,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/lib/in-app-notifications-supabase";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import {
  INAPP_NOTIFICATIONS_CHANGED,
  type InAppNotificationsChangedDetail,
  notifyInAppNotificationsChanged,
} from "@/lib/in-app-notifications-events";
import { navigateForInAppNotification } from "@/lib/in-app-notifications-nav";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getProfilesByIds } from "@/lib/profile";
import { resolveProfileImageUrlResult } from "@/lib/storage-profile";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { FeedLoadingSkeleton } from "@/components/empty-state";
import {
  collectProfileUserIdsForNotifications,
  isDmMessageInAppNotification,
  profileUserIdForInAppNotification,
} from "@/lib/in-app-notification-display";
import { NotificationEmptyState, NotificationInboxRow } from "@/components/notifications/notification-inbox-row";
import { useAuth } from "@/lib/auth-context";
import { useHypoAcknowledgementIndex } from "@/hooks/use-hypo-acknowledgement-index";
import { useInAppBellUnreadCount } from "@/hooks/use-in-app-bell-unread-count";
import {
  HypoNotificationAckFooter,
  hypoLogIdFromInAppNotification,
} from "@/components/hypo-notification-ack-footer";
import {
  HypoCheckInNotificationFooter,
  hypoCheckInIdFromInAppNotification,
} from "@/components/hypo-check-in-notification-footer";
import { usePendingHypoCheckInIds } from "@/hooks/use-pending-hypo-check-ins";

export default function NotificationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const configured = isSupabaseConfigured();

  const [loading, setLoading] = useState(configured);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rows, setRows] = useState<InAppNotificationRow[]>([]);
  const [senderMeta, setSenderMeta] = useState<
    Map<string, { name: string; avatarUrl: string | null }>
  >(new Map());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const unread = useInAppBellUnreadCount();

  const hypoIdsForAck = useMemo(
    () =>
      rows
        .map((row) => hypoLogIdFromInAppNotification(row))
        .filter((id): id is string => Boolean(id)),
    [rows],
  );
  const { hasAcked, refresh: refreshHypoAcks } = useHypoAcknowledgementIndex(hypoIdsForAck, user?.id);
  const { isPending: isCheckInPending, refresh: refreshCheckIns } = usePendingHypoCheckInIds(user?.id);

  const refresh = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      setFetchError(null);
      setRows([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    const res = await fetchInAppNotificationsForUser();
    setLoading(false);
    if (res.error) {
      setFetchError(res.error.message);
      toast({ title: "Could not load notifications", description: res.error.message, variant: "destructive" });
      setRows([]);
      return;
    }
    setFetchError(null);
    const nextRows = (res.data ?? []).filter((r) => !isDmMessageInAppNotification(r));
    setRows(nextRows);

    try {
      const senderIds = collectProfileUserIdsForNotifications(nextRows);
      if (senderIds.length === 0) {
        setSenderMeta(new Map());
      } else {
        const profiles = await getProfilesByIds(senderIds);
        const meta = new Map<string, { name: string; avatarUrl: string | null }>();
        for (const id of senderIds) {
          const p = profiles.get(id);
          const name = p?.full_name?.trim() || p?.public_handle?.trim() || "Member";
          const avatarKey = p?.avatar_url ?? null;
          const { url } = avatarKey ? await resolveProfileImageUrlResult(avatarKey) : { url: null };
          meta.set(id, { name, avatarUrl: url });
        }
        setSenderMeta(meta);
      }
    } catch {
      // ignore enrichment errors
    }
  }, [configured, toast]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      setFetchError(null);
      setRows([]);
      return;
    }
    void refresh();
  }, [configured, refresh]);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<InAppNotificationsChangedDetail>).detail;
      if (detail?.skipPageRefresh) return;
      void refresh();
    };
    window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, onChanged);
    return () => window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, onChanged);
  }, [refresh]);

  const handleMarkAllRead = async () => {
    if (!configured) return;
    const res = await markAllInAppNotificationsRead();
    if (res.error) {
      toast({ title: "Could not update", description: res.error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    notifyInAppNotificationsChanged({ skipPageRefresh: true });
  };

  const handleConfirmClearAll = async () => {
    if (!configured) return;
    setClearBusy(true);
    const res = await deleteAllInAppNotificationsForUser();
    setClearBusy(false);
    if (res.error) {
      toast({ title: "Could not clear notifications", description: res.error.message, variant: "destructive" });
      return;
    }
    setRows([]);
    setClearDialogOpen(false);
    toast({ title: "Notifications cleared" });
    notifyInAppNotificationsChanged({ skipPageRefresh: true });
  };

  const handleOpen = async (row: InAppNotificationRow) => {
    if (!row.read) {
      const res = await markInAppNotificationRead(row.id);
      if (!res.error) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, read: true } : r)));
        notifyInAppNotificationsChanged({ skipPageRefresh: true });
      }
    }

    navigateForInAppNotification(row, setLocation);
  };

  const handleDeleteOne = async (row: InAppNotificationRow) => {
    if (!configured) return;
    const res = await deleteInAppNotification(row.id);
    if (res.error) {
      toast({ title: "Could not delete", description: res.error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    notifyInAppNotificationsChanged({ skipPageRefresh: true });
  };

  const handleMarkOneRead = async (row: InAppNotificationRow) => {
    if (!configured || row.read) return;
    const res = await markInAppNotificationRead(row.id);
    if (res.error) {
      toast({ title: "Could not update", description: res.error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, read: true } : r)));
    notifyInAppNotificationsChanged({ skipPageRefresh: true });
  };

  const pageDescription =
    unread > 0 ? `${unread} unread · messages, community, and app updates` : "Messages, community, and app updates";

  return (
    <PageShell variant="narrow" density="compact" className="pb-6">
      <div className="flex items-center gap-2">
        <PageBackButton />
      </div>
      <PageHeader
        stackActionsMaxSm
        title="Notifications"
        description={pageDescription}
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full sm:h-8 sm:w-auto sm:rounded-md sm:px-3"
              onClick={handleMarkAllRead}
              disabled={!configured || unread === 0}
              aria-label="Mark all read"
            >
              <CheckCheck className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive sm:h-8 sm:w-auto sm:rounded-md sm:px-3"
              type="button"
              onClick={() => setClearDialogOpen(true)}
              disabled={!configured || loading || rows.length === 0}
              data-testid="button-clear-all-notifications"
              aria-label="Clear all notifications"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Clear all</span>
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm">
        {!configured ? (
          <div className="px-4 py-10 text-center text-muted-foreground">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
              <Bell className="h-5 w-5 opacity-60" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">Notifications aren&apos;t configured</p>
            <p className="mx-auto mt-2 max-w-md text-xs">
              Set <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
              <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in{" "}
              <span className="font-mono">app/.env.local</span>, then restart the dev server.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl"
              type="button"
              onClick={() => setLocation("/settings/notifications")}
            >
              Open notification settings
            </Button>
          </div>
        ) : loading ? (
          <div className="p-4">
            <FeedLoadingSkeleton rows={4} />
          </div>
        ) : fetchError ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <p className="text-sm text-destructive">Could not load notifications</p>
            <p className="mx-auto mt-1 max-w-md break-words text-xs">{fetchError}</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-xl" type="button" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <NotificationEmptyState />
        ) : (
          <ScrollArea className="max-h-[min(75dvh,36rem)]">
            <div>
              {rows.map((r) => {
                const when = r.created_at
                  ? formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })
                  : "";
                const actorId = profileUserIdForInAppNotification(r);
                const actor = actorId ? senderMeta.get(actorId) : undefined;
                const hypoLogId = hypoLogIdFromInAppNotification(r);
                const checkInId = hypoCheckInIdFromInAppNotification(r);
                return (
                  <NotificationInboxRow
                    key={r.id}
                    row={r}
                    actor={actor}
                    when={when}
                    variant="page"
                    testId={`notif-row-${r.id}`}
                    onOpen={() => void handleOpen(r)}
                    onMarkRead={() => void handleMarkOneRead(r)}
                    onDelete={() => void handleDeleteOne(r)}
                    footer={
                      hypoLogId ? (
                        <HypoNotificationAckFooter
                          row={r}
                          acknowledged={hasAcked(hypoLogId)}
                          onAcknowledged={() => void refreshHypoAcks()}
                        />
                      ) : checkInId ? (
                        <HypoCheckInNotificationFooter
                          row={r}
                          responded={!isCheckInPending(checkInId)}
                          onResponded={() => void refreshCheckIns()}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <AlertDialog
        open={clearDialogOpen}
        onOpenChange={(o) => {
          if (!o && !clearBusy) setClearDialogOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every item from your in-app inbox. You can still receive new alerts afterward. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmClearAll();
              }}
              disabled={clearBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearBusy ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
