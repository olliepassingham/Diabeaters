import type { HealthStatus } from "@/lib/dashboard-health-status";
import { TodayAtAGlanceContent } from "@/components/dashboard/SupplyTrackerTodaySection";

/**
 * Compact today strip — bedtime, travel, supply attention rows.
 * Sits below the command hero without duplicating runway messaging.
 */
export function HomeTodayPulse({
  healthStatus,
  suppressRunwayDuplicate,
}: {
  healthStatus: HealthStatus;
  suppressRunwayDuplicate?: boolean;
}) {
  return (
    <section
      className="animate-fade-in-up py-2"
      style={{ animationDelay: "80ms" }}
    >
      <div data-testid="dashboard-today-overview-card">
        <TodayAtAGlanceContent
          supplyShortcutHidden
          healthStatus={healthStatus}
          suppressRunwayDuplicate={suppressRunwayDuplicate}
          hideActivityHeader
          hideTravelContext
        />
      </div>
    </section>
  );
}
