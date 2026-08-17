export type GlucoseConcern = "low" | "high" | "unknown";

export function parseGlucoseConcern(value: unknown): GlucoseConcern {
  if (value === "low" || value === "high") return value;
  return "unknown";
}

export function checkInRequestTitle(): string {
  return "Check-in";
}

export function checkInResponseTitle(): string {
  return "Check-in update";
}

export function checkInPatientPrompt(carerName: string, concern: GlucoseConcern): string {
  const name = carerName.trim() || "Your supporter";
  if (concern === "low") {
    return `${name} is checking you're OK — are you aware of a possible low?`;
  }
  if (concern === "high") {
    return `${name} is checking you're OK — are you aware of a possible high?`;
  }
  return `${name} is checking you're OK.`;
}

export function checkInPatientPushBody(carerName: string, concern: GlucoseConcern): string {
  const name = carerName.trim() || "Your supporter";
  if (concern === "low") return `${name} is checking you're OK — possible low`;
  if (concern === "high") return `${name} is checking you're OK — possible high`;
  return `${name} is checking you're OK`;
}

export function checkInTreatingBody(patientLabel: string, concern: GlucoseConcern): string {
  const name = patientLabel.trim() || "Your contact";
  if (concern === "low") return `${name} is sorting a low`;
  if (concern === "high") return `${name} is sorting a high`;
  return `${name} is sorting it`;
}

export function checkInResponseBody(
  patientLabel: string,
  status: string,
  concern: GlucoseConcern,
): string {
  const name = patientLabel.trim() || "Your contact";
  if (status === "ok") return `${name} replied they're OK`;
  if (status === "treating") return checkInTreatingBody(name, concern);
  if (status === "hypo_logged") return `${name} logged a hypo`;
  return `${name} replied`;
}

export function shouldOfferLogHypo(concern: GlucoseConcern): boolean {
  return concern !== "high";
}

export function formatCheckInStatusLabel(
  status: string,
  concern: GlucoseConcern = "unknown",
): string {
  switch (status) {
    case "pending":
      return "Waiting for reply";
    case "ok":
      return "They replied they're OK";
    case "treating":
      if (concern === "low") return "They're sorting a low";
      if (concern === "high") return "They're sorting a high";
      return "They're sorting it";
    case "hypo_logged":
      return "They logged a hypo";
    case "expired":
      return "No reply (timed out)";
    default:
      return status;
  }
}
