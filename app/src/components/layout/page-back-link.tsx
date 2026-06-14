import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getBackLabel, navigateBack, normalizeNavPath, resolveBackFallback } from "@/lib/nav-back";

export type PageBackLinkProps = {
  /** Parent route when browser history is empty (e.g. deep link). */
  fallbackHref?: string;
  /** Shown beside the chevron; defaults from fallback route. */
  label?: string;
  className?: string;
};

/** Prominent text back control for drill-down pages (settings, guides hub, etc.). */
export function PageBackLink({ fallbackHref, label, className }: PageBackLinkProps) {
  const [location, setLocation] = useLocation();
  const pathOnly = normalizeNavPath(location);
  const fallback = fallbackHref ?? resolveBackFallback(pathOnly) ?? "/";
  const displayLabel = label ?? getBackLabel(fallback);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? "-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"}
      aria-label={`Back to ${displayLabel}`}
      onClick={() => navigateBack(pathOnly, setLocation, fallbackHref)}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {displayLabel}
    </Button>
  );
}
