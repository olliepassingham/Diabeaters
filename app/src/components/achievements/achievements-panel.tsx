import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProfileMutedCard, ProfileSectionHeading } from "@/components/profile/profile-ui";
import {
  ACHIEVEMENT_DEFINITIONS,
  computeProfileStreakDays,
  getAchievementDefinition,
  profileStreakKindIcon,
  profileStreakTooltip,
  type AchievementId,
  type ProfileStreakKind,
} from "@/lib/achievements";
import {
  loadEarnedAchievements,
  loadPinnedStreakKinds,
  localPublicProfileStreaks,
  MAX_PINNED_ACHIEVEMENTS,
  syncPinnedStreaksToProfile,
  togglePinnedStreakKind,
  USER_ACHIEVEMENTS_CHANGED_EVENT,
  type EarnedAchievement,
  type PublicProfileStreak,
} from "@/lib/user-achievements";
import { cn } from "@/lib/utils";

function sortEarned(rows: EarnedAchievement[]): EarnedAchievement[] {
  return [...rows].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

function useEarnedAchievementsState(): EarnedAchievement[] {
  const [earned, setEarned] = useState<EarnedAchievement[]>(() => sortEarned(loadEarnedAchievements()));

  useEffect(() => {
    const refresh = () => setEarned(sortEarned(loadEarnedAchievements()));
    window.addEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
  }, []);

  return earned;
}

function usePinnedStreakKindsState(): ProfileStreakKind[] {
  const [pinned, setPinned] = useState<ProfileStreakKind[]>(() => loadPinnedStreakKinds());

  useEffect(() => {
    const refresh = () => setPinned(loadPinnedStreakKinds());
    window.addEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
  }, []);

  return pinned;
}

/** Account → Public profile: pinned live streak badges with a link to the full Tools page. */
export function AccountPublicAchievementsSummary({ className }: { className?: string }) {
  const [streaks, setStreaks] = useState<PublicProfileStreak[]>(() => localPublicProfileStreaks());

  useEffect(() => {
    const refresh = () => setStreaks(localPublicProfileStreaks());
    window.addEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
  }, []);

  return (
    <ProfileMutedCard testId="account-public-achievements" className={className}>
      <div className="space-y-3">
        <ProfileSectionHeading
          title="Your streaks"
          subtitle={
            streaks.length > 0
              ? "Pinned streaks appear on your public profile when your Feed visibility is on."
              : "Earn milestones in Tools, then pin streaks you want on your public profile."
          }
        />

        {streaks.length > 0 ? (
          <ProfileStreakBadges streaks={streaks} />
        ) : (
          <p className="text-sm text-muted-foreground">No streaks pinned yet.</p>
        )}

        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto" data-testid="account-achievements-tools-link">
          <Link href="/tools/achievements">Manage in Tools</Link>
        </Button>
      </div>
    </ProfileMutedCard>
  );
}

export function AchievementsPanel({
  showProfileToggles = false,
  className,
  userId,
}: {
  showProfileToggles?: boolean;
  className?: string;
  userId?: string;
}) {
  const earned = useEarnedAchievementsState();
  const pinned = usePinnedStreakKindsState();

  const earnedIds = useMemo(() => new Set(earned.map((a) => a.id)), [earned]);

  const rows = ACHIEVEMENT_DEFINITIONS.map((def) => ({
    def,
    earned: earnedIds.has(def.id),
    streakDays: computeProfileStreakDays(def.streakKind),
    pinned: pinned.includes(def.streakKind),
  }));

  const unlockedCount = earned.length;

  const subtitle =
    unlockedCount > 0
      ? `${unlockedCount} milestone${unlockedCount === 1 ? "" : "s"} earned — streaks update daily from your activity.`
      : "Complete bedtime checks, exercise sessions, or show up on consecutive days to earn your first milestone.";

  const profileToggleNote = showProfileToggles ? (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      Tap the pin on an earned milestone to show that streak on your public profile (up to {MAX_PINNED_ACHIEVEMENTS}).
    </p>
  ) : null;

  return (
    <ProfileMutedCard testId="achievements-panel" className={className}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ProfileSectionHeading title="Your achievements" subtitle={subtitle} />
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/tools/activity">View activity log</Link>
          </Button>
        </div>

        {pinned.length > 0 ? (
          <div className="rounded-2xl border border-border/45 bg-muted/10 px-3 py-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">On your profile</p>
            <ProfileStreakBadges
              streaks={pinned
                .map((kind) => ({ kind, days: computeProfileStreakDays(kind) }))
                .filter((row) => row.days > 0)}
            />
          </div>
        ) : null}

        <ul className="list-none space-y-2.5" aria-label="Achievements">
          {rows.map(({ def, earned: isEarned, streakDays, pinned: isPinned }) => {
            const Icon = def.icon;
            const canPin = showProfileToggles && isEarned;
            const pinDisabled = !isPinned && pinned.length >= MAX_PINNED_ACHIEVEMENTS;

            return (
              <li
                key={def.id}
                className={cn(
                  "relative flex items-start gap-3 rounded-2xl border px-3 py-3 sm:px-4",
                  isEarned
                    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                    : "border-border/45 bg-muted/10 opacity-75",
                )}
                data-testid={`achievement-row-${def.id}`}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isEarned ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 pr-8">
                  <p className="text-sm font-semibold text-foreground">{def.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{def.description}</p>
                  {isEarned && streakDays > 0 ? (
                    <p className="text-[11px] font-medium text-emerald-800/80 dark:text-emerald-200/80">
                      Current streak: {streakDays} {streakDays === 1 ? "day" : "days"}
                    </p>
                  ) : null}
                </div>
                {canPin ? (
                  <button
                    type="button"
                    className={cn(
                      "absolute right-3 top-3 rounded-full p-1.5 transition-colors",
                      isPinned
                        ? "text-primary hover:bg-primary/10"
                        : "text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground",
                      pinDisabled && !isPinned && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground/70",
                    )}
                    aria-label={
                      isPinned
                        ? `Remove ${profileStreakTooltip(def.streakKind, streakDays)} from public profile`
                        : `Show ${profileStreakTooltip(def.streakKind, streakDays)} on public profile`
                    }
                    aria-pressed={isPinned}
                    disabled={pinDisabled && !isPinned}
                    onClick={() => {
                      const next = togglePinnedStreakKind(def.streakKind);
                      if (userId) void syncPinnedStreaksToProfile(userId, next);
                    }}
                    data-testid={`achievement-pin-${def.id}`}
                  >
                    <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {profileToggleNote}
      </div>
    </ProfileMutedCard>
  );
}

export function ProfileStreakBadges({
  streaks,
  className,
  size = "md",
}: {
  streaks: PublicProfileStreak[];
  className?: string;
  size?: "sm" | "md";
}) {
  if (streaks.length === 0) return null;

  const compact = size === "sm";

  return (
    <div className={cn("flex flex-wrap gap-2", className)} data-testid="profile-streak-badges">
      {streaks.map((streak) => {
        const Icon = profileStreakKindIcon(streak.kind);
        return (
          <span
            key={streak.kind}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/50 shadow-sm",
              compact ? "px-1 py-0.5" : "px-1.5 py-1",
            )}
            title={profileStreakTooltip(streak.kind, streak.days)}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-lg bg-primary/10 text-primary",
                compact ? "h-5 w-5" : "h-6 w-6",
              )}
            >
              <Icon className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
            </span>
            <span
              className={cn(
                "pr-1 font-semibold tabular-nums text-foreground",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {streak.days}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** @deprecated Use ProfileStreakBadges */
export function ProfileAchievementBadges({
  achievements,
  className,
}: {
  achievements: Array<{ id: AchievementId; title: string; days?: number; kind?: ProfileStreakKind }>;
  className?: string;
}) {
  const streaks: PublicProfileStreak[] = achievements
    .map((row) => {
      if (row.kind && typeof row.days === "number") {
        return { kind: row.kind, days: row.days };
      }
      const def = getAchievementDefinition(row.id);
      return {
        kind: def.streakKind,
        days: row.days ?? def.requiredDays,
      };
    })
    .filter((row) => row.days > 0);

  return <ProfileStreakBadges streaks={streaks} className={className} size="sm" />;
}
