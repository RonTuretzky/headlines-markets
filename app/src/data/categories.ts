// Polymarket-style market categories. The deployed contracts have no category
// field, so the category rides inside the market description as a trailing
// `[category:X]` tag — written by the create wizard, parsed back out by the UI
// (and stripped everywhere the description is shown).
export const CATEGORIES = [
  "Politics",
  "World",
  "Economy",
  "Crypto",
  "Sports",
  "Culture",
  "Science",
  "Business",
] as const;

export type Category = (typeof CATEGORIES)[number];

const TAG_RE = /\s*\[category:([a-z]+)\]\s*/i;

export function parseCategory(description: string): Category | null {
  const m = TAG_RE.exec(description);
  if (!m) return null;
  const needle = m[1].toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase() === needle) ?? null;
}

export function stripCategoryTag(description: string): string {
  return description.replace(TAG_RE, " ").trim();
}

export function withCategoryTag(description: string, category: Category | null): string {
  const clean = stripCategoryTag(description);
  return category ? `${clean}\n\n[category:${category.toLowerCase()}]` : clean;
}
