import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  fetchInAppNotificationsForUser,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/lib/in-app-notifications-supabase";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InAppNotificationRow[]>([]);

  const unread = useMemo(() => rows.filter((r) => !r.read).length, [rows]);

  const refresh = async () => {
    setLoading(true);
    const res = await fetchInAppNotificationsForUser();
    setLoading(false);
    if (res.error) {
      toast({ title: "Could not load notifications", description: res.error.message, variant: "destructive" });
      setRows([]);
      return;
    }
    setRows(res.data ?? []);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAllRead = async () => {
    const res = await markAllInAppNotificationsRead();
    if (res.error) {
      toast({ title: "Could not update", description: res.error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
  };

  const handleOpen = async (row: InAppNotificationRow) => {
    if (!row.read) {
      const res = await markInAppNotificationRead(row.id);
      if (!res.error) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, read: true } : r)));
    }

    const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
    const kind = typeof data.kind === "string" ? data.kind : "";
    const target = typeof data.deep_link === "string" ? data.deep_link : "";

    if (target) {
      setLocation(target);
      return;
    }
    if (kind === "supplies_low") {
      setLocation("/supplies");
      return;
    }
    if (kind === "hypo_logged" || kind === "scenario_started") {
      setLocation("/carer-view");
      return;
    }
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
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={unread === 0}>
            <Check className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            Inbox{unread > 0 ? ` · ${unread} unread` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
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
    </PageShell>
  );
}

