import { Drawer } from "vaul";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile-only bottom sheet for the feed composer. Split out so `vaul` can be lazy-loaded
 * with the drawer chunk instead of the main community feed route.
 */
export function CommunityFeedComposerDrawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[110] bg-black/80" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[110] flex h-[min(92dvh,calc(100dvh-0.5rem))] max-h-[100dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border/60 bg-background p-0 pt-2 text-foreground shadow-2xl outline-none",
          )}
        >
          <div className="flex shrink-0 flex-col items-center px-4 pb-2 pt-1">
            <Drawer.Handle
              className="!h-1 !w-12 shrink-0 !rounded-full !bg-muted-foreground/40"
              aria-label="Drag down to close"
            />
          </div>
          <div className="relative shrink-0 space-y-1 px-4 pb-2 text-left">
            <Drawer.Close className="absolute right-1 top-0 rounded-sm p-2 text-foreground opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">Close</span>
            </Drawer.Close>
            <Drawer.Title className="font-display pr-11 text-lg tracking-tight text-foreground">New post</Drawer.Title>
            <Drawer.Description className="text-sm text-muted-foreground">
              Share with the community — text, photos, polls, or events with date and location.
            </Drawer.Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
