import { BEATIE_PROFILE_AVATAR_SRC } from "@/lib/beatie-avatar";

/**
 * Placeholder when the feed bot profile has no `avatar_url` (dedicated Beatie artwork).
 */
export const BEATIE_FEED_AVATAR_FALLBACK_SRC: string = BEATIE_PROFILE_AVATAR_SRC;

/**
 * Shown on Beatie's public profile when `profiles.bio` is empty (DB bio still wins if set).
 */
export const BEATIE_FEED_BOT_DEFAULT_BIO =
  "I'm Beatie, Diabeaters' built-in AI coach. I share general information about living with diabetes on the community feed and in chat. For medical decisions, always follow advice from your own care team.";

/**
 * Optional UI env: must match the Auth user id configured as `BEATIE_FEED_BOT_USER_ID`
 * on the Edge Function for badges and "Ask Beatie" visibility.
 */
export function getBeatieFeedBotUserIdFromEnv(): string | null {
  const v = (import.meta.env.VITE_BEATIE_FEED_BOT_USER_ID as string | undefined)?.trim();
  if (!v) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
    ? v
    : null;
}
