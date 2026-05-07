// src/utils/dateTime.ts

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateYYYYMMDDCompact(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());

  return `${yyyy}${mm}${dd}`;
}

export function formatTimeHHMM(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseHHMM(value: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date;
}

export function formatDateYYYYMMDDSlash(date: Date): string {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

export function parseYYYYMMDDSlash(value: string): Date | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatReadableTimestamp(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}-${ms}`;
}
