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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getProfilesByIds } from "@/lib/profile";
import { resolveProfileImageUrlResult } from "@/lib/storage-profile";
import { Bell, Check, Trash2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { FeedLoadingSkeleton } from "@/components/empty-state";
import {
  collectProfileUserIdsForNotifications,
  initialsFromDisplayName,
  isDmMessageInAppNotification,
  primaryLineForNotification,
  profileUserIdForInAppNotification,
  showsProfileAvatar,
} from "@/lib/in-app-notification-display";

export default function NotificationsPage() {
  const { toast } = useToast();
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

  const unread = useMemo(() => rows.filter((r) => !r.read).length, [rows]);

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

    // Enrich DM notifications with sender avatars/names.
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
      // ignore enrichment errors (keep list fast/robust)
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

    const path = getPathForInAppNotification(row);
    if (path) setLocation(path);
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

  return (
    <PageShell variant="narrow" density="compact" className="pb-6">
      <div className="flex items-center gap-2">
        <PageBackButton />
      </div>
      <PageHeader
        stackActionsMaxSm
        title="Notifications"
        description="Updates from messages, your community, and the app."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={!configured || unread === 0} aria-label="Mark all read">
              <Check className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
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

      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="space-y-0 border-b border-border/50 bg-muted/20 px-4 py-3 sm:px-5">
          <CardTitle className="text-base font-semibold tracking-tight">
            Inbox{unread > 0 ? <span className="text-muted-foreground font-normal"> · {unread} unread</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!configured ? (
            <div className="py-10 text-center text-muted-foreground px-2">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">Notifications aren&apos;t configured</p>
              <p className="text-xs mt-2 max-w-md mx-auto">
                Set <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
                <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in{" "}
                <span className="font-mono">app/.env.local</span>, then restart the dev server. For hosted builds,
                add the same variables in your deployment settings (see project README).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                type="button"
                onClick={() => setLocation("/settings/notifications")}
              >
                Open notification settings
              </Button>
            </div>
          ) : loading ? (
            <FeedLoadingSkeleton rows={4} />
          ) : fetchError ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm text-destructive">Could not load notifications</p>
              <p className="text-xs mt-1 break-words max-w-md mx-auto">{fetchError}</p>
              <Button variant="outline" size="sm" className="mt-4" type="button" onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
              <p className="text-xs mt-1">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[min(75dvh,32rem)]">
              <ul className="divide-y divide-border/60">
                {rows.map((r) => {
                  const when = r.created_at
                    ? formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })
                    : "";
                  const actorId = profileUserIdForInAppNotification(r);
                  const actor = actorId ? senderMeta.get(actorId) : undefined;
                  const primary = primaryLineForNotification(r, actor);
                  const showAvatar = showsProfileAvatar(r);
                  return (
                    <li key={r.id}>
                      <div
                        className={`group flex gap-2 px-3 py-3 transition-colors sm:gap-3 sm:px-4 ${
                          r.read ? "bg-card hover:bg-muted/30" : "bg-primary/[0.04] hover:bg-primary/[0.07]"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          onClick={() => void handleOpen(r)}
                          data-testid={`notif-row-${r.id}`}
                        >
                          {showAvatar ? (
                            <Avatar className="mt-0.5 h-11 w-11 shrink-0 ring-1 ring-border/60">
                              {actor?.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
                              <AvatarFallback className="text-xs font-semibold">
                                {initialsFromDisplayName(primary)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/80 ring-1 ring-border/50">
                              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                              <span className="truncate text-sm font-semibold text-foreground">{primary}</span>
                              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{when}</span>
                            </div>
                            {r.body?.trim() ? (
                              <p className="text-sm leading-snug text-muted-foreground line-clamp-4">{r.body}</p>
                            ) : null}
                          </div>
                        </button>
                        <div className="flex shrink-0 flex-col gap-1 border-l border-border/50 pl-2">
                          {!r.read ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-foreground"
                              type="button"
                              aria-label="Mark as read"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void (async () => {
                                  const res = await markInAppNotificationRead(r.id);
                                  if (res.error) {
                                    toast({
                                      title: "Could not update",
                                      description: res.error.message,
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, read: true } : x)));
                                  notifyInAppNotificationsChanged({ skipPageRefresh: true });
                                })();
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDeleteOne(r);
                            }}
                            aria-label="Delete notification"
                            data-testid={`button-delete-notif-${r.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

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
