import { getProfileIdByPublicHandle, normalizePublicHandleInput } from "@/lib/profile";
import type { FeedPostMentions } from "./posts-supabase";

/** Resolve @handles in post body for insert (max 12 mentions). */
export async function buildMentionsForPost(
  body: string,
  authorId: string | undefined,
): Promise<FeedPostMentions> {
  const mentionMap: Record<string, string> = {};
  const idOrder: string[] = [];
  const seen = new Set<string>();
  const re = /@([a-z0-9_]{3,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1]!.toLowerCase();
    if (mentionMap[raw]) continue;
    if (seen.size >= 12) continue;
    let normalized: string | null;
    try {
      normalized = normalizePublicHandleInput(raw);
    } catch {
      continue;
    }
    if (!normalized) continue;
    const { userId, error } = await getProfileIdByPublicHandle(normalized);
    if (error || !userId || (authorId && userId === authorId)) continue;
    mentionMap[normalized] = userId;
    if (!seen.has(userId)) {
      seen.add(userId);
      idOrder.push(userId);
    }
  }
  return { userIds: idOrder, mentionMap };
}
