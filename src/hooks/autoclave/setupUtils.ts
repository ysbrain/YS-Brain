// src/hooks/autoclave/setupUtils.ts

import type { SetupStoredItem } from './types';

export function getSetupValue(
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
) {
  return setup?.[key]?.value;
}

export function setupValueToString(
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
  fallback = '',
): string {
  const raw = getSetupValue(setup, key);

  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);

  return fallback;
}

export function setupValueToNumberString(
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
  fallback = '',
): string {
  const raw = getSetupValue(setup, key);

  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();

  return fallback;
}

export function validatePositiveIntUpTo3Digits(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d{1,3}$/.test(trimmed)) return null;

  const numberValue = Number(trimmed);

  if (!Number.isInteger(numberValue)) return null;
  if (numberValue <= 0) return null;

  return numberValue;
}
