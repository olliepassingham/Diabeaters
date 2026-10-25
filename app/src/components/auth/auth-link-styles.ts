/** Secondary actions on auth screens — no underlines; rely on colour + hover. */
export const authFieldActionClass =
  "min-h-9 shrink-0 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const authInlineLinkClass =
  "font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm";

export const authMutedNavLinkClass =
  "text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm";

/**
 * Auth page shell (login/signup/reset/etc.).
 * Scrolls under Display Zoom / large text; top/bottom safe-area so the notch
 * never clips the logo or title. Pair column + centered body so short screens
 * stay vertically centred without cutting off the top when content is tall.
 */
export const authPageScrollClass =
  "h-dvh max-h-dvh overflow-y-auto overscroll-y-contain bg-background text-foreground [-webkit-overflow-scrolling:touch]";

export const authPageColumnClass =
  "mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-[max(2.5rem,calc(env(safe-area-inset-top)+1rem))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]";

export const authPageCenteredBodyClass = "my-auto w-full py-2";
