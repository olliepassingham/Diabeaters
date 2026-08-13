import { Link } from "wouter";
import { ChevronRight, Heart, type LucideIcon } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Badge } from "@/components/ui/badge";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostLikerDisplay } from "@/lib/community";

export function CommunityPeopleSheet({
  title,
  subtitle,
  icon: Icon = Heart,
  rows,
  loading,
  error,
  emptyTitle,
  loadingLabel,
  errorLabel,
  countLabel,
  truncatedNote,
  onNavigate,
}: {
  title: string;
  subtitle?: string | null;
  icon?: LucideIcon;
  rows: PostLikerDisplay[];
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  loadingLabel: string;
  errorLabel: string;
  countLabel: (count: number) => string;
  truncatedNote?: string | null;
  onNavigate: () => void;
}) {
  return (
    <DialogContent className="flex max-h-[min(72vh,32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
      <DialogHeader className="space-y-0 border-b border-border/50 px-4 py-3.5 text-left sm:px-5 sm:py-4">
        <div className="flex items-start gap-3 pr-8">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
            aria-hidden
          >
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold leading-tight">{title}</DialogTitle>
              {!loading && !error && rows.length > 0 ? (
                <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-1.5 text-[10px] tabular-nums">
                  {rows.length}
                </Badge>
              ) : null}
            </div>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {loading ? loadingLabel : error ? errorLabel : rows.length === 0 ? emptyTitle : countLabel(rows.length)}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
        {loading ? (
          <div className="space-y-1 px-1 py-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-16 opacity-70" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <Icon className="h-6 w-6 text-muted-foreground/40" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">{emptyTitle}</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((row) => (
              <li key={row.user_id}>
                <Link
                  href={`/community/profile/${row.user_id}`}
                  className="flex min-h-12 items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-muted/50 active:bg-muted/70"
                  onClick={onNavigate}
                >
                  <CommunityAuthorAvatar size="md" displayName={row.name} avatarPath={row.avatar_url} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{row.name}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {truncatedNote ? (
        <p className="border-t border-border/50 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
          {truncatedNote}
        </p>
      ) : null}
    </DialogContent>
  );
}
