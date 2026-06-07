import { AchievementsPanel } from "@/components/achievements/achievements-panel";
import { PageHeader, PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";

export default function AchievementsPage() {
  const { user } = useAuth();

  return (
    <PageShell variant="narrow" className="space-y-4">
      <PageHeader
        title="Achievements"
        description="Private milestones from your Diabeaters habits. Pin streaks to show on your public profile."
      />
      <AchievementsPanel showProfileToggles userId={user?.id} />
    </PageShell>
  );
}
