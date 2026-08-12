import type { ReactNode } from "react";
import { SettingsPanel, SettingsSubPageShell } from "./shared";
import { SettingsRatiosInfoDialog } from "./settings-page-info";

type SettingsRatiosRouteProps = {
  ratiosInner: ReactNode;
};

export function SettingsRatiosRoute({ ratiosInner }: SettingsRatiosRouteProps) {
  return (
    <SettingsSubPageShell
      title="Ratios"
      description="How you cover carbs and correct highs."
      actions={<SettingsRatiosInfoDialog />}
    >
      <SettingsPanel id="settings-ratios-tools" className="scroll-mt-24">
        {ratiosInner}
      </SettingsPanel>
    </SettingsSubPageShell>
  );
}
