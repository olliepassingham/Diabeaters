const ENGAGEMENT_KEY = "diabeater_feature_engagement";

function getEngagement(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ENGAGEMENT_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Increment per-feature visit counts (used by several pages for lightweight analytics). */
export function trackFeatureEngagement(feature: string) {
  const engagement = getEngagement();
  engagement[feature] = (engagement[feature] || 0) + 1;
  localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(engagement));
}
