import type { ReactNode } from "react";
import { SettingsPanel, SettingsSubPageShell } from "./shared";
import { SettingsUsageInfoDialog } from "./settings-page-info";

type SettingsUsageRouteProps = {
  usageToolsInner: ReactNode;
};

export function SettingsUsageRoute({
  usageToolsInner,
  type2 = false,
}: SettingsUsageRouteProps & { type2?: boolean }) {
  return (
    <SettingsSubPageShell
      title={type2 ? "Personal info" : "Personal & usage"}
      description={
        type2 ? (
          <>Name, region, units, and backup for your Type 2 home.</>
        ) : (
          <>
            <span className="sm:hidden">Units, habits, supply packs, backup.</span>
            <span className="hidden sm:inline">Units, typical insulin use, supply pack sizes, and backup.</span>
          </>
        )
      }
      actions={type2 ? undefined : <SettingsUsageInfoDialog />}
    >
      <SettingsPanel id="settings-usage-tools" className="scroll-mt-20">
        {usageToolsInner}
      </SettingsPanel>
    </SettingsSubPageShell>
  );
}
