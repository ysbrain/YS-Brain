// src/hooks/autoclave/types.ts

import { DAILY_OPS_FIELD_KEYS } from "@/src/constants/autoclave";

export type SetupStoredValue = string | number;

export type SetupStoredItem = {
  field?: string;
  value?: SetupStoredValue;
};

export type ApplianceDocShape = {
  applianceKey?: string;
  applianceName?: string;
  typeKey?: string;
  typeName?: string;
  setup?: Record<string, SetupStoredItem | undefined>;
  lastCycle?: {
    cycleNumber?: number;
    dateExecuted?: string;
  };
  _status?: {
    isRunning?: boolean;
    currentCycle?: string;
  };
};

export type DailyOpsCycleDoc = {
  _isFinished?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  settings?: {
    temperature?: number;
    pressure?: number;
  };
  cycleBeginTime?: string;
  cycleBeganBy?: {
    userId?: string;
    userName?: string | null;
  };
  cycleEndTime?: string;
  cycleEndedBy?: {
    userId?: string;
    userName?: string | null;
  };
  results?: {
    internalIndicator?: boolean;
    externalIndicator?: boolean;
    notes?: string | null;
    photoUrl?: string;
    photoPath?: string;
  };
};

export type DailyOpsFieldKey =
  (typeof DAILY_OPS_FIELD_KEYS)[keyof typeof DAILY_OPS_FIELD_KEYS];

export type DailyOpsPickerField = 'startTime' | 'unloadTime';

export type DailyOpsActivePicker = {
  field: DailyOpsPickerField;
  mode: 'time';
} | null;
