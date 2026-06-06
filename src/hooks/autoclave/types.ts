// src/hooks/autoclave/types.ts

import { DAILY_OPS_FIELD_KEYS } from "@/src/constants/autoclave";

export type SetupStoredValue = string | number;

export type SetupStoredItem = {
  field?: string;
  value?: SetupStoredValue;
};

export type AutoclaveCycleCounter = {
  cycleNumber?: number;
  dateExecuted?: string;
  cycleId?: string;
};

export type ApplianceDocShape = {
  applianceKey?: string;
  applianceName?: string;
  typeKey?: string;
  typeName?: string;
  setup?: Record<string, SetupStoredItem | undefined>;

  /**
   * Last cycle that was successfully started.
   * Used to generate the next cycle number.
   */
  lastStartedCycle?: AutoclaveCycleCounter;

  /**
   * Last cycle that was successfully finished/unloaded.
   * Used for audit/reporting only.
   */
  lastFinishedCycle?: AutoclaveCycleCounter;

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

export type AutoclaveApplianceSnapshot = {
  clinicId: string;
  roomId: string;
  applianceId: string;
  applianceKey: string;
  applianceName: string | null;
  serialNumber: string;
};

export type AutoclaveRecordActor = {
  userId: string;
  userName: string | null;
};
