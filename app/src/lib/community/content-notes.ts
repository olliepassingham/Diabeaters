/** Self-labeled sensitivity / tone flags (stored on `community_posts.content_note`). */

export const COMMUNITY_CONTENT_NOTE_IDS = [
  "hypos-lows",
  "mental-health",
  "eating-body",
  "general-sensitive",
] as const;

export type CommunityContentNoteId = (typeof COMMUNITY_CONTENT_NOTE_IDS)[number];

export function isCommunityContentNoteId(s: string): s is CommunityContentNoteId {
  return (COMMUNITY_CONTENT_NOTE_IDS as readonly string[]).includes(s);
}

export const COMMUNITY_CONTENT_NOTES: {
  id: CommunityContentNoteId;
  label: string;
  shortLabel: string;
}[] = [
  {
    id: "hypos-lows",
    label: "Hypos / lows — be gentle with dosing advice",
    shortLabel: "Hypos / lows",
  },
  {
    id: "mental-health",
    label: "Mental health — supportive replies only",
    shortLabel: "Mental health",
  },
  {
    id: "eating-body",
    label: "Food / body image — no shame, stay kind",
    shortLabel: "Food / body",
  },
  {
    id: "general-sensitive",
    label: "Sensitive topic — read with care",
    shortLabel: "Sensitive",
  },
];

export function communityContentNoteLabel(id: CommunityContentNoteId): string {
  return COMMUNITY_CONTENT_NOTES.find((n) => n.id === id)?.shortLabel ?? id;
}

/** Longer hint for tooltips / accessibility. */
export function communityContentNoteHint(id: CommunityContentNoteId): string {
  return COMMUNITY_CONTENT_NOTES.find((n) => n.id === id)?.label ?? id;
}
