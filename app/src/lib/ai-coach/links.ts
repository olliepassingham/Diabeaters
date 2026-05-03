import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import type { CoachAudience } from "@/lib/ai-coach/types";

export type BuildCoachHrefParams = {
  topic?: CoachTopicSlug | null;
  q?: string | null;
  audience?: CoachAudience | null;
  from?: string | null;
};

const MAX_Q = 500;
const MAX_FROM = 80;

/** Builds `/coach?…` with optional topic, pre-filled question, audience, and entry source (for product breadcrumbs only). */
export function buildCoachHref(params: BuildCoachHrefParams): string {
  const sp = new URLSearchParams();
  if (params.audience === "supporter") sp.set("audience", "supporter");
  if (params.topic) sp.set("topic", params.topic);
  const qRaw = params.q?.trim();
  if (qRaw) sp.set("q", qRaw.slice(0, MAX_Q));
  const fromRaw = params.from?.trim();
  if (fromRaw) sp.set("from", fromRaw.slice(0, MAX_FROM));
  const qs = sp.toString();
  return qs ? `/coach?${qs}` : "/coach";
}
