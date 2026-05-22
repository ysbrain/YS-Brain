// src/hooks/autoclave/dailyOpsValidation.ts

import { DAILY_OPS_FIELD_KEYS } from '@/src/constants/autoclave';
import type { DailyOpsFieldKey } from '@/src/hooks/autoclave/types';

type ParseHHMMFn = (value: string) => Date | null;

type ValidatePositiveIntUpTo3DigitsFn = (
  value: string,
) => number | null;

export type DailyOpsValidationAlert = {
  title: string;
  message: string;
  fieldKey: DailyOpsFieldKey;
};

export type DailyOpsValidationSuccess<TValues> = {
  ok: true;
  values: TValues;
};

export type DailyOpsValidationFailure = {
  ok: false;
  fieldKey: DailyOpsFieldKey;
  alert: DailyOpsValidationAlert;
};

export type DailyOpsValidationResult<TValues> =
  | DailyOpsValidationSuccess<TValues>
  | DailyOpsValidationFailure;

export type DailyOpsStartValidatedValues = {
  temperatureValue: number;
  pressureValue: number;
  trimmedStartTime: string;
};

export type DailyOpsFinishValidatedValues = {
  trimmedUnloadTime: string;
  trimmedNotes: string;
};

function validationError(
  fieldKey: DailyOpsFieldKey,
  message: string,
): DailyOpsValidationFailure {
  return {
    ok: false,
    fieldKey,
    alert: {
      title: 'Validation',
      message,
      fieldKey,
    },
  };
}

export function validateDailyOpsStartForm(params: {
  maxTemp: string;
  pressure: string;
  startTime: string;
  parseHHMM: ParseHHMMFn;
  validatePositiveIntUpTo3Digits: ValidatePositiveIntUpTo3DigitsFn;
}): DailyOpsValidationResult<DailyOpsStartValidatedValues> {
  const {
    maxTemp,
    pressure,
    startTime,
    parseHHMM,
    validatePositiveIntUpTo3Digits,
  } = params;

  const trimmedTemp = maxTemp.trim();
  const trimmedPressure = pressure.trim();
  const trimmedStartTime = startTime.trim();

  if (!trimmedTemp) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.maxTemp,
      'Max Temp (°C) is required.',
    );
  }

  if (!trimmedPressure) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.pressure,
      'Pressure is required.',
    );
  }

  if (!trimmedStartTime) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.startTime,
      'Start Time is required.',
    );
  }

  const temperatureValue =
    validatePositiveIntUpTo3Digits(trimmedTemp);

  if (temperatureValue === null) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.maxTemp,
      'Max Temp (°C) invalid.',
    );
  }

  const pressureValue =
    validatePositiveIntUpTo3Digits(trimmedPressure);

  if (pressureValue === null) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.pressure,
      'Pressure invalid.',
    );
  }

  if (!parseHHMM(trimmedStartTime)) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.startTime,
      'Start Time must be a valid time.',
    );
  }

  return {
    ok: true,
    values: {
      temperatureValue,
      pressureValue,
      trimmedStartTime,
    },
  };
}

export function validateDailyOpsFinishForm(params: {
  unloadTime: string;
  internalIndicator: boolean | null;
  externalIndicator: boolean | null;
  photoUri: string | null;
  notes: string;
  parseHHMM: ParseHHMMFn;
}): DailyOpsValidationResult<DailyOpsFinishValidatedValues> {
  const {
    unloadTime,
    internalIndicator,
    externalIndicator,
    photoUri,
    notes,
    parseHHMM,
  } = params;

  const trimmedUnloadTime = unloadTime.trim();
  const trimmedNotes = notes.trim();

  if (!trimmedUnloadTime) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.unloadTime,
      'Unload Time is required.',
    );
  }

  if (!parseHHMM(trimmedUnloadTime)) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.unloadTime,
      'Unload Time must be a valid time.',
    );
  }

  if (internalIndicator === null) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.internalIndicator,
      'Please select Internal Indicator result.',
    );
  }

  if (externalIndicator === null) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.externalIndicator,
      'Please select External Indicator result.',
    );
  }

  if (!photoUri || photoUri.trim().length === 0) {
    return validationError(
      DAILY_OPS_FIELD_KEYS.photoEvidence,
      'Photo Evidence is required.',
    );
  }

  return {
    ok: true,
    values: {
      trimmedUnloadTime,
      trimmedNotes,
    },
  };
}
