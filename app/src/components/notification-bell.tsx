import { useState } from "react";
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

export function NotificationBell() {
  try {
    // Defensive: if auth/session/supabase context isn't available in this build, don't render.
    if (!import.meta?.env?.VITE_SUPABASE_URL) return null;

    const [, setLocation] = useLocation();
    const [open, setOpen] = useState(false);

    // Safe fallback (no API calls; hook removed from codebase).
    const notifications: Array<never> = [];
    const unreadCount = 0;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
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
          </div>
          <ScrollArea className="max-h-80">
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
              <p className="text-xs mt-1">You&apos;re all caught up.</p>
            </div>
          </ScrollArea>
          {notifications.length > 0 && (
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
