import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Bell, MessageCircle, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { INAPP_NOTIFICATIONS_CHANGED, notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import {
  deleteAllInAppNotificationsForUser,
  fetchInAppNotificationsForUser,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/lib/in-app-notifications-supabase";
import { getPathForInAppNotification } from "@/lib/in-app-notifications-nav";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAiCoachEnabled } from "@/lib/flags";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { coachTopicForInAppNotification } from "@/lib/ai-coach/notification-topic-map";
import { askAssistantAboutThisAriaLabel } from "@/lib/ai-coach/persona";
import { getProfilesByIds } from "@/lib/profile";
import { resolveProfileImageUrlResult } from "@/lib/storage-profile";

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function InAppToastContent(props: {
  title: string;
  body?: string;
  avatarUrl?: string | null;
  initials?: string;
  eyebrow?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-9 w-9">
        {props.avatarUrl ? <AvatarImage src={props.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-[11px] font-semibold">
          {props.initials?.trim() ? props.initials : "DB"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {props.eyebrow ? (
          <div className="text-[11px] font-medium text-muted-foreground">{props.eyebrow}</div>
        ) : null}
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
        setRows(res.data ?? []);
      });
    }, [configured]);

    useEffect(() => {
      load();
    }, [load]);

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

              // Default: compact modern toast without avatar lookup.
              const t = toast({
                title: (
                  <InAppToastContent
                    eyebrow="New"
                    title={rowTitle}
                    body={bodyText || undefined}
                    initials={initialsFromName(rowTitle)}
                  />
                ),
                action,
                duration: 5000,
                className: "px-4 py-3 pr-10 rounded-xl border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
              });

              // DM: show sender avatar + name when available.
              if (kind === "dm_message") {
                const senderId = typeof data.sender_user_id === "string" ? data.sender_user_id : "";
                if (senderId) {
                  void (async () => {
                    const profiles = await getProfilesByIds([senderId]);
                    const prof = profiles.get(senderId);
                    const displayName = prof?.full_name?.trim() || "New message";
                    const avatarKey = prof?.avatar_url ?? null;
                    const { url } = avatarKey ? await resolveProfileImageUrlResult(avatarKey) : { url: null };
                    t.update({
                      title: (
                        <InAppToastContent
                          eyebrow="New message"
                          title={displayName}
                          body={bodyText || undefined}
                          avatarUrl={url}
                          initials={initialsFromName(displayName)}
                        />
                      ),
                      action,
                      duration: 6000,
                      className:
                        "px-4 py-3 pr-10 rounded-xl border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
                    });
                  })();
                }
              }

              notifyInAppNotificationsChanged();
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
              className="relative"
              data-testid="button-notifications"
              aria-disabled={!configured}
            >
              <Bell className="h-5 w-5" />
              {configured && unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between gap-2 p-3 border-b">
              <h3 className="font-semibold shrink-0">Notifications</h3>
              {configured && !loading && !loadError && rows.length > 0 ? (
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {unreadCount > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                    >
                      Mark all read
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setClearDialogOpen(true);
                    }}
                    data-testid="button-bell-clear-all-notifications"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden />
                    Clear all
                  </Button>
                </div>
              ) : null}
            </div>
            <ScrollArea className="max-h-80">
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
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                  <p className="text-xs mt-1">You&apos;re all caught up.</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {sortedRows.slice(0, 6).map((n) => {
                    const askHref = isAiCoachEnabled
                      ? buildCoachHref({
                          topic: coachTopicForInAppNotification(n),
                          from: "notification-bell",
                        })
                      : null;
                    return (
                      <div
                        key={n.id}
                        className={`flex w-full items-stretch gap-1 rounded-lg text-sm transition-colors ${
                          n.read ? "hover:bg-muted/60" : "bg-primary/5 hover:bg-primary/10"
                        }`}
                        data-testid={`bell-notif-row-${n.id}`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 px-3 py-2 text-left"
                          onClick={() => {
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
                        >
                          <div className="font-medium truncate">{n.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{n.body}</div>
                        </button>
                        {!n.read && askHref ? (
                          <Button variant="ghost" size="icon" className="h-auto shrink-0 self-stretch px-2" asChild>
                            <Link
                              href={askHref}
                              aria-label={askAssistantAboutThisAriaLabel()}
                              data-testid={`bell-notif-ask-${n.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {configured && !loading && !loadError && rows.length > 0 && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
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
