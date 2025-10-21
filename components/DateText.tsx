import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextProps } from 'react-native';

type DateTextProps = TextProps & {
  /** The date to display. If omitted, shows the current date. */
  date?: Date | string | number;
  /** Force a specific locale. Defaults to 'en-GB' to ensure "21 Oct 2025". */
  locale?: string;
  /** Optional IANA timezone, e.g., 'Asia/Shanghai' or 'UTC'. */
  timeZone?: string;
  /**
   * Auto-refresh the text periodically.
   * - true => refresh every minute
   * - number => refresh interval in ms
   * Useful if you show "today" and want it to roll over at midnight.
   */
  autoRefresh?: boolean | number;
};

const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fallbackFormat(d: Date) {
  const day = String(d.getDate()).padStart(2, '0');
  const mon = monthShort[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`; // e.g., "21 Oct 2025"
}

function formatDate(d: Date, locale = 'en-GB', timeZone?: string) {
  // Prefer Intl for timezone and localization; fall back if unavailable
  try {
    const formatted = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone,
    }).format(d);
    // Remove any commas some locales may add
    return formatted.replace(/,/g, '');
  } catch {
    return fallbackFormat(d);
  }
}

export default function DateText({
  date,
  locale = 'en-GB',
  timeZone,
  autoRefresh = false,
  ...textProps
}: DateTextProps) {
  const [current, setCurrent] = useState<Date>(() => (date ? new Date(date) : new Date()));

  // Update when the incoming `date` prop changes
  useEffect(() => {
    if (date !== undefined) setCurrent(new Date(date));
  }, [date]);

  // Optional auto-refresh (default: every 60s)
  useEffect(() => {
    if (!autoRefresh) return;
    const intervalMs = typeof autoRefresh === 'number' ? autoRefresh : 60_000;
    const id = setInterval(() => setCurrent(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const display = useMemo(
    () => formatDate(current, locale, timeZone),
    [current, locale, timeZone]
  );

  return <Text {...textProps}>{display}</Text>;
}
