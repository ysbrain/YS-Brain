
/**
 * Turn a free-text label into a stable Firestore-safe key.
 * Example: "Water Line Test" -> "water-line-test"
 */
export function slugifyType(input: string): string {
  const base = (input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')                 // split accents
    .replace(/[\u0300-\u036f]/g, '')   // remove accents
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanum -> hyphen
    .replace(/(^-|-$)+/g, '');         // trim hyphens

  // If user types only symbols/emojis, slug can become empty.
  return base;
}

/**
 * Fallback if slugify returns empty.
 */
export function safeTypeKeyFromLabel(label: string): string {
  const slug = slugifyType(label);
  if (slug) return slug;
  // fallback key - stable enough and Firestore safe
  return `module-${Date.now()}`;
}
