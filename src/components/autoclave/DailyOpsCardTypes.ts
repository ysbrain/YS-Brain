// src/components/autoclave/DailyOpsCardTypes.ts

import type {
  DailyOpsFieldKey,
  DailyOpsPickerField,
} from '@/src/hooks/autoclave/types';

export type DailyOpsRegisterFieldRef = (
  key: DailyOpsFieldKey,
) => (ref: any) => void;

export type DailyOpsFieldFocusHandler = (key: DailyOpsFieldKey) => void;

export type DailyOpsOpenPicker = (
  field: DailyOpsPickerField,
  mode: 'time',
) => void;
