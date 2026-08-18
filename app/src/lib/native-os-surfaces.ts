import { registerPlugin } from "@capacitor/core";
import type { BgUnits } from "@/lib/cgm/types";

export type OsSurfaceStatusPayload = {
  title: string;
  subtitle: string;
  kind: "idle" | "travel" | "sick_day" | "exercise" | "bedtime";
  deepLinkPath: string;
  updatedAt: string;
  glucoseValue?: number;
  glucoseUnits?: BgUnits;
  glucoseTrend?: string | null;
  glucoseRecordedAt?: string | null;
};

export type ExerciseLiveActivityPayload = {
  exerciseLabel: string;
  phase: "pre" | "active" | "recovery";
  startedAtIso?: string;
  deepLinkPath?: string;
};

type OsSurfacesPlugin = {
  syncStatus(payload: OsSurfaceStatusPayload): Promise<void>;
  startExerciseLiveActivity(payload: ExerciseLiveActivityPayload): Promise<{ ok: boolean }>;
  updateExerciseLiveActivity(payload: ExerciseLiveActivityPayload): Promise<{ ok: boolean }>;
  endExerciseLiveActivity(): Promise<{ ok: boolean }>;
  addListener(
    eventName: "watchSortedIt",
    listenerFunc: () => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const OsSurfaces = registerPlugin<OsSurfacesPlugin>("OsSurfaces", {
  web: () => ({
    syncStatus: async () => {},
    startExerciseLiveActivity: async () => ({ ok: false }),
    updateExerciseLiveActivity: async () => ({ ok: false }),
    endExerciseLiveActivity: async () => ({ ok: false }),
    addListener: async () => ({ remove: async () => {} }),
  }),
});

export { OsSurfaces };
