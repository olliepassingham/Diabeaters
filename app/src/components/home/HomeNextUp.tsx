import { HomeBedtimeMomentCard, useHomeBedtimePresence } from "@/components/home/HomeBedtimeMoment";
import { HomeNextUpShell, HomeTravelContext, useHomeTravelPresence } from "@/components/home/HomeTravelContext";
import type { HomeNextBestActionId } from "@/lib/home-next-best-action";

/**
 * Time-sensitive home context (bedtime + trip).
 * Skips items already claimed by the hero next-action CTA to avoid duplicates.
 */
export function HomeNextUp({
  suppressActionId,
}: {
  /** Hero next-action id — hide matching cards here. */
  suppressActionId?: HomeNextBestActionId;
}) {
  const travel = useHomeTravelPresence();
  const bedtime = useHomeBedtimePresence();

  const bedtimeVisible = bedtime.visible && suppressActionId !== "bedtime";
  const travelVisible = travel.visible && suppressActionId !== "travel";

  if (!travelVisible && !bedtimeVisible) return null;

  const eveningLead = bedtimeVisible && bedtime.mode === "evening";

  return (
    <HomeNextUpShell hasContent>
      {eveningLead ? (
        <>
          <HomeBedtimeMomentCard presence={bedtime} />
          {travelVisible ? <HomeTravelContext embedded /> : null}
        </>
      ) : (
        <>
          {travelVisible ? <HomeTravelContext embedded /> : null}
          {bedtimeVisible ? <HomeBedtimeMomentCard presence={bedtime} /> : null}
        </>
      )}
    </HomeNextUpShell>
  );
}
