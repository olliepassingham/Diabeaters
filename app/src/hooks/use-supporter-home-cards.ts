import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptySupporterHomeCardPrefs,
  loadSupporterHomeCardPrefs,
  revealAppointmentsIfNeeded,
  saveSupporterHomeCardPrefs,
  setSupporterCardShown,
  type SupporterHomeCardPrefs,
  type SupporterQuietCardId,
} from "@/lib/supporter-home-cards";

export function useSupporterHomeCards(
  userId: string | undefined,
  patientId: string | undefined,
  upcomingAppointmentKeys: readonly string[],
) {
  const [prefs, setPrefs] = useState<SupporterHomeCardPrefs>(() =>
    userId && patientId ? loadSupporterHomeCardPrefs(userId, patientId) : emptySupporterHomeCardPrefs(),
  );
  const keySig = upcomingAppointmentKeys.join("\n");
  const keysRef = useRef(upcomingAppointmentKeys);
  keysRef.current = upcomingAppointmentKeys;

  useEffect(() => {
    if (!userId || !patientId) {
      setPrefs(emptySupporterHomeCardPrefs());
      return;
    }
    setPrefs(loadSupporterHomeCardPrefs(userId, patientId));
  }, [userId, patientId]);

  useEffect(() => {
    if (!userId || !patientId) return;
    setPrefs((prev) => {
      const next = revealAppointmentsIfNeeded(prev, keysRef.current);
      if (next === prev) return prev;
      saveSupporterHomeCardPrefs(userId, patientId, next);
      return next;
    });
  }, [userId, patientId, keySig]);

  const setCardShown = useCallback(
    (id: SupporterQuietCardId, shown: boolean) => {
      if (!userId || !patientId) return;
      setPrefs((prev) => {
        const next = setSupporterCardShown(prev, id, shown, keysRef.current);
        saveSupporterHomeCardPrefs(userId, patientId, next);
        return next;
      });
    },
    [userId, patientId],
  );

  return { prefs, setCardShown };
}
