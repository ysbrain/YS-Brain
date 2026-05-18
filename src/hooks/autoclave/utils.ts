// src/hooks/autoclave/utils.ts

import { AUTOCLAVE_CYCLE_ID } from '@/src/constants/autoclave';

/**
 * Build autoclave cycle ID
 *
 * Format:
 * SERIAL-YYMMDD-XX
 */
export function buildCycleId(params: {
  serial: string;
  dateYYMMDD: string;
  cycleNumber: number;
  pad2: (value: number) => string;
}): string {
  const { serial, dateYYMMDD, cycleNumber, pad2 } = params;

  return `${serial}-${dateYYMMDD}-${pad2(cycleNumber)}`;
}

export function parseCycleId(cycleId: string) {
  const match = cycleId.match(AUTOCLAVE_CYCLE_ID.regex);

  if (!match) return null;

  const [, serial, dateYYMMDD, cycleNumberText] = match;

  const cycleNumber = Number(cycleNumberText);

  if (!Number.isFinite(cycleNumber)) return null;

  return {
    serial,
    dateYYMMDD,
    cycleNumber,
  };
}

export function sanitizeIdPart(value: string, fallback = 'unknown'): string {
  const cleaned = value
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '');

  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Strict serial validation for cycle IDs.
 *
 * Unlike sanitizeIdPart(), this must NOT silently remove unsupported characters.
 * If the serial contains anything outside A-Z, a-z, 0-9, dot, underscore, or hyphen,
 * it returns null.
 */
export function getStrictSerialIdPart(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const isValidSerialIdPart = /^[A-Za-z0-9._-]+$/.test(trimmed);

  if (!isValidSerialIdPart) return null;

  return trimmed;
}
