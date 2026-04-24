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
import { Bell, Check, Trash2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { FeedLoadingSkeleton } from "@/components/empty-state";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const configured = isSupabaseConfigured();

  const [loading, setLoading] = useState(configured);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rows, setRows] = useState<InAppNotificationRow[]>([]);
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
    setRows(res.data ?? []);
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

  return (
    <PageShell variant="standard" className="max-w-2xl space-y-6">
      <div className="flex items-center">
        <PageBackButton />
      </div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary shrink-0" />
            Notifications
          </span>
        }
        description="In-app alerts and updates."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={!configured || unread === 0}>
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setClearDialogOpen(true)}
              disabled={!configured || loading || rows.length === 0}
              data-testid="button-clear-all-notifications"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            Inbox{unread > 0 ? ` · ${unread} unread` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
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
            <ScrollArea className="max-h-[60vh] pr-2">
              <ul className="space-y-2">
                {rows.map((r) => {
                  const when = r.created_at ? formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true }) : "";
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl border p-4 text-left transition-colors ${
                          r.read ? "bg-card" : "bg-primary/5 border-primary/20"
                        }`}
                        onClick={() => void handleOpen(r)}
                        data-testid={`notif-row-${r.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{r.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{r.body}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{when}</span>
                        </div>
                      </button>
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
