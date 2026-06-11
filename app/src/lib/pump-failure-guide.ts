import type { AppRegion } from "@/lib/region";
import { getKetoneEmergencyCopy } from "@/lib/region";
import type { PumpFailureKetoneLevel, PumpFailureTriageKind } from "@/lib/storage";

export type PumpFailureEscalationLevel = "none" | "monitor" | "urgent" | "emergency";

export type PumpFailureEscalation = {
  level: PumpFailureEscalationLevel;
  title: string;
  message: string;
};

export function parsePumpFailureBgInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function bgLevelMgDl(value: number | null | undefined, units: string | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return units === "mmol/L" ? value * 18 : value;
}

export function assessPumpFailureEscalation(params: {
  ketonesLevel: PumpFailureKetoneLevel;
  symptoms?: { vomiting?: boolean; confusion?: boolean };
  bgValue?: number | null;
  bgUnits?: string | null;
  region: AppRegion;
}): PumpFailureEscalation {
  const ketoneEmergency = getKetoneEmergencyCopy(params.region);
  const bgMgDl = bgLevelMgDl(params.bgValue, params.bgUnits);
  const isHighBg = bgMgDl != null && bgMgDl > 250;
  const isVeryHighBg = bgMgDl != null && bgMgDl > 300;

  if (params.symptoms?.vomiting || params.symptoms?.confusion) {
    return {
      level: "emergency",
      title: "Seek urgent medical help now",
      message:
        "Vomiting or confusion with possible pump failure can be dangerous. Contact emergency services or go to hospital — do not wait.",
    };
  }

  switch (params.ketonesLevel) {
    case "large":
      return {
        level: "emergency",
        title: "Large ketones — emergency",
        message: ketoneEmergency.large,
      };
    case "moderate":
      if (isVeryHighBg || isHighBg) {
        return {
          level: "emergency",
          title: "Moderate ketones with high glucose",
          message: ketoneEmergency.moderateWithHighBg,
        };
      }
      return {
        level: "urgent",
        title: "Moderate ketones — act now",
        message:
          "Moderate ketones need prompt action. Follow your pump-failure backup plan, take extra fluids, and contact your diabetes team urgently.",
      };
    case "small":
      if (isVeryHighBg) {
        return {
          level: "urgent",
          title: "Small ketones with high glucose",
          message:
            "Small ketones with high glucose need close attention. Use your backup insulin plan and contact your diabetes team if not improving within 2 hours.",
        };
      }
      return {
        level: "monitor",
        title: "Small ketones — monitor closely",
        message:
          "Recheck glucose and ketones in 1–2 hours. Ensure backup insulin and fluids per your clinic plan.",
      };
    case "trace":
      if (isHighBg) {
        return {
          level: "monitor",
          title: "Trace ketones with high glucose",
          message: "Take correction per your plan, drink fluids, and recheck ketones within 2 hours.",
        };
      }
      return {
        level: "monitor",
        title: "Trace ketones",
        message: "Drink extra fluids and recheck ketones in about 2 hours if glucose stays high.",
      };
    case "none":
      if (isVeryHighBg) {
        return {
          level: "urgent",
          title: "High glucose without ketones",
          message:
            "No ketones is reassuring, but very high glucose still needs action. Follow your correction plan and consider whether delivery has truly stopped.",
        };
      }
      if (isHighBg) {
        return {
          level: "monitor",
          title: "High glucose — keep checking",
          message: "Recheck glucose and ketones in 1–2 hours while you work through your pump-failure steps.",
        };
      }
      break;
    default:
      break;
  }

  return {
    level: "none",
    title: "",
    message: "",
  };
}

export const PUMP_FAILURE_TRIAGE_OPTIONS: {
  id: PumpFailureTriageKind;
  title: string;
  description: string;
  firstStepHint: string;
}[] = [
  {
    id: "delivery_stopped",
    title: "Delivery has stopped",
    description: "Pump error, empty reservoir, or no insulin getting through.",
    firstStepHint: "Switch to backup injections per your written plan as soon as you can.",
  },
  {
    id: "set_issue",
    title: "Infusion set may have failed",
    description: "Occlusion alert, leaking site, or sudden unexplained high.",
    firstStepHint: "Change the infusion set and site first, then recheck glucose in 1–2 hours.",
  },
  {
    id: "high_unsure",
    title: "High glucose — not sure why",
    description: "Rising readings but you are not certain what failed.",
    firstStepHint: "Check ketones now, inspect the site, and prepare backup insulin if levels keep rising.",
  },
];

export function triageFirstStepHint(kind: PumpFailureTriageKind | undefined): string | null {
  if (!kind) return null;
  return PUMP_FAILURE_TRIAGE_OPTIONS.find((o) => o.id === kind)?.firstStepHint ?? null;
}

export function formatPumpFailureKetones(level: PumpFailureKetoneLevel | undefined): string {
  if (!level || level === "unknown") return "Unknown";
  return level.replace(/_/g, " ");
}

export function telHrefForPhone(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 6) return null;
  return `tel:${digits}`;
}
