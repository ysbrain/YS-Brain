// src/hooks/autoclave/utils.ts

export function sanitizeIdPart(value: string, fallback = 'unknown'): string {
  const cleaned = value
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '');

  return cleaned.length > 0 ? cleaned : fallback;
}
