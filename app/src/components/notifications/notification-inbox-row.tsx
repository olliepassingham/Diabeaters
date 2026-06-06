import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AtSign,
  Bell,
  Check,
  ChevronRight,
  Droplet,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InAppNotificationRow } from "@/lib/carer-notify-types";
import {
  initialsFromDisplayName,
  notificationKind,
  primaryLineForNotification,
  showsProfileAvatar,
  subtitleForNotification,
} from "@/lib/in-app-notification-display";
import { cn } from "@/lib/utils";

function iconForKind(kind: string): LucideIcon {
  if (kind === "feed_post_like") return Heart;
  if (kind === "feed_post_comment" || kind === "feed_comment_mention") return MessageCircle;
  if (kind === "feed_post_mention") return AtSign;
  if (kind === "hypo_logged" || kind === "hypo_logged_self") return Droplet;
  if (kind === "scenario_started") return Activity;
  return Bell;
}

export type NotificationInboxRowProps = {
  row: InAppNotificationRow;
  actor?: { name: string; avatarUrl: string | null };
  when: string;
  variant?: "popover" | "page";
  onOpen: () => void;
  onMarkRead?: () => void;
  onDelete?: () => void;
  testId?: string;
};

export function NotificationInboxRow({
  row,
  actor,
  when,
  variant = "page",
  onOpen,
  onMarkRead,
  onDelete,
  testId,
}: NotificationInboxRowProps) {
  const primary = primaryLineForNotification(row, actor);
  const subtitle = subtitleForNotification(row, actor);
  const showAvatar = showsProfileAvatar(row);
  const KindIcon = iconForKind(notificationKind(row));
  const isPopover = variant === "popover";

  return (
    <div
      className={cn(
        "group relative flex items-stretch transition-colors",
        row.read ? "bg-transparent" : "bg-primary/[0.05]",
        !isPopover && "border-b border-border/40 last:border-b-0",
      )}
      data-testid={testId}
    >
      {!row.read ? (
        <span
          className="absolute left-1.5 top-1/2 z-[1] h-2 w-2 -translate-y-1/2 rounded-full bg-primary shadow-sm sm:left-2"
          aria-hidden
        />
      ) : null}

      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 text-left outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          isPopover ? "rounded-xl px-3 py-3 hover:bg-muted/35" : "px-3 py-3.5 pl-5 sm:px-4 sm:pl-6",
          !row.read && !isPopover && "hover:bg-primary/[0.08]",
        )}
        onClick={onOpen}
      >
        {showAvatar ? (
          <Avatar className="mt-0.5 h-10 w-10 shrink-0 ring-1 ring-border/50">
            {actor?.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[11px] font-semibold">{initialsFromDisplayName(primary)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/40">
            <KindIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
        )}

        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-start justify-between gap-2">
            <span className={cn("line-clamp-2 text-sm leading-snug text-foreground", !row.read && "font-semibold")}>
              {primary}
            </span>
            {when ? (
              <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">{when}</span>
            ) : null}
          </span>
          {subtitle ? (
            <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>

        {isPopover ? (
          <ChevronRight
            className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        ) : null}
      </button>

      {!isPopover && (onMarkRead || onDelete) ? (
        <div className="flex shrink-0 items-center pr-2 sm:pr-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground opacity-80 hover:opacity-100"
                aria-label="Notification actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!row.read && onMarkRead ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead();
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark read
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationEmptyState({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("text-center text-muted-foreground", compact ? "px-4 py-8" : "px-6 py-12")}>
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
        <Bell className="h-5 w-5 opacity-60" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">All caught up</p>
      <p className="mt-1 text-xs">New alerts will show up here.</p>
    </div>
  );
}
