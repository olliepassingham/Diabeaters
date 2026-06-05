import { AchievementsPanel } from "@/components/achievements/achievements-panel";
import { PageHeader, PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";

export default function AchievementsPage() {
  const { user } = useAuth();

  return (
    <PageShell variant="narrow" className="space-y-4">
      <PageHeader
        title="Achievements"
        description="Private milestones for habits you build with Diabeaters tools. Choose which earned badges appear on your public profile."
      />
      <AchievementsPanel showProfileToggles userId={user?.id} />
    </PageShell>
  );
}
