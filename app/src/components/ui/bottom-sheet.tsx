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
  /**
   * When true, swipe-to-dismiss only works from the drag handle.
   * Prefer false (default) so pulling down from the top of the sheet — or from
   * scrollable content once it’s already at the top — dismisses like a native app sheet.
   */
  handleOnly?: boolean;
  showClose?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
};

/**
 * Mobile bottom sheet (vaul). Drag down from the top (or overscroll at the top of
 * the body) to dismiss — same feel as iOS/Android sheets.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  bodyClassName,
  handleOnly = false,
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
          {/* Top chrome is the primary swipe-down target. Keep title outside vaul’s
              Handle (Handle is aria-hidden) so the sheet stays accessible. */}
          <div className="relative shrink-0">
            {showClose ? (
              <DrawerPrimitive.Close
                className="absolute right-3 top-3 z-10 rounded-sm p-2 text-foreground opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-vaul-no-drag
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </DrawerPrimitive.Close>
            ) : null}

            <div className="flex flex-col items-center px-4 pb-3 pt-1.5 text-left">
              <DrawerPrimitive.Handle
                className="mb-2 !mt-0 !h-1 !w-10 shrink-0 !rounded-full !bg-muted-foreground/30"
                aria-label="Drag down to close"
              />
              <div className="w-full space-y-1 pr-8 pt-0.5">
                <DrawerPrimitive.Title className="text-lg font-semibold text-foreground">
                  {title}
                </DrawerPrimitive.Title>
                {description ? (
                  <DrawerPrimitive.Description className="text-sm text-muted-foreground">
                    {description}
                  </DrawerPrimitive.Description>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cn("min-h-0 flex-1 overflow-hidden", bodyClassName)}>{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
