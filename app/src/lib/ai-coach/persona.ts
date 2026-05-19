/**
 * Display name and short phrases for the in-app AI educational guide.
 * Change `AI_ASSISTANT_NAME` here to rebrand across the UI.
 */

import type { UserAgeBand } from "@/lib/user-age";

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

/** One-line lead for the patient coach header on small screens (full text in details). */
export function coachPatientHeaderLead(): string {
  return "UK · Education & clinic-prep — not medical advice or dosing. Tap below for topic & full disclaimer.";
}

/**
 * Compact one-line lead for the supporter coach header so prompts stay visible
 * without scrolling; full scope stays in the expandable details block.
 */
export function coachSupporterHeaderLead(): string {
  return "UK · Education only · Not personal medical advice — tap below for full scope.";
}

/**
 * Long-form supporter-topic scope line, tuned to the supported person's age
 * when we know their date of birth (linked patient clinical prefs or local
 * profile when not a carer link). Falls back to neutral "person" when unknown.
 */
export function coachSupporterTopicScopeHint(ageBand: UserAgeBand): string {
  const tail =
    "Not personal medical advice for them — never override their plan or care team.";
  switch (ageBand) {
    case "child":
      return `General education for someone supporting a child with type 1 diabetes in the UK. ${tail}`;
    case "teen":
      return `General education for someone supporting a teenager with type 1 diabetes in the UK. ${tail}`;
    case "adult":
      return `General education for someone supporting an adult with type 1 diabetes in the UK. ${tail}`;
    default:
      return `General education for someone supporting a person with type 1 diabetes in the UK. ${tail}`;
  }
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
