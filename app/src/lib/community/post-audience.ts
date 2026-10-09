export type CommunityPostAudience = "everyone" | "followers";

const STORAGE_KEY = "diabeaters_post_audience_v1";

export function isCommunityPostAudience(value: unknown): value is CommunityPostAudience {
  return value === "everyone" || value === "followers";
}

export function readPostAudiencePreference(): CommunityPostAudience {
  if (typeof window === "undefined") return "everyone";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isCommunityPostAudience(raw) ? raw : "everyone";
  } catch {
    return "everyone";
  }
}

export function writePostAudiencePreference(audience: CommunityPostAudience) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, audience);
  } catch {
    // Preference is a convenience. Posting still sends the chosen audience.
  }
}
