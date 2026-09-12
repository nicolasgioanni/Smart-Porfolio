/** Deterministic English prose boundaries for both static rendering and hydration. */
export function splitFirstSentence(text: string): [string, string] {
  for (const boundary of text.matchAll(/[.!?]+["'”’)\]]*(?:\s+|$)/gu)) {
    const end = boundary.index + boundary[0].length;
    const first = text.slice(0, end);
    // Titles and common abbreviations do not end the opening sentence.
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|e\.g|i\.e)\.\s+$/iu.test(first)) continue;
    return [first, text.slice(end)];
  }
  return [text, ""];
}
