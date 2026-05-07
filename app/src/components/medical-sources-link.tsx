import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function MedicalSourcesLink(props: {
  /** Anchor on /medical-sources, without the leading # */
  anchor: string;
  className?: string;
  /** Optional classes for the inner link (e.g. on coloured banners). */
  linkClassName?: string;
  /** When true, only show the sources link line. */
  compact?: boolean;
}) {
  const href = `/medical-sources#${props.anchor}`;
  return (
    <div className={cn("text-xs text-muted-foreground", props.className)} data-testid="medical-sources-link">
      <p>
        <Link
          href={href}
          className={cn("underline underline-offset-2 hover:text-foreground", props.linkClassName)}
        >
          Sources
        </Link>
        {!props.compact ? (
          <span>
            {" "}
            · Educational only — not medical advice. Always follow your care team.
          </span>
        ) : null}
      </p>
    </div>
  );
}

