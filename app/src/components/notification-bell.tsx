import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { fetchInAppNotificationsForUser, markAllInAppNotificationsRead } from "@/lib/in-app-notifications-supabase";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";

export function NotificationBell() {
  try {
    const configured = Boolean(import.meta?.env?.VITE_SUPABASE_URL);

    const [, setLocation] = useLocation();
    const [open, setOpen] = useState(false);

    const [rows, setRows] = useState<InAppNotificationRow[]>([]);
    const unreadCount = useMemo(() => rows.filter((r) => !r.read).length, [rows]);

    useEffect(() => {
      if (!configured) {
        setRows([]);
        return;
      }
      let active = true;
      void fetchInAppNotificationsForUser().then((res) => {
        if (!active) return;
        if (res.error) return;
        setRows(res.data ?? []);
      });
      return () => {
        active = false;
      };
    }, [configured]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-notifications"
            aria-disabled={!configured}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
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
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            {configured && unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={async () => {
                  const res = await markAllInAppNotificationsRead();
                  if (!res.error) setRows((prev) => prev.map((r) => ({ ...r, read: true })));
                }}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
          <ScrollArea className="max-h-80">
            {!configured ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Notifications aren&apos;t configured</p>
                <p className="text-xs mt-1">
                  Add Supabase environment variables to enable notifications on this build.
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
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
                <p className="text-xs mt-1">You&apos;re all caught up.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {rows.slice(0, 6).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      n.read ? "hover:bg-muted/60" : "bg-primary/5 hover:bg-primary/10"
                    }`}
                    onClick={() => {
                      setOpen(false);
                      setLocation("/notifications");
                    }}
                  >
                    <div className="font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{n.body}</div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          {configured && rows.length > 0 && (
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
    );
  } catch {
    return null;
  }
}
