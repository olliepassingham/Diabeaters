import { lazy, Suspense, type FormEvent, type ReactNode } from "react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { FeedComposerFormBody, type FeedComposerFormBodyProps } from "@/components/community/feed-composer-form-body";
import { cn } from "@/lib/utils";

const CommunityFeedComposerDrawerLazy = lazy(() =>
  import("@/pages/community/community-feed-composer-drawer").then((m) => ({
    default: m.CommunityFeedComposerDrawer,
  })),
);

export const FEED_COMPOSER_PILL_CLASS =
  "flex w-full min-h-12 items-center gap-2.5 rounded-[1.35rem] border border-border/50 bg-gradient-to-br from-card via-card to-muted/25 px-3.5 py-2.5 text-left shadow-sm transition-transform active:scale-[0.99] dark:from-card/95 dark:to-muted/20";

type FeedComposerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pillPreview: string;
  avatarDisplayName: string;
  avatarPath: string | null;
  profileHref?: string;
  formBodyProps: FeedComposerFormBodyProps;
  onSubmit: (e: FormEvent) => void;
  /** When false, only the drawer is rendered (e.g. feed page renders its own pill). */
  showPill?: boolean;
  pillClassName?: string;
  pillTestId?: string;
  formTestId?: string;
  footer?: ReactNode;
  disabled?: boolean;
};

/**
 * Feed-style composer pill + lazy-loaded new-post bottom sheet (same UX as the Feed tab).
 */
export function FeedComposerSheet({
  open,
  onOpenChange,
  pillPreview,
  avatarDisplayName,
  avatarPath,
  profileHref,
  formBodyProps,
  onSubmit,
  showPill = true,
  pillClassName,
  pillTestId = "feed-composer-pill",
  formTestId = "feed-composer-form",
  footer,
  disabled,
}: FeedComposerSheetProps) {
  return (
    <>
      {showPill ? (
        <button
          type="button"
          className={cn(FEED_COMPOSER_PILL_CLASS, pillClassName)}
          onClick={() => !disabled && onOpenChange(true)}
          disabled={disabled}
          data-testid={pillTestId}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <CommunityAuthorAvatar
            displayName={avatarDisplayName}
            avatarPath={avatarPath}
            size="sm"
            profileHref={profileHref}
          />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{pillPreview}</span>
        </button>
      ) : null}

      <Suspense fallback={null}>
        <CommunityFeedComposerDrawerLazy open={open} onOpenChange={onOpenChange}>
          <form
            onSubmit={onSubmit}
            className="min-w-0 space-y-3 pb-2 text-foreground"
            data-testid={formTestId}
          >
            <FeedComposerFormBody {...formBodyProps} />
          </form>
        </CommunityFeedComposerDrawerLazy>
      </Suspense>

      {footer}
    </>
  );
}
