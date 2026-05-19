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
