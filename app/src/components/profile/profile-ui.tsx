import type { ReactNode } from "react";
import { Link } from "wouter";
import { BadgeCheck, Camera, Clock3, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HomeSectionHeading } from "@/components/home/home-ui";
import { cn } from "@/lib/utils";

export const profileHeroCardClass =
  "dashboard-card-hover animate-soft-in overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent shadow-md ring-1 ring-border/25 dark:border-primary/18 dark:from-primary/[0.09]";

export function ProfileHeroCard({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <Card variant="glass-strong" className={cn(profileHeroCardClass, className)} data-testid={testId}>
      <CardContent className="relative p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

export function ProfileMutedCard({
  children,
  className,
  id,
  testId,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  testId?: string;
}) {
  return (
    <Card
      id={id}
      variant="glass-muted"
      className={cn("animate-soft-in border-0 shadow-sm", id && "scroll-mt-24", className)}
      data-testid={testId}
    >
      <CardContent className="p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

export function ProfileSectionHeading(props: { title: string; subtitle?: string }) {
  return <HomeSectionHeading title={props.title} subtitle={props.subtitle} />;
}

type ProfileAvatarTileProps = {
  imageUrl?: string | null;
  initials: string;
  alt?: string;
  href?: string;
  testId?: string;
  size?: "md" | "lg";
  onImageError?: () => void;
  /** Opens file picker / upload flow; mutually exclusive with `href`. */
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  actionLabel?: string;
};

const avatarSizeClass = {
  md: "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]",
  lg: "h-[4.25rem] w-[4.25rem] sm:h-24 sm:w-24",
};

export function ProfileAvatarTile({
  imageUrl,
  initials,
  alt = "Profile photo",
  href,
  testId,
  size = "lg",
  onImageError,
  onClick,
  disabled = false,
  busy = false,
  actionLabel = "Change profile photo",
}: ProfileAvatarTileProps) {
  const showImage = Boolean(imageUrl);
  const interactive = Boolean(onClick) && !href;
  const imgAlt = interactive ? "" : alt;

  const inner = (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/80 ring-2 ring-background shadow-sm dark:bg-muted/50",
        avatarSizeClass[size],
        (href || interactive) && "avatar-hover-scale transition-transform",
        interactive && !disabled && "group-hover:ring-primary/30",
      )}
      data-testid={interactive ? undefined : testId}
    >
      {showImage ? (
        <img src={imageUrl!} alt={imgAlt} className="h-full w-full object-cover" onError={onImageError} />
      ) : (
        <span className="text-xl font-semibold text-muted-foreground sm:text-2xl" aria-hidden>
          {initials}
        </span>
      )}
      {interactive && busy ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
      ) : null}
      {interactive && !busy && !disabled ? (
        <div
          className="absolute bottom-0.5 right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm"
          aria-hidden
        >
          <Camera className="h-3 w-3" />
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" aria-label={alt}>
        {inner}
      </Link>
    );
  }

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        aria-label={busy ? "Uploading profile photo" : actionLabel}
        data-testid={testId ?? "avatar-change"}
        className={cn(
          "group shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          (disabled || busy) && "cursor-not-allowed opacity-80",
        )}
      >
        {inner}
      </button>
    );
  }

  return inner;
}

/** Avatar left, identity column right — use on all breakpoints to save vertical space. */
export function ProfileHeroRow({ avatar, children }: { avatar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 sm:gap-3.5">
      <div className="shrink-0">{avatar}</div>
      <div className="min-w-0 flex-1 flex flex-col gap-1 sm:gap-1.5">{children}</div>
    </div>
  );
}

export function ProfileHeroNameRow({ children }: { children: ReactNode }) {
  return <div className="flex items-start justify-between gap-2 min-w-0">{children}</div>;
}

/** Handle, badges, and other short meta on one wrapped row. */
export function ProfileMetaRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">{children}</div>;
}

