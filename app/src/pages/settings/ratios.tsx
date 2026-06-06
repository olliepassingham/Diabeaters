import type { ReactNode } from "react";
import { SettingsPanel, SettingsSubPageShell } from "./shared";

type SettingsRatiosRouteProps = {
  settingsInfoDialog: ReactNode;
  ratiosInner: ReactNode;
};

export function SettingsRatiosRoute({ settingsInfoDialog, ratiosInner }: SettingsRatiosRouteProps) {
  return (
    <SettingsSubPageShell
      title="Ratios"
      description="TDD, correction factor, targets, and meal ratios."
      actions={settingsInfoDialog}
    >
      <SettingsPanel id="settings-ratios-tools" className="scroll-mt-24">
        {ratiosInner}
      </SettingsPanel>
    </SettingsSubPageShell>
  );
}
