import { PageHeader, PageShell } from "@/components/layout";
import { AchievementsPanel } from "@/components/achievements/achievements-panel";

export default function AchievementsPage() {
  return (
    <PageShell variant="narrow" className="space-y-4">
      <PageHeader
        title="Achievements"
        description="Private milestones for habits you build with Diabeaters tools. Only badges you choose appear on your public profile."
      />
      <AchievementsPanel />
    </PageShell>
  );
}