export function ProfileDisplayName({
  name,
  href,
  testId,
  compact,
}: {
  name: string;
  href?: string;
  testId?: string;
  compact?: boolean;
}) {
  const className = cn(
    "truncate font-display font-semibold tracking-tight text-foreground",
    compact ? "text-lg leading-tight sm:text-xl" : "text-2xl sm:text-[1.65rem]",
  );
  if (href) {
    return (
      <Link href={href} className={cn("block min-w-0 hover:text-primary transition-colors", className)} data-testid={testId}>
        {name}
      </Link>
    );
  }
  return (
    <h1 className={className} data-testid={testId}>
      {name}
    </h1>
  );
}

export function ProfileHandle({ handle, missingHref }: { handle?: string | null; missingHref?: string }) {
  if (handle) {
    return <span className="text-sm text-muted-foreground truncate">@{handle.replace(/^@/, "")}</span>;
  }
  if (missingHref) {
    return (
      <span className="text-sm text-muted-foreground">
        No handle.{" "}
        <a href={missingHref} className="font-medium text-primary underline-offset-4 hover:underline">
          Add one
        </a>
      </span>
    );
  }
  return null;
}

export function ProfileFollowStats({
  followers,
  following,
  onFollowersClick,
  onFollowingClick,
  followersTestId,
  followingTestId,
  variant = "compact",
}: {
  followers: number;
  following: number;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  followersTestId?: string;
  followingTestId?: string;
  variant?: "compact" | "pill";
}) {
  if (variant === "pill") {
    return (
      <div
        className="inline-flex items-stretch overflow-hidden rounded-xl border border-border/50 bg-background/50 text-sm shadow-sm dark:bg-background/30"
        role="group"
        aria-label="Follower stats"
      >
        <ProfileFollowStatButton count={followers} label="followers" onClick={onFollowersClick} testId={followersTestId} pill />
        <div className="w-px self-stretch bg-border/60" aria-hidden />
        <ProfileFollowStatButton count={following} label="following" onClick={onFollowingClick} testId={followingTestId} pill />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm" role="group" aria-label="Follower stats">
      <ProfileFollowStatButton count={followers} label="followers" onClick={onFollowersClick} testId={followersTestId} />
      <ProfileFollowStatButton count={following} label="following" onClick={onFollowingClick} testId={followingTestId} />
    </div>
  );
}

function ProfileFollowStatButton({
  count,
  label,
  onClick,
  testId,
  pill,
}: {
  count: number;
  label: string;
  onClick?: () => void;
  testId?: string;
  pill?: boolean;
}) {
  const content = (
    <>
      <span className="font-semibold tabular-nums text-foreground">{count}</span>{" "}
      <span className={pill ? "text-muted-foreground" : "text-muted-foreground"}>{label}</span>
    </>
  );
  const className = pill
    ? "px-3.5 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    : "text-left transition-colors hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} data-testid={testId}>
        {content}
      </button>
    );
  }

  return (
    <span className={cn(className, "cursor-default")} data-testid={testId}>
      {content}
    </span>
  );
}

export function ProfileVerifiedBadge({ verified, compact }: { verified: boolean; compact?: boolean }) {
  return (
    <span
      data-testid={verified ? "status-verified" : "status-unverified"}
      className={cn(
        "inline-flex items-center rounded-full border font-medium shrink-0",
        compact ? "gap-1 px-2 py-0 text-[11px]" : "gap-1.5 px-2.5 py-0.5 text-xs",
        verified
          ? "border-emerald-500/30 bg-emerald-500/[0.08] text-foreground dark:border-emerald-500/25"
          : "border-border/60 bg-muted/40 text-muted-foreground",
      )}
    >
      {verified ? (
        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <ShieldAlert className="h-3.5 w-3.5 opacity-70" aria-hidden />
      )}
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

export function ProfileBioPreview({
  bio,
  livingWithLine,
  emptyLabel = "No bio yet.",
  compact,
}: {
  bio?: string | null;
  livingWithLine?: string | null;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const trimmed = bio?.trim();
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "leading-snug",
          compact ? "text-xs sm:text-sm" : "text-sm",
          trimmed ? "whitespace-pre-wrap text-foreground/90" : "italic text-muted-foreground",
          compact && trimmed && "line-clamp-2",
        )}
      >
        {trimmed || emptyLabel}
      </p>
      {livingWithLine ? (
        <p className={cn("text-muted-foreground truncate", compact ? "text-[11px] mt-0.5" : "text-xs mt-1")}>
          {livingWithLine}
        </p>
      ) : null}
    </div>
  );
}

