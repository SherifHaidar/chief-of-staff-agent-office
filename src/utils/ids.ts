const HYPHENATED_NOTION_ID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const COMPACT_NOTION_ID = /[0-9a-fA-F]{32}/g;

export function normalizeNotionPageId(input: string): string {
  const trimmed = input.trim();
  const hyphenated = trimmed.match(HYPHENATED_NOTION_ID)?.[0];

  if (hyphenated) {
    return hyphenated.toLowerCase();
  }

  const compactMatches = [...trimmed.matchAll(COMPACT_NOTION_ID)];
  const compact = compactMatches.at(-1)?.[0] ?? trimmed.replaceAll("-", "");

  if (!/^[0-9a-fA-F]{32}$/.test(compact)) {
    throw new Error("Invalid Notion page ID. Expected a 32-character ID, hyphenated UUID, or Notion page URL.");
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ]
    .join("-")
    .toLowerCase();
}
