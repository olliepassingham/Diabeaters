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
        className="mb-2"
        title="Profile and usage"
        description="Name, units, typical insulin use, and supply pack sizes."
        actions={settingsInfoDialog}
      />
      <Card
        id="settings-usage-tools"
        className="scroll-mt-24 overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40"
      >
        {usageToolsInner}
      </Card>
    </PageShell>
  );
}
