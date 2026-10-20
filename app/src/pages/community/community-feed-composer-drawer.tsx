import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { isFilePickerActive, subscribeFilePickerActive } from "@/lib/click-hidden-file-input";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet for the feed composer (phone and desktop). Split out so `vaul` can be lazy-loaded
 * with the drawer chunk instead of the main community feed route.
 */
export function CommunityFeedComposerDrawer({
  open,
  onOpenChange,
  children,
  formId,
  canSubmit,
  submitting,
  submitLabel = "Post",
  busyLabel = null,
  title = "New post",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  formId: string;
  canSubmit: boolean;
  submitting: boolean;
  submitLabel?: string;
  busyLabel?: string | null;
  title?: string;
}) {
  const pickerActive = useSyncExternalStore(subscribeFilePickerActive, isFilePickerActive, () => false);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const scroller = document.getElementById("app-scroll-main");
    const lockedScroll = scroller?.scrollTop ?? 0;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.setAttribute("data-composer-sheet", "");
    const pin = () => {
      if (scroller && scroller.scrollTop !== lockedScroll) scroller.scrollTop = lockedScroll;
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    pin();
    scroller?.addEventListener("scroll", pin);
    window.addEventListener("scroll", pin);
    return () => {
      scroller?.removeEventListener("scroll", pin);
      window.removeEventListener("scroll", pin);
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      html.removeAttribute("data-composer-sheet");
    };
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      dismissible={!pickerActive}
      shouldScaleBackground={false}
      repositionInputs={false}
      handleOnly
      noBodyStyles
      onOpenChange={(next) => {
        if (!next && isFilePickerActive()) return;
        onOpenChange(next);
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-x-0 top-[var(--vv-offset-top,0px)] z-[110] h-[var(--vv-height,100dvh)] bg-black/55" />
        <Drawer.Content
          data-keyboard-sheet
          onScroll={(e) => {
            if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
          }}
          className={cn(
            "fixed inset-x-0 top-[var(--vv-offset-top,0px)] z-[110] flex h-[var(--vv-height,100dvh)] max-h-[var(--vv-height,100dvh)] flex-col overflow-clip bg-background p-0 text-foreground outline-none",
            "pt-[env(safe-area-inset-top,0px)]",
            "md:inset-x-auto md:bottom-0 md:left-1/2 md:right-auto md:top-auto md:h-auto md:max-h-[min(88dvh,760px)] md:w-full md:max-w-xl md:-translate-x-1/2 md:rounded-t-[1.25rem] md:border md:border-border/60 md:pt-2 md:shadow-2xl",
          )}
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-border/40 px-1.5 py-1.5" data-vaul-no-drag>
            <Drawer.Close
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-vaul-no-drag
            >
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">Close</span>
            </Drawer.Close>
            <Drawer.Title className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-foreground">
              {title}
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              Write a post, add a photo or video, or create a poll or event.
            </Drawer.Description>
            <button
              type="submit"
              form={formId}
              disabled={!canSubmit || submitting}
              data-vaul-no-drag
              className="mr-1.5 h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {submitting ? busyLabel ?? "Posting…" : submitLabel}
            </button>
          </div>
          {submitting && busyLabel ? (
            <p className="shrink-0 border-b border-border/40 px-4 py-2 text-[13px] text-muted-foreground" data-vaul-no-drag>
              {busyLabel === "Preparing…"
                ? "Preparing your photos…"
                : busyLabel === "Uploading…"
                  ? "Uploading. This can take a moment."
                  : "Sharing your post…"}
            </p>
          ) : null}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:max-h-[min(72dvh,640px)] md:flex-none"
            data-vaul-no-drag
            data-composer-scroll
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
