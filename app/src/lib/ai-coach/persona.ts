/**
 * Display name and short phrases for the in-app AI educational guide.
 * Change `AI_ASSISTANT_NAME` here to rebrand across the UI.
 */
export const AI_ASSISTANT_NAME = "Dia";

export function coachPageTitle(audience: "patient" | "supporter"): string {
  return audience === "supporter" ? `${AI_ASSISTANT_NAME} – Supporter` : AI_ASSISTANT_NAME;
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

/** Mid-sentence link text, e.g. "ask Dia". */
export function askAssistantMidSentence(): string {
  return `ask ${AI_ASSISTANT_NAME}`;
}
