import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ToastAction } from "@/components/ui/toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { INAPP_NOTIFICATIONS_CHANGED, notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { notifyDmInboxChanged } from "@/lib/community/dm-inbox-events";
import {
  deleteAllInAppNotificationsForUser,
  fetchInAppNotificationsForUser,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/lib/in-app-notifications-supabase";
import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getProfilesByIds } from "@/lib/profile";
import { resolveProfileImageUrlResult } from "@/lib/storage-profile";
import {
  collectProfileUserIdsForNotifications,
  initialsFromDisplayName,
  isDmMessageInAppNotification,
  profileUserIdForInAppNotification,
} from "@/lib/in-app-notification-display";
import { NotificationEmptyState, NotificationInboxRow } from "@/components/notifications/notification-inbox-row";
import { prefetchNotificationsPage } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";

function InAppToastContent(props: {
  title: string;
  body?: string;
  avatarUrl?: string | null;
  initials?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-9 w-9 shrink-0">
        {props.avatarUrl ? <AvatarImage src={props.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-[11px] font-semibold">
          {props.initials?.trim() ? props.initials : "DB"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{props.title}</div>
        {props.body?.trim() ? (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{props.body}</div>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationBell() {
  try {
    const { toast } = useToast();
    const configured = isSupabaseConfigured();

    const [, setLocation] = useLocation();
    const [open, setOpen] = useState(false);

    const [rows, setRows] = useState<InAppNotificationRow[]>([]);
    const [actorMeta, setActorMeta] = useState<Map<string, { name: string; avatarUrl: string | null }>>(new Map());
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [clearBusy, setClearBusy] = useState(false);
    const unreadCount = useMemo(() => rows.filter((r) => !r.read).length, [rows]);

    const sortedRows = useMemo(() => {
      return [...rows].sort((a, b) => Number(a.read) - Number(b.read));
    }, [rows]);

    const load = useCallback(() => {
      if (!configured) {
        setRows([]);
        setLoadError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      void fetchInAppNotificationsForUser().then((res) => {
        setLoading(false);
        if (res.error) {
          setLoadError(res.error.message);
          setRows([]);
          return;
        }
        setLoadError(null);
        setRows((res.data ?? []).filter((r) => !isDmMessageInAppNotification(r)));
      });
    }, [configured]);

    useEffect(() => {
      load();
    }, [load]);

    useEffect(() => {
      prefetchNotificationsPage();
    }, []);

    useEffect(() => {
      if (!configured || rows.length === 0) {
        setActorMeta(new Map());
        return;
      }
      const ids = collectProfileUserIdsForNotifications(rows);
      if (ids.length === 0) {
        setActorMeta(new Map());
        return;
      }
      let cancelled = false;
      void (async () => {
        try {
          const profiles = await getProfilesByIds(ids);
          const meta = new Map<string, { name: string; avatarUrl: string | null }>();
          for (const id of ids) {
            const p = profiles.get(id);
            const name = p?.full_name?.trim() || p?.public_handle?.trim() || "Member";
            const avatarKey = p?.avatar_url ?? null;
            const { url } = avatarKey ? await resolveProfileImageUrlResult(avatarKey) : { url: null };
            meta.set(id, { name, avatarUrl: url });
          }
          if (!cancelled) setActorMeta(meta);
        } catch {
          if (!cancelled) setActorMeta(new Map());
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [configured, rows]);

    useEffect(() => {
      const handler = (_e: Event) => load();
      window.addEventListener(INAPP_NOTIFICATIONS_CHANGED, handler);
      return () => window.removeEventListener(INAPP_NOTIFICATIONS_CHANGED, handler);
    }, [load]);

    /** Brief top toast + bell/list refresh when a new notification row arrives while the app is open. */
    useEffect(() => {
      if (!configured) return;
      const supabase = getSupabase();
      if (!supabase) return;

      let cancelled = false;
      let channel: ReturnType<typeof supabase.channel> | null = null;

      const detach = () => {
        if (channel) {
          void supabase.removeChannel(channel);
          channel = null;
        }
      };

      const attach = (uid: string) => {
        detach();
        channel = supabase
          .channel(`inapp-notifications-insert:${uid}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${uid}`,
            },
            (payload) => {
              const row = payload.new as Record<string, unknown>;
              const rowTitle = String(row.title ?? "Notification");
              const bodyRaw = row.body;
              const bodyText = typeof bodyRaw === "string" && bodyRaw.trim() ? bodyRaw.trim() : "";
              const data = (row.data && typeof row.data === "object" ? row.data : {}) as Record<string, unknown>;
              const kind = typeof data.kind === "string" ? data.kind : "";

              if (kind !== "dm_message") {
                const href = getPathForInAppNotification({
                  id: String(row.id ?? ""),
                  user_id: String(row.user_id ?? ""),
                  title: rowTitle,
                  body: bodyText,
                  data: data as InAppNotificationRow["data"],
                  created_at: String(row.created_at ?? ""),
                  read: Boolean(row.read),
                });

                const action = href ? (
                  <ToastAction
                    altText="Open"
                    onClick={() => {
                      setOpen(false);
                      setLocation(href);
                    }}
                    className="h-8 px-2 text-xs"
                  >
                    Open
                  </ToastAction>
                ) : undefined;

                const toastClass =
                  "px-4 py-3 pr-10 rounded-xl border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-md";

                const t = toast({
                  title: (
                    <InAppToastContent
                      title={rowTitle}
                      body={bodyText || undefined}
                      initials={initialsFromDisplayName(rowTitle)}
                    />
                  ),
                  action,
                  duration: 5000,
                  className: toastClass,
                });

                const actorToastId =
                  (kind === "feed_post_like" ||
                    kind === "feed_post_comment" ||
                    kind === "feed_post_mention" ||
                    kind === "feed_comment_mention") &&
                  typeof data.actor_user_id === "string"
                    ? data.actor_user_id
                    : "";

                if (actorToastId) {
                  void (async () => {
                    const profiles = await getProfilesByIds([actorToastId]);
                    const prof = profiles.get(actorToastId);
                    const displayName =
                      prof?.full_name?.trim() || prof?.public_handle?.trim() || rowTitle;
                    const avatarKey = prof?.avatar_url ?? null;
                    const { url } = avatarKey ? await resolveProfileImageUrlResult(avatarKey) : { url: null };
                    t.update({
                      title: (
                        <InAppToastContent
                          title={displayName}
                          body={bodyText || undefined}
                          avatarUrl={url}
                          initials={initialsFromDisplayName(displayName)}
                        />
                      ),
                      action,
                      duration: 6000,
                      className: toastClass,
                    });
                  })();
                }
              }

              notifyInAppNotificationsChanged();
              if (kind === "dm_message") {
                notifyDmInboxChanged();
              }
            },
          )
          .subscribe();
      };

      const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
        detach();
        if (cancelled) return;
        const uid = session?.user?.id;
        if (uid) attach(uid);
      });

      return () => {
        cancelled = true;
        detach();
        authSub.subscription.unsubscribe();
      };
    }, [configured, toast]);

    const handleMarkAllRead = async () => {
      const res = await markAllInAppNotificationsRead();
      if (!res.error) {
        setRows((prev) => prev.map((r) => ({ ...r, read: true })));
        notifyInAppNotificationsChanged();
      }
    };

    const handleConfirmClearAll = async () => {
      setClearBusy(true);
      const res = await deleteAllInAppNotificationsForUser();
      setClearBusy(false);
      if (res.error) {
        toast({
          title: "Could not clear notifications",
          description: res.error.message,
          variant: "destructive",
        });
        return;
      }
      setRows([]);
      setClearDialogOpen(false);
      toast({ title: "Notifications cleared" });
      notifyInAppNotificationsChanged();
    };

    return (
      <>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) void load();
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative h-9 w-9 shrink-0 rounded-full",
                configured && unreadCount > 0 && "ring-1 ring-primary/30",
              )}
              data-testid="button-notifications"
              aria-disabled={!configured}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              onPointerEnter={prefetchNotificationsPage}
              onTouchStart={prefetchNotificationsPage}
            >
              <Bell className="h-5 w-5" strokeWidth={2} />
              {configured && unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground tabular-nums shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[calc(100vw-1.25rem)] max-w-[22rem] overflow-hidden rounded-2xl border-border/50 bg-background/95 p-0 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/90"
            align="end"
            sideOffset={10}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3.5 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Notifications</h3>
                {unreadCount > 0 ? (
                  <p className="text-[11px] text-muted-foreground">{unreadCount} unread</p>
                ) : null}
              </div>
              {configured && !loading && !loadError && rows.length > 0 ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  {unreadCount > 0 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      type="button"
                      aria-label="Mark all read"
                      onClick={() => void handleMarkAllRead()}
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    type="button"
                    aria-label="Clear all notifications"
                    onClick={() => {
                      setOpen(false);
                      setClearDialogOpen(true);
                    }}
                    data-testid="button-bell-clear-all-notifications"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
            <ScrollArea className="max-h-[min(70vh,24rem)]">
              {!configured ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Notifications aren&apos;t configured</p>
                  <p className="text-xs mt-1">
                    Set <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
                    <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> in{" "}
                    <span className="font-mono">app/.env.local</span>, then restart the dev server. For hosted
                    builds, add the same variables in your deployment settings (see project README).
                  </p>
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        setLocation("/settings/notifications");
                      }}
                    >
                      Open notification settings
                    </Button>
                  </div>
                </div>
              ) : loading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
              ) : loadError ? (
                <div className="p-6 text-center text-muted-foreground">
                  <p className="text-sm text-destructive">Could not load notifications</p>
                  <p className="text-xs mt-1 break-words">{loadError}</p>
                  <Button variant="outline" size="sm" className="mt-4" type="button" onClick={() => load()}>
                    Try again
                  </Button>
                </div>
              ) : rows.length === 0 ? (
                <NotificationEmptyState compact />
              ) : (
                <div className="p-1.5">
                  {sortedRows.slice(0, 8).map((n) => {
                    const actorId = profileUserIdForInAppNotification(n);
                    const meta = actorId ? actorMeta.get(actorId) : undefined;
                    const when = n.created_at
                      ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true })
                      : "";
                    return (
                      <NotificationInboxRow
                        key={n.id}
                        row={n}
                        actor={meta}
                        when={when}
                        variant="popover"
                        testId={`bell-notif-row-${n.id}`}
                        onOpen={() => {
                          void (async () => {
                            if (!n.read) {
                              const res = await markInAppNotificationRead(n.id);
                              if (!res.error) {
                                setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
                                notifyInAppNotificationsChanged({ skipPageRefresh: true });
                              }
                            }
                            setOpen(false);
                            const path = getPathForInAppNotification(n) ?? "/notifications";
                            setLocation(path);
                          })();
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {configured && !loading && !loadError && rows.length > 0 && (
              <div className="border-t border-border/50 bg-muted/10 p-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full rounded-xl text-xs font-medium"
                  onClick={() => {
                    setOpen(false);
                    setLocation("/notifications");
                  }}
                  data-testid="button-all-notifications"
                >
                  View all notifications
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <AlertDialog
          open={clearDialogOpen}
          onOpenChange={(next) => {
            if (!next && !clearBusy) setClearDialogOpen(false);
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
              <Button
                type="button"
                variant="destructive"
                disabled={clearBusy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleConfirmClearAll()}
                data-testid="button-bell-confirm-clear-all"
              >
                {clearBusy ? "Clearing…" : "Clear all"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  } catch {
    return null;
  }
}
