/** Detect @mention being typed at the text cursor (for autocomplete). */
export function getActiveMentionAtCursor(
  text: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, cursor));
  const match = /(?:^|[\s\n(])(@([a-z0-9_]{0,30}))$/i.exec(before);
  if (!match) return null;
  const full = match[1] ?? "";
  const start = before.length - full.length;
  return { start, query: (match[2] ?? "").toLowerCase() };
}

/** Replace the partial @query at `start`..`cursor` with a full @handle mention. */
export function insertMentionAtCursor(
  text: string,
  start: number,
  cursor: number,
  handle: string,
): { text: string; cursor: number } {
  const h = handle.trim().replace(/^@/, "").toLowerCase();
  const before = text.slice(0, start);
  const after = text.slice(cursor);
  const mention = `@${h} `;
  const next = before + mention + after;
  return { text: next, cursor: before.length + mention.length };
}
