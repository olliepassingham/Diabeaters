import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** When true, swipe-to-dismiss only works from the drag handle (better for scrollable content). */
  handleOnly?: boolean;
  showClose?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
};

/**
 * Mobile bottom sheet with a working drag handle (vaul). Swipe the handle down to dismiss.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  bodyClassName,
  handleOnly = true,
  showClose = true,
  onOpenAutoFocus,
}: BottomSheetProps) {
  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      handleOnly={handleOnly}
      shouldScaleBackground={false}
      repositionInputs={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-[110] bg-black/80" />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[110] flex max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-t-[1.35rem] border-t border-border/60 bg-background p-0 pb-[env(safe-area-inset-bottom)] text-foreground outline-none",
            className,
          )}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div className="flex shrink-0 flex-col items-center px-4 pb-1 pt-2">
            <DrawerPrimitive.Handle
              className="!h-1 !w-10 shrink-0 !rounded-full !bg-muted-foreground/25"
              aria-label="Drag down to close"
            />
          </div>

          <div className="relative shrink-0 space-y-1 px-4 pb-2 pt-1 text-left">
            {showClose ? (
              <DrawerPrimitive.Close className="absolute right-0 top-0 rounded-sm p-2 text-foreground opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </DrawerPrimitive.Close>
            ) : null}
            <DrawerPrimitive.Title className="pr-8 text-lg font-semibold text-foreground">{title}</DrawerPrimitive.Title>
            {description ? (
              <DrawerPrimitive.Description className="text-sm text-muted-foreground">{description}</DrawerPrimitive.Description>
            ) : null}
          </div>

          <div className={cn("min-h-0 flex-1 overflow-hidden", bodyClassName)}>{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
