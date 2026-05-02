/**
 * Deterministic responses returned by the Edge Function when an interceptor
 * category matches (§6.1 of docs/regulatory/ai_coach_system_prompt.md).
 *
 * The LLM is bypassed entirely for these. All copy is UK-English, calm,
 * non-judgmental, and within the §2 tone bans (no emojis, no exclamation
 * marks, no behavioural moralising). Any change here is a clinical-relevance
 * change subject to the same review path as user-facing medical copy.
 *
 * Pure data only — no Deno or browser APIs.
 */

import type { CoachReply, InterceptorCategory } from "./types.ts";

export const ACUTE_GLYCAEMIC_RESPONSE: CoachReply = {
  reply:
    "Open Help Now and follow the steps there. If you feel low, treat the low first; if you have ketones with high glucose, vomiting, or feel very unwell, this is a sick-day situation. If anyone is unconscious, fitting, or unable to keep fluids down, call 999.",
  suggestedQuestions: [],
  suggestedNextActions: [
    { label: "Open Help Now", href: "/help-now" },
    { label: "Hypo help", href: "/tools/hypo-help" },
    { label: "Emergency card", href: "/emergency-card" },
  ],
  deferToTeam: true,
};

export const DISORDERED_EATING_RESPONSE: CoachReply = {
  reply:
    "Thank you for telling me. This is something I'm not the right tool to help with on its own, and there are people who can. Diabetes UK helpline is on 0345 123 2399 (Mon–Fri, 09:00–18:00). Beat eating disorders helpline is on 0808 801 0677. Please also let your diabetes team know — they will have heard this before, and they can route you to specialist support.",
  suggestedQuestions: [],
  suggestedNextActions: [{ label: "Open Help Now", href: "/help-now" }],
  deferToTeam: true,
};

export const EMERGENCY_SERVICES_RESPONSE: CoachReply = {
  reply:
    "If this is an emergency, call 999. For urgent advice that is not life-threatening, call 111. Open Help Now for diabetes-specific steps you can take while waiting.",
  suggestedQuestions: [],
  suggestedNextActions: [{ label: "Open Help Now", href: "/help-now" }],
  deferToTeam: true,
};

export const SAFEGUARDING_RESPONSE: CoachReply = {
  reply:
    "I'm glad you reached out. You can speak to Samaritans any time on 116 123 — they listen, free and in confidence. If you are at immediate risk, call 999. Help Now also has steps for the next few minutes if you would like to open it.",
  suggestedQuestions: [],
  suggestedNextActions: [{ label: "Open Help Now", href: "/help-now" }],
  deferToTeam: true,
};

const RESPONSES: Record<InterceptorCategory, CoachReply> = {
  acute_glycaemic: ACUTE_GLYCAEMIC_RESPONSE,
  disordered_eating_with_insulin: DISORDERED_EATING_RESPONSE,
  emergency_services: EMERGENCY_SERVICES_RESPONSE,
  safeguarding: SAFEGUARDING_RESPONSE,
};

export function deterministicResponse(category: InterceptorCategory): CoachReply {
  return RESPONSES[category];
}
