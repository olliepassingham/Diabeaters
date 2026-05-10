/**
 * Display name and short phrases for the in-app AI educational guide.
 * Change `AI_ASSISTANT_NAME` here to rebrand across the UI.
 */
export const AI_ASSISTANT_NAME = "Beatie";

export function coachPageTitle(audience: "patient" | "supporter"): string {
  return audience === "supporter" ? `${AI_ASSISTANT_NAME} (supporter)` : AI_ASSISTANT_NAME;
}

/** Short context line shown in a card under the coach page title. */
export function coachPageSubtitle(audience: "patient" | "supporter"): string {
  return audience === "supporter"
    ? "Educational answers for people supporting someone with type 1 diabetes in the UK. Not personal medical advice for you or for them."
    : "Friendly, educational answers and clinic-prep ideas for type 1 diabetes in the UK. Not medical advice — no insulin doses, ratios, or glucose targets.";
}

/** Primary CTA to open the chat screen (dashboard, carer hub, etc.). */
export function openAssistantCtaLabel(): string {
  return `Ask ${AI_ASSISTANT_NAME}`;
}

export function askAssistantModalTitle(): string {
  return `Ask ${AI_ASSISTANT_NAME}`;
}

/** Default label for scenario / flow links into `/coach`. */
export function scenarioAskAssistantLinkLabel(): string {
  return `Ask ${AI_ASSISTANT_NAME}`;
}

export function askAssistantAboutThisAriaLabel(): string {
  return `Ask ${AI_ASSISTANT_NAME} about this`;
}

/** Mid-sentence link text, e.g. "ask Beatie". */
export function askAssistantMidSentence(): string {
  return `ask ${AI_ASSISTANT_NAME}`;
}
