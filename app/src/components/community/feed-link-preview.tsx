import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  className?: string;
};

/**
 * Compact outbound link card for whitelisted https URLs (no OG fetch).
 */
export function FeedLinkPreview({ href, className }: Props) {
  let hostname = "";
  try {
    hostname = new URL(href).hostname;
  } catch {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
        className,
      )}
    >
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{hostname}</span>
        <span className="line-clamp-2 break-all text-xs text-muted-foreground">{href}</span>
      </span>
    </a>
  );
}
