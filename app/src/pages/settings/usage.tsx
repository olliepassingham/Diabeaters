import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink } from "./shared";

type SettingsUsageRouteProps = {
  settingsInfoDialog: ReactNode;
  usageToolsInner: ReactNode;
};

export function SettingsUsageRoute({ settingsInfoDialog, usageToolsInner }: SettingsUsageRouteProps) {
  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-1 sm:mb-2"
        title="Personal & usage"
        description={
          <span>
            <span className="sm:hidden">Units, habits, supply packs, backup.</span>
            <span className="hidden sm:inline">Units, typical insulin use, supply pack sizes, and backup.</span>
          </span>
        }
        actions={settingsInfoDialog}
      />
      <Card
        id="settings-usage-tools"
        className="scroll-mt-20 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-border/30 sm:rounded-2xl"
      >
        {usageToolsInner}
      </Card>
    </PageShell>
  );
}
