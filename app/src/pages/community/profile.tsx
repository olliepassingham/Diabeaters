import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { MessageCircle, UserCheck, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { FeedPostList } from "@/components/community/feed-post-list";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  blockUser,
  fetchCommunityPostsByAuthorPage,
  getBlockStatus,
  getFollowCounts,
  getOrCreateDmThread,
  isFollowing,
  listFollowers,
  listFollowing,
  submitContentReport,
  unfollowUser,
  followUser,
  unblockUser,
} from "@/lib/community";
import {
  formatLivingWithDiabetesLine,
  getProfile,
  getPublicCommunityProfile,
  getProfilesByIds,
  type PublicCommunityProfile,
} from "@/lib/profile";
import { isSupabaseConfigured } from "@/lib/supabase";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type ListKind = "followers" | "following";

export default function CommunityProfilePage() {
  const [, params] = useRoute("/community/profile/:userId");
  const userId = params?.userId ?? null;
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [profile, setProfile] = useState<PublicCommunityProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followingThem, setFollowingThem] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [blockStatus, setBlockStatus] = useState({ iBlockedThem: false, theyBlockedMe: false });

  const [listOpen, setListOpen] = useState(false);
  const [listKind, setListKind] = useState<ListKind>("followers");
  const [listIds, setListIds] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const isSelf = Boolean(user?.id && userId && user.id === userId);

  const loginNextHref = useMemo(() => {
    if (!userId) return "/community";
    return `/login?next=${encodeURIComponent(`/community/profile/${userId}`)}`;
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!userId || authLoading) return;
    setLoading(true);
    setLoadError(null);
    const viewingSelf = user?.id === userId;
    try {
      if (viewingSelf) {
        const { profile: full } = await getProfile(userId);
        if (!full) {
          setProfile(null);
          setLoadError("Could not load profile.");
        } else {
          setProfile({
            id: full.id,
            full_name: full.full_name,
            avatar_url: full.avatar_url,
            bio: full.bio,
            public_handle: full.public_handle,
            is_public: full.is_public,
            diabetes_onset_date: full.diabetes_onset_date ?? null,
          });
        }
      } else {
        const { profile: pub, error } = await getPublicCommunityProfile(userId);
        if (error) {
          setLoadError(error.message);
          setProfile(null);
        } else {
          setProfile(pub);
          if (!pub) setLoadError("This profile is private or not available.");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id, authLoading]);

  const refreshSocial = useCallback(async () => {
    if (!userId) return;
    const [{ followers, following, error: cErr }, fol, blk] = await Promise.all([
      getFollowCounts(userId),
      user?.id && user.id !== userId ? isFollowing(userId) : Promise.resolve({ value: false, error: null }),
      user?.id && user.id !== userId ? getBlockStatus(userId) : Promise.resolve({ status: { iBlockedThem: false, theyBlockedMe: false }, error: null }),
    ]);
    if (!cErr) setCounts({ followers, following });
    if (fol.error == null) setFollowingThem(fol.value);
    if (blk.error == null) setBlockStatus(blk.status);
  }, [userId, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void loadProfile();
  }, [loadProfile, authLoading]);

  useEffect(() => {
    if (authLoading || !userId) return;
    void refreshSocial();
  }, [refreshSocial, authLoading, userId]);

  const displayName = profile?.full_name?.trim() || (userId ? shortId(userId) : "Member");
  const { displayUrl: avatarDisplayUrl } = useResolvedProfileImageUrl(profile?.avatar_url ?? null);

  async function openList(kind: ListKind) {
    if (!userId) return;
    setListKind(kind);
    setListOpen(true);
    setListLoading(true);
    setListIds([]);
    const res = kind === "followers" ? await listFollowers(userId) : await listFollowing(userId);
    setListLoading(false);
    if (res.error) {
      toast({ title: "Could not load list", description: res.error.message, variant: "destructive" });
      return;
    }
    setListIds(res.ids);
  }

  async function toggleFollow() {
    if (!userId || !user?.id || isSelf) return;
    if (blockStatus.iBlockedThem || blockStatus.theyBlockedMe) return;
    setFollowBusy(true);
    if (followingThem) {
      const { error } = await unfollowUser(userId);
      if (error) {
        toast({ title: "Unfollow failed", description: error.message, variant: "destructive" });
      } else {
        setFollowingThem(false);
        setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      }
    } else {
      const { error } = await followUser(userId);
      if (error) {
        toast({ title: "Follow failed", description: error.message, variant: "destructive" });
      } else {
        setFollowingThem(true);
        setCounts((c) => ({ ...c, followers: c.followers + 1 }));
      }
    }
    setFollowBusy(false);
  }

  async function openMessages() {
    if (!userId || !user?.id || isSelf) return;
    const { data, error } = await getOrCreateDmThread(userId);
    if (error) {
      const msg = error.message.toLowerCase().includes("dm_not_allowed") || error.message.includes("blocked")
        ? "Messaging is not available (blocked)."
        : error.message;
      toast({ title: "Messages", description: msg, variant: "destructive" });
      return;
    }
    if (data) setLocation(`/community/messages/${data}`);
  }

  async function confirmBlock() {
    if (!userId) return;
    setBlockConfirmOpen(false);
    const { error } = await blockUser(userId);
    if (error) {
      toast({ title: "Block failed", description: error.message, variant: "destructive" });
      return;
    }
    setBlockStatus((s) => ({ ...s, iBlockedThem: true }));
    setFollowingThem(false);
    toast({ title: "Blocked", description: "You will not see each other’s posts or start new chats." });
    setLocation("/community");
  }

  async function handleUnblock() {
    if (!userId) return;
    const { error } = await unblockUser(userId);
    if (error) {
      toast({ title: "Unblock failed", description: error.message, variant: "destructive" });
      return;
    }
    setBlockStatus((s) => ({ ...s, iBlockedThem: false }));
    void refreshSocial();
    toast({ title: "Unblocked" });
  }

  async function submitReport() {
    if (!userId) return;
    setReportBusy(true);
    const { error } = await submitContentReport({
      targetType: "profile",
      targetId: userId,
      reason: reportReason.trim() || null,
    });
    setReportBusy(false);
    if (error) {
      toast({ title: "Report failed", description: error.message, variant: "destructive" });
      return;
    }
    setReportOpen(false);
    setReportReason("");
    toast({ title: "Thanks", description: "Your report was submitted." });
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Profile" />
        <p className="text-sm text-muted-foreground">Connect Supabase to view public profiles.</p>
      </PageShell>
    );
  }

  if (!userId) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-4">
        <PageHeader leading={<PageBackButton />} title="Profile" />
        <p className="text-sm text-muted-foreground">Invalid link.</p>
      </PageShell>
    );
  }

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-4 pb-24">
      <PageHeader
        leading={<PageBackButton />}
        title="Profile"
        actions={
          isSelf ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/account#community">Edit</Link>
            </Button>
          ) : !isSelf && user && profile ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant={followingThem ? "secondary" : "default"}
                disabled={
                  followBusy || blockStatus.iBlockedThem || blockStatus.theyBlockedMe
                }
                onClick={() => void toggleFollow()}
                className="gap-1.5"
              >
                {followingThem ? (
                  <UserCheck className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {followingThem ? "Following" : "Follow"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={blockStatus.iBlockedThem || blockStatus.theyBlockedMe}
                onClick={() => void openMessages()}
                className="gap-1.5"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                Message
              </Button>
            </div>
          ) : !isSelf && !user && profile && !loading && !authLoading ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={loginNextHref}>Sign in to follow or message</Link>
            </Button>
          ) : null
        }
      />

      {loading || authLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">{loadError ?? "Profile not found."}</p>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4">
              <div className="shrink-0">
                {avatarDisplayUrl ? (
                  <img
                    src={avatarDisplayUrl}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover border border-border"
                  />
                ) : (
                  <CommunityAuthorAvatar displayName={displayName} avatarPath={profile.avatar_url} />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="text-lg font-semibold leading-tight">{displayName}</h1>
                {profile.public_handle ? (
                  <p className="text-sm text-muted-foreground">@{profile.public_handle}</p>
                ) : null}
                {isSelf && !profile.is_public ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Your profile is hidden from others.</p>
                ) : null}
              </div>
            </div>

            {profile.bio?.trim() ? (
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{profile.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No bio yet.</p>
            )}

            {profile.diabetes_onset_date && formatLivingWithDiabetesLine(profile.diabetes_onset_date) ? (
              <p className="text-sm text-muted-foreground">
                {formatLivingWithDiabetesLine(profile.diabetes_onset_date)}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className="text-left hover:underline underline-offset-4"
                onClick={() => void openList("followers")}
              >
                <span className="font-semibold text-foreground">{counts.followers}</span>{" "}
                <span className="text-muted-foreground">followers</span>
              </button>
              <button
                type="button"
                className="text-left hover:underline underline-offset-4"
                onClick={() => void openList("following")}
              >
                <span className="font-semibold text-foreground">{counts.following}</span>{" "}
                <span className="text-muted-foreground">following</span>
              </button>
            </div>

            {!isSelf && !user && profile ? (
              <p className="text-sm text-muted-foreground pt-1">
                <Link href={loginNextHref} className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                to follow or message this person.
              </p>
            ) : null}

            {!isSelf && user ? (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
                {blockStatus.iBlockedThem ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleUnblock()}>
                    Unblock
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setBlockConfirmOpen(true)}>
                    Block
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
                  Report
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {!loading && !authLoading && profile ? (
        !user ? (
          <Card>
            <CardContent className="pt-5 space-y-2">
              <p className="text-sm font-medium text-foreground">Posts</p>
              <p className="text-sm text-muted-foreground">
                <Link href={loginNextHref} className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                to view posts from this member.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="pt-1">
            <div className="flex items-baseline justify-between pb-1">
              <h2 className="text-sm font-semibold text-foreground">{isSelf ? "Your posts" : "Posts"}</h2>
            </div>
            <FeedPostList
              viewerId={user.id}
              pageSize={20}
              showRefreshButton={false}
              emptyStateTitle="No posts yet"
              emptyStateDescription={isSelf ? "You haven’t posted yet." : "This member hasn’t posted yet."}
              fetchPage={(limit, cursor) => fetchCommunityPostsByAuthorPage(userId, limit, cursor, null)}
            />
          </div>
        )
      ) : null}

      <UserListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        kind={listKind}
        userIds={listIds}
        loading={listLoading}
      />

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report profile</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tell us briefly what is wrong. This is for safety review only, not medical advice.
          </p>
          <Textarea
            rows={4}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Optional details"
            maxLength={2000}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitReport()} disabled={reportBusy}>
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this person?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not see each other’s posts or comments, and you cannot start a direct message thread.
              You can unblock later from their profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmBlock()}>Block</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function UserListDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: ListKind;
  userIds: string[];
  loading: boolean;
}) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!props.open || props.userIds.length === 0) {
      setLabels({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const map = await getProfilesByIds(props.userIds);
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const id of props.userIds) {
        const p = map.get(id);
        next[id] = p?.full_name?.trim() || shortId(id);
      }
      setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.userIds]);

  const title = props.kind === "followers" ? "Followers" : "Following";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto space-y-2 pr-1">
          {props.loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : props.userIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet.</p>
          ) : (
            <ul className="space-y-1">
              {props.userIds.map((id) => (
                <li key={id}>
                  <Link
                    href={`/community/profile/${id}`}
                    className="block rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                    onClick={() => props.onOpenChange(false)}
                  >
                    {labels[id] ?? shortId(id)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
