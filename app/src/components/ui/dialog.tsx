"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Drawer as DrawerPrimitive } from "vaul"
import { X } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

/** Overlay tier above BottomNav (z-[100]); matches sheet / bottom-sheet. */
const OVERLAY_Z = "z-[110]"

type DialogUiMode = "radix" | "sheet"

type DialogUiContextValue = {
  mode: DialogUiMode
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogUiContext = React.createContext<DialogUiContextValue | null>(null)

function useDialogUi(): DialogUiContextValue {
  const ctx = React.useContext(DialogUiContext)
  if (!ctx) {
    throw new Error("Dialog components must be used within <Dialog>")
  }
  return ctx
}

type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  /**
   * On phones, render as a swipeable bottom sheet (vaul) instead of a centered modal.
   * Set false for lightboxes / content that must stay centered.
   */
  mobileSheet?: boolean
}

function Dialog({
  mobileSheet = true,
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
  ...rest
}: DialogProps) {
  const isMobile = useIsMobile()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(Boolean(defaultOpen))
  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const useSheet = isMobile && mobileSheet
  const ui = React.useMemo<DialogUiContextValue>(
    () => ({
      mode: useSheet ? "sheet" : "radix",
      open,
      onOpenChange: handleOpenChange,
    }),
    [useSheet, open, handleOpenChange],
  )

  if (useSheet) {
    return (
      <DialogUiContext.Provider value={ui}>
        <DrawerPrimitive.Root
          open={open}
          onOpenChange={handleOpenChange}
          handleOnly={false}
          shouldScaleBackground={false}
          repositionInputs={false}
        >
          {children}
        </DrawerPrimitive.Root>
      </DialogUiContext.Provider>
    )
  }

  return (
    <DialogUiContext.Provider value={ui}>
      <DialogPrimitive.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...rest}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogUiContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ ...props }, ref) => {
  const { mode } = useDialogUi()
  if (mode === "sheet") {
    return <DrawerPrimitive.Trigger ref={ref} {...props} />
  }
  return <DialogPrimitive.Trigger ref={ref} {...props} />
})
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName

const DialogPortal = ({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>) => {
  const ctx = React.useContext(DialogUiContext)
  if (ctx?.mode === "sheet") {
    return <DrawerPrimitive.Portal {...props}>{children}</DrawerPrimitive.Portal>
  }
  return <DialogPrimitive.Portal {...props}>{children}</DialogPrimitive.Portal>
}

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ ...props }, ref) => {
  const { mode } = useDialogUi()
  if (mode === "sheet") {
    return <DrawerPrimitive.Close ref={ref} data-vaul-no-drag {...props} />
  }
  return <DialogPrimitive.Close ref={ref} {...props} />
})
DialogClose.displayName = DialogPrimitive.Close.displayName

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const ctx = React.useContext(DialogUiContext)
  if (ctx?.mode === "sheet") {
    return (
      <DrawerPrimitive.Overlay
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn("fixed inset-0 bg-black/80", OVERLAY_Z, className)}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 bg-black/80 duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        OVERLAY_Z,
        className,
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** ≥sm centered modal (desktop / forced non-sheet). */
const CENTERED_MODAL_CLASSES =
  "left-[50%] top-[50%] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-2xl data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /**
     * @deprecated Prefer `mobileSheet` on `<Dialog>`. Kept for call-site compatibility;
     * sheet vs centered is decided on the root from viewport + Dialog `mobileSheet`.
     */
    mobileSheet?: boolean
  }
>(({ className, children, mobileSheet: _mobileSheetProp, ...props }, ref) => {
  const { mode } = useDialogUi()

  if (mode === "sheet") {
    const {
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      onInteractOutside,
      ...rest
    } = props

    return (
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className={cn("fixed inset-0 bg-black/80", OVERLAY_Z)} />
        <DrawerPrimitive.Content
          ref={ref}
          className={cn(
            "fixed inset-x-0 bottom-0 flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))] flex-col overflow-hidden rounded-t-[1.35rem] border-t border-border/60 bg-background text-foreground shadow-lg outline-none",
            OVERLAY_Z,
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={onEscapeKeyDown}
          onPointerDownOutside={onPointerDownOutside}
          onInteractOutside={onInteractOutside}
          {...rest}
        >
          <div className="relative flex shrink-0 justify-center px-4 pb-1 pt-1.5">
            <DrawerPrimitive.Handle
              className="!mt-0 !h-1 !w-10 shrink-0 !rounded-full !bg-muted-foreground/30"
              aria-label="Drag down to close"
            />
            <DrawerPrimitive.Close
              className="absolute right-3 top-2.5 z-10 rounded-sm p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              data-vaul-no-drag
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-2",
              className,
            )}
          >
            {children}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed grid gap-4 border border-border/60 bg-background p-6 text-foreground shadow-lg duration-[var(--app-motion-duration)] ease-[var(--app-motion-ease)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          OVERLAY_Z,
          CENTERED_MODAL_CLASSES,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0",
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const { mode } = useDialogUi()
  const classes = cn("text-lg font-semibold leading-none tracking-tight", className)
  if (mode === "sheet") {
    return <DrawerPrimitive.Title ref={ref} className={classes} {...props} />
  }
  return <DialogPrimitive.Title ref={ref} className={classes} {...props} />
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const { mode } = useDialogUi()
  const classes = cn("text-sm leading-relaxed text-foreground/85", className)
  if (mode === "sheet") {
    return <DrawerPrimitive.Description ref={ref} className={classes} {...props} />
  }
  return <DialogPrimitive.Description ref={ref} className={classes} {...props} />
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
