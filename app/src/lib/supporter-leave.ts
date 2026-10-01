/** Who stays on screen after the supporter ends one link. */
export function nextSupportedPerson<T extends { linkId: string }>(
  people: readonly T[],
  removedLinkId: string,
): T | null {
  return people.find((person) => person.linkId !== removedLinkId) ?? null;
}
