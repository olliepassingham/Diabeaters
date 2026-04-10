/**
 * First https URL in text whose host is on a small allow-list (trusted-ish sources only).
 * No network fetch — display is hostname + link only.
 */

const URL_IN_TEXT =
  /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/gi;

/** Host suffixes (exact host or subdomain) allowed for inline link cards. */
const ALLOWED_HOST_SUFFIXES = [
  "nih.gov",
  "nhs.uk",
  "gov.uk",
  "cdc.gov",
  "who.int",
  "jdrf.org",
  "diabetes.org.uk",
  "diabetes.org",
  "childrenwithdiabetes.com",
  "beyondtype1.org",
  "tidepool.org",
  "github.com",
  "wikipedia.org",
  "pubmed.ncbi.nlm.nih.gov",
];

function trimTrailingPunctuation(href: string): string {
  return href.replace(/[),.;:!?]+$/g, "");
}

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** Returns normalized https URL string or null if none / not allowed / invalid. */
export function getFirstWhitelistedFeedLink(text: string): string | null {
  if (!text.trim()) return null;
  URL_IN_TEXT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_IN_TEXT.exec(text)) !== null) {
    const raw = trimTrailingPunctuation(m[0]);
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      if (!hostAllowed(u.hostname)) continue;
      return u.toString();
    } catch {
      continue;
    }
  }
  return null;
}
