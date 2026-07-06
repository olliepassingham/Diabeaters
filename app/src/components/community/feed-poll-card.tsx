import { useEffect, useMemo, useState } from "react";
import { BarChart2, Loader2 } from "lucide-react";
import { Link } from "wouter";

import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE } from "@/lib/profile";
import {
  castPollVote,
  fetchPollVoteState,
  fetchPollVotersWithProfiles,
} from "@/lib/community";
import { cn } from "@/lib/utils";

export function FeedPollCard({
  postId,
  question,
  options,
  viewerId,
  canEngageWithFeed = true,
  className,
}: {
  postId: string;
  question: string;
  options: string[];
  viewerId: string | undefined;
  canEngageWithFeed?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [counts, setCounts] = useState<number[]>(() => Array.from({ length: options.length }, () => 0));
  const [myIdx, setMyIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [votersOpen, setVotersOpen] = useState(false);
  const [votersLoading, setVotersLoading] = useState(false);
  const [voters, setVoters] = useState<
    Array<{ user_id: string; name: string; avatar_url: string | null; option_index: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetchPollVoteState(postId, options.length);
      if (cancelled) return;
      setLoading(false);
      if (!r.error) {
        setCounts(r.counts);
        setMyIdx(r.myOptionIndex);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, options.length]);

  const total = useMemo(() => counts.reduce((a, b) => a + b, 0), [counts]);
  const hasVoted = myIdx !== null;
  const revealTallies = hasVoted;
  const mayEngage = Boolean(viewerId && canEngageWithFeed);

  async function onPick(i: number) {
    if (!viewerId) {
      toast({ title: "Sign in to vote", description: "Log in to cast your vote on this poll.", variant: "destructive" });
      return;
    }
    if (!canEngageWithFeed) {
      toast({
        title: "Choose a @handle first",
        description: COMMUNITY_FEED_ENGAGE_REQUIRED_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (voting) return;
    setVoting(true);
    const errRes = await castPollVote(postId, i);
    if (errRes.error) {
      setVoting(false);
      toast({ title: "Could not vote", description: errRes.error.message, variant: "destructive" });
      return;
    }
    const r = await fetchPollVoteState(postId, options.length);
    setVoting(false);
    if (!r.error) {
      setCounts(r.counts);
      setMyIdx(r.myOptionIndex);
    }
  }

  async function openVoters() {
    setVotersOpen(true);
    if (votersLoading || voters.length > 0) return;
    setVotersLoading(true);
    const res = await fetchPollVotersWithProfiles(postId);
    setVotersLoading(false);
    if (res.error) {
      toast({ title: "Could not load voters", description: res.error.message, variant: "destructive" });
      return;
    }
    setVoters(
      res.data.map((r) => ({
        user_id: r.user_id,
        name: r.name,
        avatar_url: r.avatar_url,
        option_index: r.option_index,
      })),
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-muted/15 shadow-sm ring-1 ring-border/40 dark:from-primary/10 dark:to-muted/10",
        className,
      )}
    >
      <div className="space-y-3 p-3.5 sm:p-4">
        <div className="flex items-start gap-2.5">
          <BarChart2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-display text-base font-semibold leading-snug tracking-tight text-foreground">
              {question}
            </p>
            {hasVoted && myIdx !== null ? (
              <p className="text-xs text-primary">
                You voted for <span className="font-medium">{options[myIdx]}</span>
              </p>
            ) : !loading && viewerId ? (
              <p className="text-xs text-muted-foreground">Tap an option to vote</p>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading poll…
          </div>
        ) : (
          <ul className="space-y-2" role="list">
            {options.map((label, i) => {
              const count = counts[i] ?? 0;
              const pct = total > 0 && revealTallies ? Math.round((count / total) * 100) : 0;
              const isMine = myIdx === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!mayEngage || voting}
                    aria-pressed={isMine}
                    aria-label={`Vote for ${label}${revealTallies ? `, ${pct}%` : ""}`}
                    onClick={() => void onPick(i)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-xl border text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isMine
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/25"
                        : "border-border/60 bg-background/40 hover:border-primary/30 hover:bg-background/70",
                      !viewerId && "cursor-not-allowed opacity-70",
                    )}
                  >
                    {revealTallies ? (
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
                          isMine ? "bg-primary/25" : "bg-muted/50",
                        )}
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative flex w-full items-center justify-between gap-3 px-3 py-2.5">
                      <span className={cn("min-w-0 text-sm leading-snug", isMine && "font-medium text-foreground")}>
                        {label}
                      </span>
                      {revealTallies ? (
                        <span className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground">
                          {pct}%
                          <span className="ml-1.5 text-[10px] font-normal opacity-80">({count})</span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!loading ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {total === 0
                ? "No votes yet"
                : `${total} ${total === 1 ? "vote" : "votes"}`}
            </p>
            {total > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs text-muted-foreground"
                onClick={() => void openVoters()}
              >
                View who voted
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={votersOpen} onOpenChange={setVotersOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Poll voters</DialogTitle>
            <DialogDescription>Who has voted so far (hidden for blocked users).</DialogDescription>
          </DialogHeader>
          {votersLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : voters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No votes yet.</p>
          ) : (
            <ul className="space-y-2">
              {voters.map((v) => (
                <li key={v.user_id}>
                  <Link
                    href={`/community/profile/${v.user_id}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-2 hover:bg-muted/40"
                    onClick={() => setVotersOpen(false)}
                  >
                    <CommunityAuthorAvatar
                      displayName={v.name}
                      avatarPath={v.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Voted: {options[v.option_index] ?? "—"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
