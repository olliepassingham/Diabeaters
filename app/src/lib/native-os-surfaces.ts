import { registerPlugin } from "@capacitor/core";

export type OsSurfaceStatusPayload = {
  title: string;
  subtitle: string;
  kind: "idle" | "travel" | "sick_day" | "exercise" | "bedtime";
  deepLinkPath: string;
  updatedAt: string;
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
};

const OsSurfaces = registerPlugin<OsSurfacesPlugin>("OsSurfaces", {
  web: () => ({
    syncStatus: async () => {},
    startExerciseLiveActivity: async () => ({ ok: false }),
    updateExerciseLiveActivity: async () => ({ ok: false }),
    endExerciseLiveActivity: async () => ({ ok: false }),
  }),
});

export { OsSurfaces };
