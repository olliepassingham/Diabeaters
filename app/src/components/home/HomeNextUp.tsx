import { HomeBedtimeMomentCard, useHomeBedtimePresence } from "@/components/home/HomeBedtimeMoment";
import { HomeNextUpShell, HomeTravelContext, useHomeTravelPresence } from "@/components/home/HomeTravelContext";

/**
 * Groups time-sensitive home context (bedtime + trip) into one intentional block
 * so they stop floating as orphan rows under meal planning.
 *
 * Evening: bedtime leads (dynamic focus), trip sits underneath.
 * Otherwise: trip leads when present, morning overnight review follows when available.
 */
export function HomeNextUp() {
  const travel = useHomeTravelPresence();
  const bedtime = useHomeBedtimePresence();

  if (!travel.visible && !bedtime.visible) return null;

  const eveningLead = bedtime.visible && bedtime.mode === "evening";

  return (
    <HomeNextUpShell hasContent>
      {eveningLead ? (
        <>
          <HomeBedtimeMomentCard presence={bedtime} />
          {travel.visible ? <HomeTravelContext embedded /> : null}
        </>
      ) : (
        <>
          {travel.visible ? <HomeTravelContext embedded /> : null}
          {bedtime.visible ? <HomeBedtimeMomentCard presence={bedtime} /> : null}
        </>
      )}
    </HomeNextUpShell>
  );
}
