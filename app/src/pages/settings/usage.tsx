import type { ReactNode } from "react";
import { SettingsPanel, SettingsSubPageShell } from "./shared";
import { SettingsUsageInfoDialog } from "./settings-page-info";

type SettingsUsageRouteProps = {
  usageToolsInner: ReactNode;
};

export function SettingsUsageRoute({ usageToolsInner }: SettingsUsageRouteProps) {
  return (
    <SettingsSubPageShell
      title="Personal & usage"
      description={
        <>
          <span className="sm:hidden">Units, habits, supply packs, backup.</span>
          <span className="hidden sm:inline">Units, typical insulin use, supply pack sizes, and backup.</span>
        </>
      }
      actions={<SettingsUsageInfoDialog />}
    >
      <SettingsPanel id="settings-usage-tools" className="scroll-mt-20">
        {usageToolsInner}
      </SettingsPanel>
    </SettingsSubPageShell>
  );
}
