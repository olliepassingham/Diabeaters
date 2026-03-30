/** Query fragment so deep links can record return navigation to the Tools hub. */
const FROM_TOOLS = "from=/tools";

/** Append `from=/tools` to a path (for Support etc. opened from a tools sub-page). */
export function withToolsFrom(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${FROM_TOOLS}`;
}
