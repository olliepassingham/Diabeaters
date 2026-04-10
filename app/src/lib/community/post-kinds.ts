/** Post kinds and structured payloads (`community_posts.post_kind` / `post_extra`). */

export const COMMUNITY_POST_KINDS = ["standard", "poll", "event"] as const;
export type CommunityPostKind = (typeof COMMUNITY_POST_KINDS)[number];

export function isCommunityPostKind(s: string): s is CommunityPostKind {
  return (COMMUNITY_POST_KINDS as readonly string[]).includes(s);
}

export type CommunityPollExtra = {
  question: string;
  options: string[];
};

export type CommunityEventExtra = {
  title: string;
  starts_at: string;
  location?: string;
  details?: string;
};

export function parsePollExtra(raw: unknown): CommunityPollExtra | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const q = String(o.question ?? "").trim();
  if (!q) return null;
  if (!Array.isArray(o.options)) return null;
  const options = o.options.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (options.length < 2) return null;
  return { question: q, options };
}

export function parseEventExtra(raw: unknown): CommunityEventExtra | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? "").trim();
  const startsAt = String(o.starts_at ?? "").trim();
  if (!title || !startsAt) return null;
  const location = String(o.location ?? "").trim();
  const details = String(o.details ?? "").trim();
  return {
    title,
    starts_at: startsAt,
    ...(location ? { location } : {}),
    ...(details ? { details } : {}),
  };
}

export function parsePostExtra(
  kind: CommunityPostKind,
  raw: unknown,
): CommunityPollExtra | CommunityEventExtra | null {
  if (kind === "poll") return parsePollExtra(raw);
  if (kind === "event") return parseEventExtra(raw);
  return null;
}

export function parseMentionMap(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(v ?? "").trim();
    if (k && id) out[k.toLowerCase()] = id;
  }
  return out;
}

export function parseMentionedUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  return [...new Set(ids)];
}
