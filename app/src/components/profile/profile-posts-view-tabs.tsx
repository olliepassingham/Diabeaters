import { Grid3X3, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfilePostsView = "list" | "photos";

export const PROFILE_POSTS_VIEW_KEY = "diabeater.community.profile_posts_view";

export function readStoredProfilePostsView(): ProfilePostsView {
  if (typeof window === "undefined") return "list";
  try {
    const raw = window.localStorage.getItem(PROFILE_POSTS_VIEW_KEY);
    if (raw === "photos" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return "list";
}

export function persistProfilePostsView(view: ProfilePostsView): void {
  try {
    window.localStorage.setItem(PROFILE_POSTS_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

export function ProfilePostsViewTabs({
  value,
  onChange,
  className,
}: {
  value: ProfilePostsView;
  onChange: (view: ProfilePostsView) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex rounded-full border border-border/50 bg-muted/30 p-0.5", className)}
      role="tablist"
      aria-label="Posts view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "list"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          value === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
        onClick={() => onChange("list")}
      >
        <LayoutList className="h-3.5 w-3.5" aria-hidden />
        All
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "photos"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
          value === "photos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
        onClick={() => onChange("photos")}
      >
        <Grid3X3 className="h-3.5 w-3.5" aria-hidden />
        Photos
      </button>
    </div>
  );
}
