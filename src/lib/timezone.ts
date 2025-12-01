export const HKTZ = 'Asia/Hong_Kong';

export function isSameHKDay(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: HKTZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(a) === fmt.format(b);
}
