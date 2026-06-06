// src/hooks/autoclave/testCounterUtils.ts

import type { AutoclaveTestCounter } from '@/src/hooks/autoclave/types';

export function normalizeAutoclaveTestCounter(
  value: unknown,
): AutoclaveTestCounter {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const raw = value as Record<string, unknown>;

  return {
    dateYYMMDD:
      typeof raw.dateYYMMDD === 'string' && /^\d{6}$/.test(raw.dateYYMMDD)
        ? raw.dateYYMMDD
        : undefined,

    count:
      typeof raw.count === 'number' &&
      Number.isFinite(raw.count) &&
      raw.count >= 0
        ? raw.count
        : undefined,

    lastRecordId:
      typeof raw.lastRecordId === 'string' && raw.lastRecordId.trim().length > 0
        ? raw.lastRecordId.trim()
        : undefined,

    updatedAt: raw.updatedAt,
  };
}
