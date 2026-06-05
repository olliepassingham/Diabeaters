import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProfileMutedCard, ProfileSectionHeading } from "@/components/profile/profile-ui";
import {
  ACHIEVEMENT_DEFINITIONS,
  getAchievementDefinition,
  type AchievementId,
} from "@/lib/achievements";
import {
  loadEarnedAchievements,
  loadPinnedAchievementIds,
  MAX_PINNED_ACHIEVEMENTS,
  syncPinnedAchievementsToProfile,
  togglePinnedAchievement,
  USER_ACHIEVEMENTS_CHANGED_EVENT,
  type EarnedAchievement,
} from "@/lib/user-achievements";
import { cn } from "@/lib/utils";

function sortEarned(rows: EarnedAchievement[]): EarnedAchievement[] {
  return [...rows].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

export function AchievementsPanel({
  showProfileToggles = false,
  compact = false,
  className,
  userId,
}: {
  showProfileToggles?: boolean;
  compact?: boolean;
  className?: string;
  userId?: string;
}) {
  const [earned, setEarned] = useState<EarnedAchievement[]>(() => sortEarned(loadEarnedAchievements()));
  const [pinned, setPinned] = useState<AchievementId[]>(() => loadPinnedAchievementIds());

  useEffect(() => {
    const refresh = () => {
      setEarned(sortEarned(loadEarnedAchievements()));
      setPinned(loadPinnedAchievementIds());
    };
    window.addEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
  }, []);

  const earnedIds = useMemo(() => new Set(earned.map((a) => a.id)), [earned]);
  const earnedAtById = useMemo(() => new Map(earned.map((a) => [a.id, a.earnedAt])), [earned]);

  const rows = ACHIEVEMENT_DEFINITIONS.map((def) => ({
    def,
    earned: earnedIds.has(def.id),
    earnedAt: earnedAtById.get(def.id),
    pinned: pinned.includes(def.id),
  }));

  const unlockedCount = earned.length;

  return (
    <ProfileMutedCard testId="achievements-panel" className={className}>
      <div className={cn("space-y-4", compact && "space-y-3")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ProfileSectionHeading
            title="Your achievements"
            subtitle={
              unlockedCount > 0
                ? `${unlockedCount} earned — keep going at your own pace.`
                : "Complete bedtime checks or exercise sessions on consecutive days to earn your first badge."
            }
          />
          {!compact ? (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/tools/activity">View activity log</Link>
            </Button>
          ) : null}
        </div>

        <ul className="list-none space-y-2.5" aria-label="Achievements">
          {rows.map(({ def, earned: isEarned, earnedAt, pinned: isPinned }) => {
            const Icon = def.icon;
            return (
              <li
                key={def.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-3 py-3 sm:px-4",
                  isEarned
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : "border-border/45 bg-muted/10 opacity-80",
                )}
                data-testid={`achievement-row-${def.id}`}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isEarned ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{def.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{def.description}</p>
                  {isEarned && earnedAt ? (
                    <p className="text-[11px] text-muted-foreground">
                      Earned {format(parseISO(earnedAt), "d MMM yyyy")}
                    </p>
                  ) : null}
                  {showProfileToggles && isEarned ? (
                    <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <Switch
                        checked={isPinned}
                        onCheckedChange={() => {
                          const next = togglePinnedAchievement(def.id);
                          setPinned(next);
                          if (userId) void syncPinnedAchievementsToProfile(userId, next);
                        }}
                        disabled={!isPinned && pinned.length >= MAX_PINNED_ACHIEVEMENTS}
                        aria-label={`Show ${def.title} on public profile`}
                      />
                      Show on public profile
                    </label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {showProfileToggles ? (
          <p className="text-[11px] text-muted-foreground">
            Choose up to {MAX_PINNED_ACHIEVEMENTS} badges for your public profile. Clinical counts are never shown.
          </p>
        ) : null}
      </div>
    </ProfileMutedCard>
  );
}

export function ProfileAchievementBadges({
  achievements,
  className,
}: {
  achievements: Array<{ id: AchievementId; title: string }>;
  className?: string;
}) {
  if (achievements.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} data-testid="profile-achievement-badges">
      {achievements.map((badge) => {
        const def = getAchievementDefinition(badge.id);
        const Icon = def.icon;
        return (
          <span
            key={badge.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-100"
            title={badge.title}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{badge.title}</span>
          </span>
        );
      })}
    </div>
  );
}
