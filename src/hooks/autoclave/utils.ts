// src/hooks/autoclave/utils.ts

export function sanitizeIdPart(value: string, fallback = 'unknown'): string {
  const cleaned = value
    .trim()
    .replace(/[\\\/]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

// - validates using empty fallback
// - returns null when unusable
// - optionally reserves the literal string "unknown"
export function getStrictSerialIdPart(value: string): string | null {
  const cleaned = sanitizeIdPart(value, '');

  if (!cleaned) return null;

  // Optional: keep this if you want to reject "unknown" as a usable serial segment.
  // if (cleaned === 'unknown') return null;

  return cleaned;
}
