import type { ReactNode } from "react";
import { Link } from "wouter";
import { BadgeCheck, ShieldAlert } from "lucide-react";
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
}: ProfileAvatarTileProps) {
  const showImage = Boolean(imageUrl);
  const inner = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/80 ring-2 ring-background shadow-sm dark:bg-muted/50",
        avatarSizeClass[size],
        href && "avatar-hover-scale transition-transform",
      )}
      data-testid={testId}
    >
      {showImage ? (
        <img src={imageUrl!} alt={alt} className="h-full w-full object-cover" onError={onImageError} />
      ) : (
        <span className="text-xl font-semibold text-muted-foreground sm:text-2xl" aria-hidden>
          {initials}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background" aria-label={alt}>
        {inner}
      </Link>
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
