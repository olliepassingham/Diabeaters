import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageHeader, PageShell } from "@/components/layout";
import { SettingsBackLink } from "./shared";

type SettingsRatiosRouteProps = {
  settingsInfoDialog: ReactNode;
  ratiosInner: ReactNode;
};

export function SettingsRatiosRoute({ settingsInfoDialog, ratiosInner }: SettingsRatiosRouteProps) {
  return (
    <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
      <FaceLogoWatermark />
      <SettingsBackLink />
      <PageHeader
        className="mb-2"
        title="Ratios"
        description="TDD, correction factor, targets, and meal ratios."
        actions={settingsInfoDialog}
      />
      <Card
        id="settings-ratios-tools"
        className="scroll-mt-24 overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40"
      >
        {ratiosInner}
      </Card>
    </PageShell>
  );
}
