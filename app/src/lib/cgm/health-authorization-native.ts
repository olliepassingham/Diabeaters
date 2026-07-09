import { registerPlugin } from "@capacitor/core";

export type HealthAuthorizationProbe = {
  available: boolean;
  hasBloodGlucoseType: boolean;
};

export type HealthAuthorizationRequestResult = {
  success: boolean;
  promptCompleted: boolean;
};

export type HealthAuthorizationBloodGlucoseSample = {
  value: number;
  startDate?: string;
  endDate?: string;
  sourceName?: string;
};

export type HealthAuthorizationReadSamplesResult = {
  samples: HealthAuthorizationBloodGlucoseSample[];
};

export interface HealthAuthorizationPlugin {
  probe(): Promise<HealthAuthorizationProbe>;
  requestBloodGlucoseRead(): Promise<HealthAuthorizationRequestResult>;
  readBloodGlucoseSamples(options: {
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<HealthAuthorizationReadSamplesResult>;
}

export const HealthAuthorization = registerPlugin<HealthAuthorizationPlugin>("HealthAuthorization");
