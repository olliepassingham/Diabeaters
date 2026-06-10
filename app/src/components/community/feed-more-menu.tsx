import { useState } from "react";
import { Ban, MoreHorizontal } from "lucide-react";
import { BlockedUsersPanel } from "@/components/community/blocked-users-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const blockedUsersDescription =
  "People you've blocked on the Feed. Their profile is hidden until you unblock them.";

export function FeedMoreMenu() {
  const isMobile = useIsMobile();
  const [blockedOpen, setBlockedOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            type="button"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="More Feed options"
            data-testid="feed-more-menu-trigger"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => setBlockedOpen(true)}
            data-testid="feed-more-menu-blocked-users"
          >
            <Ban className="mr-2 h-4 w-4" aria-hidden />
            Blocked users
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isMobile ? (
        <Sheet open={blockedOpen} onOpenChange={setBlockedOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Blocked users</SheetTitle>
              <SheetDescription>{blockedUsersDescription}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 min-h-0 overflow-y-auto overscroll-contain pb-4">
              <BlockedUsersPanel active={blockedOpen} />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
          <DialogContent className="sm:max-w-md max-h-[85dvh] !flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>Blocked users</DialogTitle>
              <DialogDescription>{blockedUsersDescription}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <BlockedUsersPanel active={blockedOpen} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
