import { useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Link } from "wouter";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type FollowListPerson = {
  id: string;
  full_name: string;
  public_handle: string | null;
  avatar_url: string | null;
  /** Optional branded fallback when avatar_url is missing (e.g. Beatie bot). */
  fallbackSrc?: string | null;
};

export type FollowListKind = "followers" | "following";

type FollowListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: FollowListKind;
  people: FollowListPerson[];
  loading?: boolean;
  error?: string | null;
  /** Switch Followers / Following without closing the sheet. */
  onKindChange?: (kind: FollowListKind) => void;
  counts?: { followers: number; following: number };
};

function preventDialogAutoFocus(e: Event) {
  e.preventDefault();
}

function kindCopy(kind: FollowListKind) {
  if (kind === "following") {
    return {
      title: "Following",
      description: "People this profile follows on the Feed.",
      empty: "Not following anyone yet.",
      emptyFilter: "No one matches that search.",
    };
  }
  return {
    title: "Followers",
    description: "People who follow this profile on the Feed.",
    empty: "No followers yet.",
    emptyFilter: "No one matches that search.",
  };
}

function matchesQuery(person: FollowListPerson, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!q) return true;
  const name = person.full_name.trim().toLowerCase();
  const handle = (person.public_handle ?? "").trim().toLowerCase();
  return name.includes(q) || handle.includes(q);
}

function FollowListKindTabs({
  kind,
  counts,
  onKindChange,
}: {
  kind: FollowListKind;
  counts?: { followers: number; following: number };
  onKindChange: (kind: FollowListKind) => void;
}) {
  const options: { value: FollowListKind; label: string; count?: number }[] = [
    { value: "followers", label: "Followers", count: counts?.followers },
    { value: "following", label: "Following", count: counts?.following },
  ];

  return (
    <div
      className="grid grid-cols-2 rounded-full border border-border/50 bg-muted/35 p-0.5"
      role="tablist"
      aria-label="Follow lists"
    >
      {options.map((opt) => {
        const active = kind === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) onKindChange(opt.value);
            }}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span className={cn("tabular-nums", active ? "text-foreground/70" : "text-muted-foreground/80")}>
                {opt.count.toLocaleString()}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FollowListPersonSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 px-3 py-2.5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-36 max-w-[70%]" />
        <Skeleton className="h-3 w-24 max-w-[45%]" />
      </div>
    </li>
  );
}

function FollowListBody({
  kind,
  people,
  loading,
  error,
  onNavigate,
  onKindChange,
  counts,
}: {
  kind: FollowListKind;
  people: FollowListPerson[];
  loading: boolean;
  error: string | null;
  onNavigate: () => void;
  onKindChange?: (kind: FollowListKind) => void;
  counts?: { followers: number; following: number };
}) {
  const [query, setQuery] = useState("");
  const copy = kindCopy(kind);
  const filtered = useMemo(() => people.filter((p) => matchesQuery(p, query)), [people, query]);
  const showSearch = !loading && !error && people.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2.5 px-4 pb-2 sm:px-5">
        {onKindChange ? <FollowListKindTabs kind={kind} counts={counts} onKindChange={onKindChange} /> : null}
        {showSearch ? (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or @handle"
              aria-label={`Search ${copy.title.toLowerCase()}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11 rounded-full border-border/45 bg-muted/40 pl-10 pr-10 text-[15px] shadow-none"
            />
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 sm:px-5 sm:pb-5 [-webkit-overflow-scrolling:touch] max-h-[min(68dvh,32rem)]"
        data-testid="follow-list-scroll"
      >
        {loading ? (
          <ul className="m-0 list-none space-y-2 p-0" aria-busy="true" aria-label="Loading list">
            {Array.from({ length: 6 }, (_, i) => (
              <FollowListPersonSkeleton key={i} />
            ))}
          </ul>
        ) : error ? (
          <p className="px-1 py-10 text-center text-sm text-destructive">{error}</p>
        ) : people.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <Users className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground">{copy.empty}</p>
            <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
              {kind === "following"
                ? "When they follow people on the Feed, they’ll show up here."
                : "When people follow this profile, they’ll show up here."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">{copy.emptyFilter}</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {filtered.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/community/profile/${encodeURIComponent(row.id)}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-border/45 bg-card/60 px-3 py-2.5 shadow-sm",
                    "transition-colors hover:bg-card/90 active:bg-muted/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  )}
                >
                  <CommunityAuthorAvatar
                    displayName={row.full_name}
                    avatarPath={row.avatar_url}
                    size="md"
                    className="h-11 w-11"
                    fallbackSrc={row.fallbackSrc}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight text-foreground">
                      {row.full_name}
                    </div>
                    {row.public_handle ? (
                      <div className="truncate text-xs text-muted-foreground">@{row.public_handle}</div>
                    ) : (
                      <div className="truncate text-xs text-muted-foreground/70">View profile</div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Followers / Following picker. Uses a real bottom sheet on phones so the list
 * can scroll fully; desktop keeps a fixed-height dialog with the same body.
 */
export function FollowListDialog({
  open,
  onOpenChange,
  kind,
  people,
  loading = false,
  error = null,
  onKindChange,
  counts,
}: FollowListDialogProps) {
  const isMobile = useIsMobile();
  const copy = kindCopy(kind);
  const bodyKey = `${kind}-${open ? "open" : "closed"}-${people.length}-${loading ? "1" : "0"}`;

  const body = (
    <FollowListBody
      key={bodyKey}
      kind={kind}
      people={people}
      loading={loading}
      error={error}
      onNavigate={() => onOpenChange(false)}
      onKindChange={onKindChange}
      counts={counts}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={copy.title}
        className="max-h-[min(92dvh,720px)]"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        onOpenAutoFocus={preventDialogAutoFocus}
      >
        {body}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} mobileSheet={false}>
      <DialogContent
        className="flex max-h-[min(85dvh,36rem)] flex-col gap-0 overflow-hidden rounded-[1.35rem] p-0 sm:max-w-md"
        onOpenAutoFocus={preventDialogAutoFocus}
      >
        <DialogHeader className="shrink-0 space-y-0 px-5 pb-3 pt-5 text-left">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="sr-only">{copy.description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
