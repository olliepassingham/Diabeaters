import { useEffect, useState } from "react";

import { AchievementsPanel } from "@/components/achievements/achievements-panel";
import { PageHeader, PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { getProfile } from "@/lib/profile";

export default function AchievementsPage() {
  const { user } = useAuth();
  const [onsetDate, setOnsetDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setOnsetDate(null);
      return;
    }
    let cancelled = false;
    void getProfile(user.id).then(({ profile }) => {
      if (!cancelled) setOnsetDate(profile?.diabetes_onset_date ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <PageShell variant="narrow" className="space-y-4">
      <PageHeader
        title="Achievements"
        description="Habit milestones and community titles. Pin badges to your public profile."
      />
      <AchievementsPanel showProfileToggles userId={user?.id} onsetDate={onsetDate} />
    </PageShell>
  );
}
