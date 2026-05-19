// src/hooks/autoclave/dailyOpsActionTypes.ts

import type {
  DailyOpsActivePicker,
  DailyOpsFieldKey,
  SetupStoredItem,
} from '@/src/hooks/autoclave/types';

export type UiLockScope = 'global' | 'modal';

export type SetUiLockedFn = (
  locked: boolean,
  options?: { scope?: UiLockScope },
) => void;

export type RequestScrollFn = (
  key: string,
  reason: string,
  delayMs?: number,
) => void;

export type ParseHHMMFn = (value: string) => Date | null;

export type ValidatePositiveIntUpTo3DigitsFn = (
  value: string,
) => number | null;

export type UriToBlobFn = (uri: string) => Promise<Blob>;

export type SetupValueToStringFn = (
  setup: Record<string, SetupStoredItem | undefined> | undefined,
  key: string,
  fallback?: string,
) => string;

export type FormatDateYYMMDDFn = (date: Date) => string;

export type Pad2Fn = (value: number) => string;

export type SetActivePickerFn = (
  value: DailyOpsActivePicker,
) => void;

export type SetFormErrorFieldFn = (
  field: DailyOpsFieldKey | null,
) => void;
