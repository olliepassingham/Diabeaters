import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { cn } from "@/lib/utils";

type Props = {
  displayName: string;
  avatarPath: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
  /** When set, the avatar is a link to this path (e.g. `/community/profile/:id`). */
  profileHref?: string;
};

/**
 * Resolves `profiles.avatar_url` (storage key or URL) for community posts/comments.
 */
export function CommunityAuthorAvatar({
  displayName,
  avatarPath,
  size = "md",
  className,
  profileHref,
}: Props) {
  const { displayUrl } = useResolvedProfileImageUrl(avatarPath ?? null);
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "?";
  const rootClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const fallbackClass = size === "sm" ? "text-xs" : "text-sm";

  const label = `View ${displayName}'s profile`;

  const avatar = (
    <Avatar className={cn(rootClass, "shrink-0", className)}>
      {displayUrl ? <AvatarImage src={displayUrl} alt="" /> : null}
      <AvatarFallback className={cn("bg-muted font-medium", fallbackClass)}>{initial}</AvatarFallback>
    </Avatar>
  );

  if (profileHref) {
    return (
      <Link
        href={profileHref}
        className="shrink-0 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={label}
        title={label}
      >
        {avatar}
      </Link>
    );
  }

  return avatar;
}