export function ProfileActionGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 border-t border-border/40 pt-3 [&_a]:w-full [&_button]:w-full [&_a]:min-h-10 [&_button]:min-h-10 [&_a]:rounded-xl [&_button]:rounded-xl">
      {children}
    </div>
  );
}

export const profileFormCardClass =
  "animate-soft-in overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm";

/** Settings-style profile editor card (Account tab). */
export function ProfileFormCard({
  children,
  className,
  id,
  testId,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  testId?: string;
}) {
  return (
    <Card
      id={id}
      variant="glass-strong"
      className={cn(profileFormCardClass, id && "scroll-mt-24", className)}
      data-testid={testId}
    >
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export function ProfileStatusPill({ isPublic, complete }: { isPublic: boolean; complete: boolean }) {
  if (!isPublic) {
    return (
      <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Private
      </span>
    );
  }
  if (complete) {
    return (
      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
        On Feed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
      Setup needed
    </span>
  );
}

export function ProfileCommunityPreview({
  handleSlug,
  bio,
  livingWithLine,
  showOnset,
  onAddBio,
}: {
  handleSlug: string | null;
  bio?: string | null;
  livingWithLine: string | null;
  showOnset: boolean;
  onAddBio?: () => void;
}) {
  return (
    <div
      className="rounded-xl bg-muted/20 px-3.5 py-3.5 ring-1 ring-border/40"
      data-testid="account-community-preview"
    >
      {handleSlug ? (
        <Link
          href={`/community/u/${encodeURIComponent(handleSlug)}`}
          className="text-base font-semibold text-primary underline-offset-4 hover:underline"
          data-testid="account-community-handle-readonly"
        >
          @{handleSlug}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="account-community-handle-empty">
          No handle yet
        </p>
      )}
      <div className="mt-2.5">
        {bio?.trim() ? (
          <p
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
            data-testid="account-community-bio-readonly"
          >
            {bio}
          </p>
        ) : onAddBio ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            onClick={onAddBio}
            data-testid="account-community-bio-empty"
          >
            Add a short bio for the Feed
          </button>
        ) : (
          <p className="text-sm italic text-muted-foreground" data-testid="account-community-bio-empty">
            No bio yet
          </p>
        )}
      </div>
      {showOnset ? (
        livingWithLine ? (
          <p
            className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="account-community-onset-highlight"
          >
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            {livingWithLine}
          </p>
        ) : (
          <p className="mt-2.5 text-xs text-muted-foreground" data-testid="account-community-onset-empty">
            Diabetes journey not shared
          </p>
        )
      ) : null}
    </div>
  );
}

export function ProfileFormInset({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-background/40 p-3 shadow-sm dark:bg-background/25 sm:p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProfileFormStack({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-border/40", className)}>{children}</dl>;
}

export function ProfileReadOnlyRow({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4" data-testid={testId}>
      <dt className="text-xs font-medium text-muted-foreground sm:w-[7.5rem] sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function ProfileToggleRow({
  label,
  description,
  hint,
  control,
  footer,
}: {
  label: ReactNode;
  description?: string;
  hint?: ReactNode;
  control: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        {hint ? <div className="pt-1">{hint}</div> : null}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
